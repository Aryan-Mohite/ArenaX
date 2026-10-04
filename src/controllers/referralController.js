import pool from "../config/db.js";
import { creditActivatedReferrals, checkActivation } from "../services/referralService.js";
import { getSettings, settlePending } from "../services/coinService.js";

// ─── GET MY REFERRAL INFO ───────────────────────────────────────────────────
// GET /api/referrals/mine/code — the share-this-code view. Split from the
// dashboard below so the frontend can show a lightweight "your code" widget
// (e.g. on the profile page) without pulling the full invitee list.
export const getMyReferralCode = async (req, res, next) => {
  try {
    const [[user]] = await pool.query(
      "SELECT referral_code, xp_balance FROM users WHERE user_id = ?",
      [req.user.id]
    );
    res.json({ success: true, referral_code: user.referral_code, xp_balance: Number(user.xp_balance) });
  } catch (err) { next(err); }
};

// ─── AMBASSADOR DASHBOARD ────────────────────────────────────────────────────
// GET /api/referrals/mine — invited users, which have activated, and
// rewards owed vs. already credited. Lazily credits any newly-activated
// referrals before reading, so the numbers shown are always current.
export const getMyReferrals = async (req, res, next) => {
  try {
    const referrerId = req.user.id;

    await creditActivatedReferrals(referrerId);
    await settlePending(referrerId); // vest referral coins whose hold period has ended

    // coin_status comes from the ledger row for this friend: pending (on hold),
    // available (yours to spend) or reversed (e.g. the friend was banned).
    const [rows] = await pool.query(
      `SELECT rr.reward_id, rr.referred_user_id, rr.status, rr.xp_amount, rr.coins_amount, rr.credited_at, rr.created_at,
              u.username, u.profile_picture,
              l.status AS coin_status, l.available_at AS coin_available_at
         FROM referral_rewards rr
         JOIN users u ON u.user_id = rr.referred_user_id
         LEFT JOIN coin_ledger l ON l.user_id = rr.referrer_id AND l.ref_key = CONCAT('referral:', rr.referred_user_id)
        WHERE rr.referrer_id = ?
        ORDER BY rr.created_at DESC`,
      [referrerId]
    );

    // For still-pending rows, surface *why* they haven't activated yet --
    // this is the "nudge them to finish onboarding" signal for the frontend,
    // not just a binary yes/no.
    const invited = await Promise.all(
      rows.map(async (r) => {
        const base = { ...r, xp_amount: Number(r.xp_amount), coins_amount: Number(r.coins_amount) };
        if (r.status === "credited") return { ...base, progress: null };
        return { ...base, progress: await checkActivation(r.referred_user_id) };
      })
    );

    const activatedCount = invited.filter((i) => i.status === "credited").length;
    const legacyXp = invited.filter((i) => i.status === "credited").reduce((sum, i) => sum + i.xp_amount, 0);

    const [[coins]] = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN status = 'available' THEN delta END), 0) AS earned,
              COALESCE(SUM(CASE WHEN status = 'pending'   THEN delta END), 0) AS on_hold
         FROM coin_ledger WHERE user_id = ? AND reason = 'referral'`,
      [referrerId]
    );
    const settings = await getSettings();
    const [[used]] = await pool.query(
      `SELECT COUNT(*) AS n FROM referral_rewards
        WHERE referrer_id = ? AND status = 'credited' AND coins_amount > 0
          AND credited_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`,
      [referrerId]
    );

    res.json({
      success: true,
      summary: {
        invitedCount: invited.length,
        activatedCount,
        pendingCount: invited.length - activatedCount,
        coinsEarned: Number(coins.earned),
        coinsOnHold: Number(coins.on_hold),
        totalXpEarned: legacyXp, // legacy: referrals used to pay XP
      },
      // Live program rules, so the page never hard-codes numbers an admin can change.
      program: {
        coinsPerReferral: Number(settings.earn_referral),
        holdDays: Number(settings.referral_hold_days),
        monthlyCap: Number(settings.referral_monthly_cap),
        creditedThisMonth: Number(used.n),
        capReached: Number(used.n) >= Number(settings.referral_monthly_cap),
        paused: Number(settings.earn_referral) <= 0,
      },
      invited,
    });
  } catch (err) { next(err); }
};

// --- ADMIN: REFERRAL ANALYTICS ----------------------------------------------
// GET /api/admin/analytics/referrals -- is the acquisition loop working, and is
// anyone farming it? Top referrers are listed with activation rates so an
// admin can spot a user whose "friends" all activate suspiciously fast.
export const getReferralAnalytics = async (req, res, next) => {
  try {
    const [[tot]] = await pool.query(
      `SELECT COUNT(*) AS invited,
              COUNT(CASE WHEN status = 'credited' THEN 1 END) AS activated,
              COUNT(CASE WHEN status = 'pending'  THEN 1 END) AS pending,
              COUNT(DISTINCT referrer_id) AS referrers,
              COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) AS invited_30d,
              COUNT(CASE WHEN status = 'credited' AND credited_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) AS activated_30d
         FROM referral_rewards`
    );
    const [[usr]] = await pool.query("SELECT COUNT(*) AS total_users, COUNT(referred_by) AS via_referral FROM users");
    const [[coins]] = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN status = 'available' THEN delta END), 0) AS paid,
              COALESCE(SUM(CASE WHEN status = 'pending'   THEN delta END), 0) AS on_hold,
              COALESCE(SUM(CASE WHEN status = 'reversed'  THEN delta END), 0) AS reversed
         FROM coin_ledger WHERE reason = 'referral'`
    );
    const [top] = await pool.query(
      `SELECT u.user_id, u.username, u.status,
              COUNT(*) AS invited,
              COUNT(CASE WHEN rr.status = 'credited' THEN 1 END) AS activated,
              (SELECT COALESCE(SUM(l.delta), 0) FROM coin_ledger l
                WHERE l.user_id = u.user_id AND l.reason = 'referral' AND l.status IN ('available','pending')) AS coins
         FROM referral_rewards rr JOIN users u ON u.user_id = rr.referrer_id
        GROUP BY u.user_id, u.username, u.status
        ORDER BY invited DESC, activated DESC, u.user_id
        LIMIT 10`
    );
    const rate = (a, b) => (Number(b) > 0 ? Number((Number(a) / Number(b)).toFixed(4)) : null);

    res.json({
      success: true,
      summary: {
        invited: Number(tot.invited),
        activated: Number(tot.activated),
        pending: Number(tot.pending),
        activation_rate: rate(tot.activated, tot.invited),
        referrers: Number(tot.referrers),
        invited_30d: Number(tot.invited_30d),
        activated_30d: Number(tot.activated_30d),
        share_of_signups: rate(usr.via_referral, usr.total_users),
        coins_paid: Number(coins.paid),
        coins_on_hold: Number(coins.on_hold),
        coins_reversed: Number(coins.reversed),
      },
      top: top.map((t) => ({
        user_id: t.user_id, username: t.username, status: t.status,
        invited: Number(t.invited), activated: Number(t.activated),
        activation_rate: rate(t.activated, t.invited), coins: Number(t.coins),
      })),
    });
  } catch (err) { next(err); }
};
