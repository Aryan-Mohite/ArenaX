import { recordSignal } from "../services/signalService.js";
import pool from "../config/db.js";
import {
  getSettings, getBalance, settlePending, syncOneTimeCoins,
  listCatalog, redeemReward, SETTING_SPECS,
} from "../services/coinService.js";
import { hasFeature } from "../services/featureService.js";
import { creditActivatedReferrals } from "../services/referralService.js";
import { openRedemptionDispute } from "../services/coinOpsService.js";

// ── GET MY COINS ─────────────────────────────────────────────────────────────
// GET /api/coins/me
// Balance, what each action earns right now (so the UI never hardcodes
// amounts), whether the user gets the Pro multiplier, and the catalog.
// Settles matured pending rows and lazily awards one-time coins first, so the
// numbers shown are always current.
export const getMyCoins = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await syncOneTimeCoins(userId).catch((e) => console.error("[coins] sync failed:", e.message));
    await creditActivatedReferrals(userId).catch((e) => console.error("[referrals] credit failed:", e.message));
    await settlePending(userId);

    const [settings, balance, isPro, catalog] = await Promise.all([
      getSettings(),
      getBalance(userId),
      hasFeature(userId, "coin_multiplier"),
      listCatalog(),
    ]);

    const earn = Object.keys(SETTING_SPECS)
      .filter((k) => k.startsWith("earn_"))
      .map((k) => {
        const key = k.replace("earn_", "");
        const boosted = settings.pro_multiplier > 1 && settings.pro_multiplier_reasons.includes(key);
        return {
          key,
          label: SETTING_SPECS[k].label,
          amount: settings[k],
          pro_amount: boosted ? Math.round(settings[k] * settings.pro_multiplier) : settings[k],
          boosted,
        };
      });

    res.json({
      success: true,
      balance: balance.available,
      pending: balance.pending,
      is_pro: isPro,
      coins_per_inr: settings.coins_per_inr,
      pro_multiplier: settings.pro_multiplier,
      redemptions_enabled: settings.redemptions_enabled,
      earn,
      catalog,
    });
  } catch (err) { next(err); }
};

// ── MY LEDGER ────────────────────────────────────────────────────────────────
// GET /api/coins/ledger?limit=&offset=
export const getMyLedger = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const [rows] = await pool.query(
      `SELECT entry_id, delta, reason, status, available_at, note, created_at
         FROM coin_ledger WHERE user_id = ?
        ORDER BY entry_id DESC LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );
    res.json({ success: true, entries: rows });
  } catch (err) { next(err); }
};

// ── REDEEM ───────────────────────────────────────────────────────────────────
// POST /api/coins/redeem  { reward_id }
export const redeem = async (req, res, next) => {
  try {
    const rewardId = Number(req.body.reward_id);
    if (!Number.isInteger(rewardId) || rewardId < 1) {
      return res.status(400).json({ success: false, message: "reward_id is required" });
    }
    // Make sure this device is on record before the per-device rule runs, so
    // accounts that have not logged in since the signals feature shipped are covered.
    await recordSignal(req.user.id, "redeem", req).catch(() => {});
    const result = await redeemReward(req.user.id, rewardId);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, code: err.code, message: err.message });
    next(err);
  }
};

// ── MY REDEMPTIONS ───────────────────────────────────────────────────────────
// GET /api/coins/redemptions
// `fulfillment` (the gift card code) is only ever returned to its owner, and
// only once an admin has marked it fulfilled.
export const getMyRedemptions = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.redemption_id, r.coins_spent, r.status, r.admin_note, r.created_at, r.updated_at,
              CASE WHEN r.status = 'fulfilled' THEN r.fulfillment ELSE NULL END AS fulfillment,
              c.name, c.type,
              (SELECT d.status FROM redemption_disputes d WHERE d.redemption_id = r.redemption_id ORDER BY d.dispute_id DESC LIMIT 1) AS dispute_status,
              TIMESTAMPDIFF(HOUR, r.created_at, NOW()) AS age_hours
         FROM redemptions r JOIN reward_catalog c ON c.reward_id = r.reward_id
        WHERE r.user_id = ?
        ORDER BY r.redemption_id DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ success: true, redemptions: rows });
  } catch (err) { next(err); }
};

// GET /api/coins/balance -- tiny, side-effect-free balance for the navbar pill.
// (/coins/me also syncs one-time awards and referral payouts, so it is too
// heavy to call on every page.)
export const getMyBalance = async (req, res, next) => {
  try {
    res.json({ success: true, ...(await getBalance(req.user.id)) });
  } catch (err) { next(err); }
};

// POST /api/coins/redemptions/:id/dispute  { reason }
export const disputeRedemption = async (req, res, next) => {
  try {
    const result = await openRedemptionDispute(req.user.id, Number(req.params.id), req.body?.reason);
    res.status(201).json({ success: true, ...result, message: "Report sent. Our team will review it." });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, code: err.code, message: err.message });
    next(err);
  }
};
