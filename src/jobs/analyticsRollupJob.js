// src/jobs/analyticsRollupJob.js
//
// Nightly rollup of the previous day's activity from `events` (plus
// `users` for signups) into `analytics_daily_rollup`, so the admin
// analytics dashboard's trend chart never has to re-scan the full,
// ever-growing `events` table. Mirrors tournamentStatusJob.js: a plain
// exported function for the actual work (testable/runnable standalone)
// plus a `start*Job()` that registers the cron schedule, called once from
// server.js at boot.

import cron from "node-cron";
import pool from "../config/db.js";

// Computes (or re-computes) the rollup row for a single calendar date.
// Exported separately from the "run for yesterday" wrapper below so a gap
// (e.g. the server was down overnight) can be backfilled manually.
export async function computeDailyRollup(dateStr) {
  const [
    [{ signups }],
    [{ logins }],
    [{ tournament_registrations }],
    [{ teams_created }],
    [{ community_posts }],
  ] = await Promise.all([
    pool.query("SELECT COUNT(*) AS signups FROM users WHERE DATE(created_at) = ?", [dateStr]).then(r => r[0]),
    pool.query(
      "SELECT COUNT(DISTINCT user_id) AS logins FROM events WHERE event_type = 'login' AND DATE(created_at) = ?",
      [dateStr]
    ).then(r => r[0]),
    pool.query(
      "SELECT COUNT(*) AS tournament_registrations FROM events WHERE event_type = 'tournament_registration' AND DATE(created_at) = ?",
      [dateStr]
    ).then(r => r[0]),
    pool.query(
      "SELECT COUNT(*) AS teams_created FROM events WHERE event_type = 'team_created' AND DATE(created_at) = ?",
      [dateStr]
    ).then(r => r[0]),
    pool.query(
      "SELECT COUNT(*) AS community_posts FROM events WHERE event_type = 'community_post' AND DATE(created_at) = ?",
      [dateStr]
    ).then(r => r[0]),
  ]);

  await pool.query(
    `INSERT INTO analytics_daily_rollup
       (rollup_date, signups, logins, tournament_registrations, teams_created, community_posts, computed_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       signups = VALUES(signups),
       logins = VALUES(logins),
       tournament_registrations = VALUES(tournament_registrations),
       teams_created = VALUES(teams_created),
       community_posts = VALUES(community_posts),
       computed_at = NOW()`,
    [dateStr, signups, logins, tournament_registrations, teams_created, community_posts]
  );

  return { rollup_date: dateStr, signups, logins, tournament_registrations, teams_created, community_posts };
}

// Rolls up "yesterday" (server local time) — the day just fully completed
// at the time this normally runs (00:30, see startAnalyticsRollupJob below).
export async function runDailyRollup() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const result = await computeDailyRollup(yesterday);
  console.log(
    `[analyticsRollupJob] ${result.rollup_date}: ${result.signups} signups, ${result.logins} DAU, ` +
    `${result.tournament_registrations} tournament regs, ${result.teams_created} teams, ${result.community_posts} posts`
  );
  return result;
}

/**
 * Registers the nightly cron job. Call once from server.js at startup.
 */
export function startAnalyticsRollupJob() {
  // 00:30 server time — after midnight so "yesterday" is fully closed out,
  // offset from tournamentStatusJob's on-the-hour schedule and
  // pandaScoreSyncJob's 3 AM slot so they don't all fire at once.
  cron.schedule("30 0 * * *", () => {
    runDailyRollup().catch((err) => {
      console.error("[analyticsRollupJob] failed:", err.message);
    });
  });

  console.log("🕒 Analytics daily rollup job scheduled (00:30 daily)");
}
