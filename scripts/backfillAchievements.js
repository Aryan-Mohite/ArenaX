// scripts/backfillAchievements.js
//
// One-time fix for achievements that show correct progress (e.g. "3/1") but
// are still Locked. That happens because achievement checks only fire on a
// NEW action (new post, new match, new team join) going forward — actions
// that already happened before this feature was deployed never triggered a
// check. This script walks every user's *current* real counts once and
// awards anything that's already been earned.
//
// Safe to re-run any time — checkAndAwardAchievements is idempotent
// (INSERT IGNORE + unique key), so already-awarded achievements are skipped.
//
// Usage:
//   node scripts/backfillAchievements.js

import "../src/config/env.js";
import pool from "../src/config/db.js";
import { checkAndAwardAchievements } from "../src/services/achievementService.js";

async function run() {
  console.log("Starting achievement backfill...\n");

  const [users] = await pool.query("SELECT user_id FROM users");
  console.log(`Found ${users.length} users`);

  const [streaks] = await pool.query(
    "SELECT user_id, current_streak FROM user_streaks"
  );
  const [posts] = await pool.query(
    "SELECT user_id, COUNT(*) AS count FROM community_posts GROUP BY user_id"
  );
  const [matches] = await pool.query(
    `SELECT user_id, COUNT(*) AS count FROM (
       SELECT user_a_id AS user_id FROM swipe_matches
       UNION ALL
       SELECT user_b_id AS user_id FROM swipe_matches
     ) m GROUP BY user_id`
  );
  const [teams] = await pool.query(
    "SELECT user_id, COUNT(*) AS count FROM team_members WHERE status = 'active' GROUP BY user_id"
  );

  const streakMap = Object.fromEntries(streaks.map((r) => [r.user_id, r.current_streak]));
  const postMap   = Object.fromEntries(posts.map((r) => [r.user_id, r.count]));
  const matchMap  = Object.fromEntries(matches.map((r) => [r.user_id, r.count]));
  const teamMap   = Object.fromEntries(teams.map((r) => [r.user_id, r.count]));

  let totalAwarded = 0;

  for (const { user_id } of users) {
    const streak     = streakMap[user_id] || 0;
    const postCount  = postMap[user_id]  || 0;
    const matchCount = matchMap[user_id] || 0;
    const teamCount  = teamMap[user_id]  || 0;

    const results = await Promise.all([
      streak     > 0 ? checkAndAwardAchievements(user_id, "login_streak", streak)     : [],
      postCount  > 0 ? checkAndAwardAchievements(user_id, "nexus_post",  postCount)   : [],
      matchCount > 0 ? checkAndAwardAchievements(user_id, "dna_match",   matchCount)  : [],
      teamCount  > 0 ? checkAndAwardAchievements(user_id, "team",       teamCount)    : [],
    ]);

    const awarded = results.flat();
    if (awarded.length > 0) {
      totalAwarded += awarded.length;
      console.log(`  User ${user_id}: awarded ${awarded.map((a) => a.name).join(", ")}`);
    }
  }

  console.log(`\nDone. ${totalAwarded} achievement(s) awarded across ${users.length} users.`);
  await pool.end();
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
