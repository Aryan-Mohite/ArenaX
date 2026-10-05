import pool from "../config/db.js";
import { getSettings, awardCoins } from "./coinService.js";
import { sharesDevice } from "./signalService.js";

// Rewards are Arena Coins (admin-editable: earn_referral, referral_hold_days,
// referral_monthly_cap). They used to be XP, but nothing ever spent XP.

// ─── generateReferralCode ───────────────────────────────────────────────────
// Deterministic-ish + collision-checked: derived from the username so it
// reads as "yours" when shared, with a random suffix so two similar
// usernames don't collide.
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
// convention used elsewhere (e.g. coin balances). Cheap enough to
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

// -- creditActivatedReferrals -------------------------------------------------
// Lazily evaluates every still-pending referral for this referrer and pays
// Arena Coins for any referred user who has since activated. No cron: it runs
// when the referrer opens the dashboard or the Rewards page, and on login.
//
// Coins can become gift cards, so referrals are protected like the other
// cash-adjacent earns:
//  * a referrer who isn't in good standing earns nothing;
//  * the friend must also be a normal (non-banned) account;
//  * a monthly cap per referrer (rows over the cap simply stay pending and are
//    paid next month);
//  * the coins are held as 'pending' for referral_hold_days and only vest if the
//    friend is still a normal account (see settlePending in coinService).
// Idempotent: the ledger row is keyed referral:<friendId>, so concurrent or
// repeated runs can never pay the same friend twice.
export async function creditActivatedReferrals(referrerId) {
  const [[referrer]] = await pool.query("SELECT status FROM users WHERE user_id = ?", [referrerId]);
  if (!referrer || referrer.status !== "active") return;

  const [pending] = await pool.query(
    "SELECT reward_id, referred_user_id FROM referral_rewards WHERE referrer_id = ? AND status = 'pending' ORDER BY reward_id",
    [referrerId]
  );
  if (pending.length === 0) return;

  const settings = await getSettings();
  const coins = Number(settings.earn_referral) || 0;
  if (coins <= 0) return; // program paused by an admin

  const [[used]] = await pool.query(
    `SELECT COUNT(*) AS n FROM referral_rewards
      WHERE referrer_id = ? AND status = 'credited' AND coins_amount > 0
        AND credited_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`,
    [referrerId]
  );
  let remaining = Number(settings.referral_monthly_cap) - Number(used.n);

  for (const row of pending) {
    if (remaining <= 0) break;

    const { activated } = await checkActivation(row.referred_user_id);
    if (!activated) continue;

    const [[friend]] = await pool.query("SELECT status FROM users WHERE user_id = ?", [row.referred_user_id]);
    if (!friend || friend.status !== "active") continue;

    // Same device as the referrer = the same person with two accounts. No coins;
    // mark it so it is not retried and shows up as blocked in the dashboard.
    if (await sharesDevice(referrerId, row.referred_user_id)) {
      await pool.query(
        "UPDATE referral_rewards SET status = 'blocked' WHERE reward_id = ? AND status = 'pending'",
        [row.reward_id]
      );
      continue;
    }

    const hold = Number(settings.referral_hold_days) || 0;
    // Pay first, then flip the status. If the flip fails, the next run finds the
    // ledger row already there (no double pay) and just completes the flip.
    await awardCoins(referrerId, "referral", `referral:${row.referred_user_id}`, {
      settings,
      pending: hold > 0,
      availableAt: hold > 0 ? new Date(Date.now() + hold * 86400000) : null,
    });
    const [flip] = await pool.query(
      "UPDATE referral_rewards SET status = 'credited', coins_amount = ?, credited_at = NOW() WHERE reward_id = ? AND status = 'pending'",
      [coins, row.reward_id]
    );
    if (flip.affectedRows > 0) remaining -= 1;
  }
}

// Fire-and-forget wrapper for hooks (login, Rewards page). Never throws.
export function creditActivatedReferralsSafe(referrerId) {
  creditActivatedReferrals(referrerId).catch((err) =>
    console.error("[referrals] creditActivatedReferrals failed:", err.message)
  );
}
