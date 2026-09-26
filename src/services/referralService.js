import pool from "../config/db.js";

// XP credited to the referrer once a referred user activates. A flat amount
// keeps this simple; if tiered rewards are ever wanted, this is the one
// place to change.
export const XP_PER_ACTIVATION = 100;

// ─── generateReferralCode ───────────────────────────────────────────────────
// Deterministic-ish + collision-checked: derived from the username so it
// reads as "yours" when shared, with a random suffix so two similar
// usernames don't collide. Mirrors the college-slug uniqueness-retry
// pattern from §3.
export async function generateReferralCode(conn, username) {
  const base = (username || "player").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PLAYER";
  while (true) {
    const suffix = Math.floor(1000 + Math.random() * 9000); // 4 digits
    const code = `${base}${suffix}`;
    const [rows] = await conn.query("SELECT user_id FROM users WHERE referral_code = ?", [code]);
    if (rows.length === 0) return code;
  }
}

// ─── resolveReferrer ─────────────────────────────────────────────────────────
// Looks up who a referral code belongs to. Returns null for an unknown code
// rather than throwing — an invalid code at signup shouldn't block
// registration, it just means no referral gets recorded.
export async function resolveReferrer(code) {
  if (!code) return null;
  const [rows] = await pool.query("SELECT user_id FROM users WHERE referral_code = ?", [code.trim().toUpperCase()]);
  return rows.length > 0 ? rows[0].user_id : null;
}

// ─── checkActivation ─────────────────────────────────────────────────────────
// Activation = profile complete + game selected + joined a tournament/community.
// Computed live (no stored "activated" flag) — same "minimal surface area"
// convention used for §3's college leaderboard/standings. Cheap enough to
// run per-referral on dashboard load; there's no volume here that would
// justify a background job yet.
export async function checkActivation(userId) {
  const [[row]] = await pool.query(
    `SELECT
        (u.bio IS NOT NULL AND u.bio != '' AND u.profile_picture IS NOT NULL AND u.profile_picture != '') AS profile_complete,
        EXISTS(SELECT 1 FROM user_game_profile ugp WHERE ugp.user_id = u.user_id)                          AS game_selected,
        (
          EXISTS(
            SELECT 1 FROM team_members tm
            JOIN tournament_registrations tr ON tr.team_id = tm.team_id
            WHERE tm.user_id = u.user_id AND tm.status = 'active'
          )
          OR EXISTS(SELECT 1 FROM community_posts cp WHERE cp.user_id = u.user_id)
        ) AS joined_tournament_or_community
     FROM users u
     WHERE u.user_id = ?`,
    [userId]
  );
  if (!row) return { activated: false, profileComplete: false, gameSelected: false, joinedTournamentOrCommunity: false };

  const profileComplete = !!row.profile_complete;
  const gameSelected = !!row.game_selected;
  const joinedTournamentOrCommunity = !!row.joined_tournament_or_community;

  return {
    activated: profileComplete && gameSelected && joinedTournamentOrCommunity,
    profileComplete,
    gameSelected,
    joinedTournamentOrCommunity,
  };
}

// ─── creditActivatedReferrals ────────────────────────────────────────────────
// Lazily evaluates every still-pending referral for this referrer and
// credits XP for any referred user who has since activated. Called from the
// ambassador dashboard read path (GET /api/referrals/mine) — no cron, no
// scheduler, consistent with how this codebase already prefers
// on-read/fire-and-forget checks over background jobs for low-volume work.
export async function creditActivatedReferrals(referrerId) {
  const [pending] = await pool.query(
    "SELECT reward_id, referred_user_id FROM referral_rewards WHERE referrer_id = ? AND status = 'pending'",
    [referrerId]
  );
  if (pending.length === 0) return;

  for (const row of pending) {
    const { activated } = await checkActivation(row.referred_user_id);
    if (!activated) continue;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [updateResult] = await conn.query(
        "UPDATE referral_rewards SET status = 'credited', xp_amount = ?, credited_at = NOW() WHERE reward_id = ? AND status = 'pending'",
        [XP_PER_ACTIVATION, row.reward_id]
      );
      if (updateResult.affectedRows > 0) {
        await conn.query("UPDATE users SET xp_balance = xp_balance + ? WHERE user_id = ?", [XP_PER_ACTIVATION, referrerId]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}
