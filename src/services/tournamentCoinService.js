import pool from "../config/db.js";
import { getSettings, awardCoins } from "./coinService.js";

// Tournament attendance coins.
//
// Paid ONCE per player per tournament, at the moment a tournament becomes
// 'completed' (organizer flips it, or the hourly status job does). A player is
// paid only if ALL of these hold:
//   - their team checked in (organizer ran check-in) and was not no-show / DQ'd
//   - the tournament had at least `tournament_min_teams` checked-in teams
//   - the organizer is an admin or an approved organizer (setting, default on)
//   - the player is an active, email-verified account old enough, and is not the organizer
//   - no other paid player in the same tournament used the same device
//   - they are under the monthly cap and the tournament is under its player cap
// Coins start 'pending' and vest after `tournament_vest_days`; a ban in between
// reverses them (see settlePending). Re-running is harmless: the ledger key
// `tournament:<id>` is unique per player.

const adminEmails = () =>
  (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function awardTournamentCoins(tournamentId, injected) {
  const settings = injected || (await getSettings());
  const result = { tournament_id: Number(tournamentId), paid: 0, coins: 0, skipped: {}, reason: null };
  const skip = (k) => { result.skipped[k] = (result.skipped[k] || 0) + 1; };

  if (!(Number(settings.earn_tournament_attendance) > 0)) { result.reason = "disabled"; return result; }

  const [[t]] = await pool.query(
    `SELECT t.tournament_id, t.status, t.created_by, u.email AS organizer_email
       FROM tournaments t LEFT JOIN users u ON u.user_id = t.created_by
      WHERE t.tournament_id = ?`,
    [tournamentId]
  );
  if (!t) { result.reason = "not_found"; return result; }
  if (t.status !== "completed") { result.reason = "not_completed"; return result; }

  if (settings.tournament_require_verified_organizer) {
    const isAdminRun = !!t.organizer_email && adminEmails().includes(String(t.organizer_email).toLowerCase());
    let verified = isAdminRun;
    if (!verified && t.created_by) {
      const [v] = await pool.query(
        "SELECT 1 FROM organizer_verifications WHERE user_id = ? AND status = 'approved' LIMIT 1",
        [t.created_by]
      );
      verified = v.length > 0;
    }
    if (!verified) { result.reason = "organizer_not_verified"; return result; }
  }

  const [teams] = await pool.query(
    `SELECT team_id, checked_in_at FROM tournament_registrations
      WHERE tournament_id = ? AND checked_in_at IS NOT NULL AND status NOT IN ('disqualified', 'no_show')`,
    [tournamentId]
  );
  if (teams.length < Number(settings.tournament_min_teams)) { result.reason = "too_few_teams"; return result; }

  // Candidate players, earliest check-in first so the player cap is fair.
  const [players] = await pool.query(
    `SELECT tm.user_id, MIN(tr.checked_in_at) AS first_in, u.email_verified, u.status,
            u.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AS too_new
       FROM tournament_registrations tr
       JOIN team_members tm ON tm.team_id = tr.team_id AND tm.status = 'active'
       JOIN users u ON u.user_id = tm.user_id
      WHERE tr.tournament_id = ? AND tr.checked_in_at IS NOT NULL AND tr.status NOT IN ('disqualified', 'no_show')
      GROUP BY tm.user_id, u.email_verified, u.status, u.created_at
      ORDER BY first_in, tm.user_id`,
    [Number(settings.tournament_min_account_age_days) || 0, tournamentId]
  );
  if (!players.length) { result.reason = "no_players"; return result; }

  const ids = players.map((p) => p.user_id);
  const [devRows] = await pool.query(
    "SELECT DISTINCT user_id, device_id FROM user_signals WHERE user_id IN (?) AND device_id IS NOT NULL",
    [ids]
  );
  const devicesOf = new Map();
  for (const r of devRows) {
    if (!devicesOf.has(r.user_id)) devicesOf.set(r.user_id, []);
    devicesOf.get(r.user_id).push(r.device_id);
  }
  const [monthRows] = await pool.query(
    `SELECT user_id, COUNT(*) AS n FROM coin_ledger
      WHERE reason = 'tournament_attendance' AND status <> 'reversed' AND user_id IN (?)
        AND created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')
      GROUP BY user_id`,
    [ids]
  );
  const monthCount = new Map(monthRows.map((r) => [r.user_id, Number(r.n)]));

  const cap = Number(settings.tournament_reward_monthly_cap) || 0;
  const maxPlayers = Number(settings.tournament_max_players) || 0;
  const vest = Number(settings.tournament_vest_days) || 0;
  const availableAt = vest > 0 ? new Date(Date.now() + vest * 86400000) : null;
  const usedDevices = new Set();

  for (const p of players) {
    if (result.paid >= maxPlayers) { skip("player_cap"); continue; }
    if (p.user_id === t.created_by) { skip("is_organizer"); continue; }
    if (p.status !== "active" || !p.email_verified) { skip("unverified_or_inactive"); continue; }
    if (Number(p.too_new)) { skip("account_too_new"); continue; }
    if ((monthCount.get(p.user_id) || 0) >= cap) { skip("monthly_cap"); continue; }
    const devs = devicesOf.get(p.user_id) || [];
    if (devs.some((d) => usedDevices.has(d))) { skip("shared_device"); continue; }

    const r = await awardCoins(p.user_id, "tournament_attendance", `tournament:${tournamentId}`, {
      pending: vest > 0, availableAt, settings,
    });
    if (r.awarded) {
      result.paid += 1;
      result.coins += r.amount;
      devs.forEach((d) => usedDevices.add(d));
    } else {
      skip("already_paid");
    }
  }
  result.reason = result.paid > 0 ? "paid" : "nobody_eligible";
  return result;
}

// Never throws; used from request handlers and the cron job.
export function awardTournamentCoinsSafe(tournamentId) {
  return awardTournamentCoins(tournamentId).catch((e) => {
    console.error("[tournamentCoins] failed for", tournamentId, e.message);
    return null;
  });
}

// Admin view: recent tournament payouts, grouped per tournament.
export async function recentTournamentPayouts(limit = 15) {
  const [rows] = await pool.query(
    `SELECT CAST(SUBSTRING_INDEX(l.ref_key, ':', -1) AS UNSIGNED) AS tournament_id,
            t.name, COUNT(*) AS players, SUM(l.delta) AS coins, MAX(l.created_at) AS paid_at,
            SUM(l.status = 'reversed') AS reversed
       FROM coin_ledger l LEFT JOIN tournaments t ON t.tournament_id = CAST(SUBSTRING_INDEX(l.ref_key, ':', -1) AS UNSIGNED)
      WHERE l.reason = 'tournament_attendance'
      GROUP BY tournament_id, t.name ORDER BY paid_at DESC LIMIT ?`,
    [limit]
  );
  return rows;
}
