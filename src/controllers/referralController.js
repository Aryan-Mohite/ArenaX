import pool from "../config/db.js";
import { creditActivatedReferrals, checkActivation } from "../services/referralService.js";

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

    const [rows] = await pool.query(
      `SELECT rr.reward_id, rr.referred_user_id, rr.status, rr.xp_amount, rr.credited_at, rr.created_at,
              u.username, u.profile_picture
         FROM referral_rewards rr
         JOIN users u ON u.user_id = rr.referred_user_id
        WHERE rr.referrer_id = ?
        ORDER BY rr.created_at DESC`,
      [referrerId]
    );

    // For still-pending rows, surface *why* they haven't activated yet —
    // this is the "nudge them to finish onboarding" signal for the frontend,
    // not just a binary yes/no.
    const invited = await Promise.all(
      rows.map(async (r) => {
        if (r.status === "credited") {
          return { ...r, xp_amount: Number(r.xp_amount), progress: null };
        }
        const progress = await checkActivation(r.referred_user_id);
        return { ...r, xp_amount: Number(r.xp_amount), progress };
      })
    );

    const activatedCount = invited.filter((i) => i.status === "credited").length;
    const rewardsOwed = invited
      .filter((i) => i.status === "credited")
      .reduce((sum, i) => sum + i.xp_amount, 0);

    res.json({
      success: true,
      summary: {
        invitedCount: invited.length,
        activatedCount,
        pendingCount: invited.length - activatedCount,
        totalXpEarned: rewardsOwed,
      },
      invited,
    });
  } catch (err) { next(err); }
};
