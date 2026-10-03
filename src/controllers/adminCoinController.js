import pool from "../config/db.js";
import {
  getSettings, validateSetting, SETTING_SPECS, rewardCoinCost, rejectRedemption, notifyRedemptionOutcome,
  getBalance, adminAdjustCoins,
} from "../services/coinService.js";

// A single edit may not move the exchange rate by more than 2x either way.
// This is a fat-finger guard (an extra zero would silently 10x the payout
// cost of every cash reward), not a business rule  do it in steps if you
// really want a bigger swing.
const MAX_RATE_SWING = 2;

// ── SETTINGS ─────────────────────────────────────────────────────────────────
// GET /api/admin/coins/settings
export const getCoinSettings = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const [audit] = await pool.query(
      `SELECT a.audit_id, a.setting_key, a.old_value, a.new_value, a.changed_at, u.username AS changed_by
         FROM coin_settings_audit a LEFT JOIN users u ON u.user_id = a.changed_by
        ORDER BY a.audit_id DESC LIMIT 30`
    );
    const specs = Object.entries(SETTING_SPECS).map(([key, s]) => ({
      key, type: s.type, label: s.label, min: s.min, max: s.max, allowed: s.allowed,
      value: Array.isArray(settings[key]) ? settings[key].join(",") : settings[key],
    }));
    res.json({ success: true, settings: specs, audit });
  } catch (err) { next(err); }
};

// PUT /api/admin/coins/settings   { settings: { coins_per_inr: 120, earn_login: 5, ... } }
// Validates every key before writing any; writes + audit rows in one transaction.
export const updateCoinSettings = async (req, res, next) => {
  const incoming = req.body?.settings;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return res.status(400).json({ success: false, message: "settings object is required" });
  }

  const conn = await pool.getConnection();
  try {
    const current = await getSettings();
    const changes = [];

    for (const [key, raw] of Object.entries(incoming)) {
      const { value, error } = validateSetting(key, raw);
      if (error) return res.status(400).json({ success: false, message: error });

      const oldStr = Array.isArray(current[key]) ? current[key].join(",")
                   : typeof current[key] === "boolean" ? (current[key] ? "1" : "0")
                   : String(current[key]);
      if (value === oldStr) continue;

      if (key === "coins_per_inr") {
        const ratio = Number(value) / Number(current[key]);
        if (ratio > MAX_RATE_SWING || ratio < 1 / MAX_RATE_SWING) {
          return res.status(400).json({
            success: false,
            message: `The exchange rate can't change by more than ${MAX_RATE_SWING}x in one edit (currently ${current[key]}). Change it in steps.`,
          });
        }
      }
      changes.push({ key, oldStr, value });
    }

    if (changes.length === 0) return res.json({ success: true, changed: 0, message: "No changes" });

    await conn.beginTransaction();
    for (const c of changes) {
      await conn.query(
        `INSERT INTO coin_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [c.key, c.value, req.user.id]
      );
      await conn.query(
        "INSERT INTO coin_settings_audit (setting_key, old_value, new_value, changed_by) VALUES (?, ?, ?, ?)",
        [c.key, c.oldStr, c.value, req.user.id]
      );
    }
    await conn.commit();
    res.json({ success: true, changed: changes.length });
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
};

// ── STATS ────────────────────────────────────────────────────────────────────
// GET /api/admin/coins/stats  the numbers that tell you whether the economy is affordable.
export const getCoinStats = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const [[t]] = await pool.query(
      `SELECT
          COALESCE(SUM(CASE WHEN delta > 0 AND status <> 'reversed' AND reason NOT IN ('redemption_refund') THEN delta END), 0) AS issued,
          COALESCE(SUM(CASE WHEN reason = 'redemption' THEN -delta END), 0)                                                   AS spent,
          COALESCE(SUM(CASE WHEN reason = 'redemption_refund' THEN delta END), 0)                                             AS refunded,
          COALESCE(SUM(CASE WHEN status = 'available' THEN delta END), 0)                                                     AS outstanding,
          COUNT(DISTINCT CASE WHEN delta > 0 AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY) THEN user_id END)   AS earners_30d
         FROM coin_ledger`
    );
    const [[q]] = await pool.query(
      `SELECT
          COUNT(CASE WHEN r.status IN ('requested','approved') THEN 1 END) AS open_requests,
          COALESCE(SUM(CASE WHEN r.status IN ('requested','approved') THEN r.inr_value END), 0) AS open_inr,
          COALESCE(SUM(CASE WHEN r.status = 'fulfilled' AND c.type IN ('gift_card','topup') AND r.created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01') THEN r.inr_value END), 0) AS cash_out_month
         FROM redemptions r JOIN reward_catalog c ON c.reward_id = r.reward_id`
    );
    const outstanding = Number(t.outstanding);
    res.json({
      success: true,
      stats: {
        coins_per_inr: settings.coins_per_inr,
        issued: Number(t.issued),
        spent: Number(t.spent) - Number(t.refunded),
        outstanding,
        // Worst case if every outstanding coin were redeemed for cash rewards.
        max_liability_inr: Number((outstanding / settings.coins_per_inr).toFixed(2)),
        earners_30d: Number(t.earners_30d),
        open_requests: Number(q.open_requests),
        open_requests_inr: Number(q.open_inr),
        cash_rewards_fulfilled_this_month_inr: Number(q.cash_out_month),
      },
    });
  } catch (err) { next(err); }
};

// ── REDEMPTION QUEUE ─────────────────────────────────────────────────────────
// GET /api/admin/coins/redemptions?status=requested|approved|fulfilled|rejected
export const getRedemptionQueue = async (req, res, next) => {
  try {
    const status = ["requested", "approved", "fulfilled", "rejected"].includes(req.query.status)
      ? req.query.status : "requested";
    const [rows] = await pool.query(
      `SELECT r.redemption_id, r.user_id, r.coins_spent, r.inr_value, r.status, r.fulfillment, r.admin_note,
              r.created_at, c.name AS reward_name, c.type, u.username, u.email, u.email_verified, u.created_at AS user_since
         FROM redemptions r
         JOIN reward_catalog c ON c.reward_id = r.reward_id
         JOIN users u ON u.user_id = r.user_id
        WHERE r.status = ?
        ORDER BY r.redemption_id ASC LIMIT 200`,
      [status]
    );
    res.json({ success: true, redemptions: rows });
  } catch (err) { next(err); }
};

// POST /api/admin/coins/redemptions/:id/approve
export const approveRedemption = async (req, res, next) => {
  try {
    const [r] = await pool.query(
      "UPDATE redemptions SET status = 'approved', reviewed_by = ? WHERE redemption_id = ? AND status = 'requested'",
      [req.user.id, req.params.id]
    );
    if (r.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "No requested redemption with that id" });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
};

// POST /api/admin/coins/redemptions/:id/fulfil  { fulfillment, note? }
// `fulfillment` is the gift card code / top-up reference shown to the user.
export const fulfilRedemption = async (req, res, next) => {
  try {
    const fulfillment = String(req.body?.fulfillment || "").trim();
    if (!fulfillment) {
      return res.status(400).json({ success: false, message: "Enter the gift card code or top-up reference" });
    }
    if (fulfillment.length > 2000) {
      return res.status(400).json({ success: false, message: "Fulfillment text is too long" });
    }
    const note = req.body?.note ? String(req.body.note).slice(0, 255) : null;
    const [r] = await pool.query(
      `UPDATE redemptions SET status = 'fulfilled', fulfillment = ?, admin_note = COALESCE(?, admin_note), reviewed_by = ?
        WHERE redemption_id = ? AND status IN ('requested','approved')`,
      [fulfillment, note, req.user.id, req.params.id]
    );
    if (r.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "No open redemption with that id" });
    }
    notifyRedemptionOutcome(Number(req.params.id));
    res.json({ success: true });
  } catch (err) { next(err); }
};

// POST /api/admin/coins/redemptions/:id/reject  { note? }  refunds the coins
export const rejectRedemptionHandler = async (req, res, next) => {
  try {
    await rejectRedemption(Number(req.params.id), req.user.id, req.body?.note ? String(req.body.note).slice(0, 255) : null);
    notifyRedemptionOutcome(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

// ── CATALOG ──────────────────────────────────────────────────────────────────
// GET /api/admin/coins/catalog  every reward, active or not, with live coin cost
export const getAdminCatalog = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const [rows] = await pool.query("SELECT * FROM reward_catalog ORDER BY sort_order, reward_id");
    res.json({
      success: true,
      rewards: rows.map((r) => ({ ...r, inr_value: r.inr_value != null ? Number(r.inr_value) : null, live_coin_cost: rewardCoinCost(r, settings) })),
    });
  } catch (err) { next(err); }
};

const REWARD_TYPES = ["pro_days", "gift_card", "topup", "other"];

function cleanReward(body, partial = false) {
  const out = {};
  const err = (m) => ({ error: m });

  if (!partial || body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name || name.length > 120) return err("name is required (max 120 chars)");
    out.name = name;
  }
  if (body.description !== undefined) out.description = body.description ? String(body.description).slice(0, 255) : null;
  if (!partial || body.type !== undefined) {
    if (!REWARD_TYPES.includes(body.type)) return err(`type must be one of ${REWARD_TYPES.join(", ")}`);
    out.type = body.type;
  }
  for (const k of ["inr_value", "coin_cost", "pro_days", "stock", "sort_order"]) {
    if (body[k] === undefined) continue;
    if (body[k] === null || body[k] === "") { out[k] = null; continue; }
    const n = Number(body[k]);
    if (!Number.isFinite(n) || n < 0) return err(`${k} must be a non-negative number`);
    out[k] = k === "inr_value" ? n : Math.floor(n);
  }
  if (body.is_active !== undefined) out.is_active = body.is_active ? 1 : 0;
  return { value: out };
}

// POST /api/admin/coins/catalog
export const createReward = async (req, res, next) => {
  try {
    const { value, error } = cleanReward(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    if ((value.type === "gift_card" || value.type === "topup") && !(value.inr_value > 0)) {
      return res.status(400).json({ success: false, message: "Gift cards and top-ups need an inr_value" });
    }
    if (value.type === "pro_days" && !(value.pro_days > 0 && value.coin_cost > 0)) {
      return res.status(400).json({ success: false, message: "Pro rewards need pro_days and coin_cost" });
    }
    if (value.type === "other" && !(value.coin_cost > 0)) {
      return res.status(400).json({ success: false, message: "This reward needs a coin_cost" });
    }

    const key = `${value.type}_${Date.now().toString(36)}`;
    const [ins] = await pool.query(
      `INSERT INTO reward_catalog (reward_key, name, description, type, inr_value, coin_cost, pro_days, stock, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [key, value.name, value.description ?? null, value.type, value.inr_value ?? null, value.coin_cost ?? null,
       value.pro_days ?? null, value.stock ?? null, value.is_active ?? 1, value.sort_order ?? 100]
    );
    res.status(201).json({ success: true, reward_id: ins.insertId });
  } catch (err) { next(err); }
};

// PATCH /api/admin/coins/catalog/:id
export const updateReward = async (req, res, next) => {
  try {
    const { value, error } = cleanReward(req.body, true);
    if (error) return res.status(400).json({ success: false, message: error });
    const cols = Object.keys(value);
    if (cols.length === 0) return res.status(400).json({ success: false, message: "Nothing to update" });

    const [r] = await pool.query(
      `UPDATE reward_catalog SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE reward_id = ?`,
      [...cols.map((c) => value[c]), req.params.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ success: false, message: "Reward not found" });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── PER-USER LEDGER ──────────────────────────────────────────────────────────
// GET /api/admin/coins/users/:id?limit=&offset=
// Everything an admin needs to judge one account before approving a payout:
// balance, lifetime earned/spent, a 14-day earn pattern, the full ledger, and
// recent redemptions.
export const getUserCoinLedger = async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const [[user]] = await pool.query(
      "SELECT user_id, username, email, email_verified, status, created_at, last_login FROM users WHERE user_id = ?",
      [userId]
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const [[totals]] = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN delta > 0 AND status <> 'reversed' THEN delta END), 0) AS earned,
              COALESCE(-SUM(CASE WHEN reason = 'redemption' AND status <> 'reversed' THEN delta END), 0) AS spent
         FROM coin_ledger WHERE user_id = ?`,
      [userId]
    );
    const [daily] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, SUM(delta) AS coins, COUNT(*) AS entries
         FROM coin_ledger
        WHERE user_id = ? AND delta > 0 AND status <> 'reversed'
          AND created_at >= (UTC_TIMESTAMP() - INTERVAL 14 DAY)
        GROUP BY day ORDER BY day DESC`,
      [userId]
    );
    const [entries] = await pool.query(
      `SELECT entry_id, delta, reason, ref_key, status, available_at, note, created_at
         FROM coin_ledger WHERE user_id = ?
        ORDER BY entry_id DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    const [[count]] = await pool.query("SELECT COUNT(*) AS n FROM coin_ledger WHERE user_id = ?", [userId]);
    const [redemptions] = await pool.query(
      `SELECT r.redemption_id, r.coins_spent, r.inr_value, r.status, r.admin_note, r.created_at, c.name AS reward_name
         FROM redemptions r JOIN reward_catalog c ON c.reward_id = r.reward_id
        WHERE r.user_id = ? ORDER BY r.redemption_id DESC LIMIT 20`,
      [userId]
    );

    res.json({
      success: true,
      user,
      balance: await getBalance(userId),
      totals: { earned: Number(totals.earned), spent: Number(totals.spent) },
      daily,
      entries,
      total_entries: Number(count.n),
      redemptions,
    });
  } catch (err) { next(err); }
};

// POST /api/admin/coins/users/:id/adjust  { amount, note }
export const adjustUserCoins = async (req, res, next) => {
  try {
    const result = await adminAdjustCoins(Number(req.params.id), req.user.id, req.body?.amount, req.body?.note);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, code: err.code, message: err.message });
    next(err);
  }
};
