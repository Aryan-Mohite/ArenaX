// src/jobs/tournamentStatusJob.js
//
// Automatically transitions tournament status based on start_date/end_date
// so nobody has to manually flip upcoming -> ongoing -> completed every day.
//
// Rules:
//   upcoming  -> ongoing    once start_date has passed
//   ongoing   -> completed  once end_date has passed
// 'cancelled' tournaments are never touched.

import cron from "node-cron";
import pool from "../config/db.js";

export async function autoUpdateTournamentStatuses() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const [startedResult] = await pool.query(
    `UPDATE tournaments
     SET status = 'ongoing'
     WHERE status = 'upcoming'
       AND start_date IS NOT NULL
       AND start_date <= ?`,
    [today]
  );

  const [endedResult] = await pool.query(
    `UPDATE tournaments
     SET status = 'completed'
     WHERE status = 'ongoing'
       AND end_date IS NOT NULL
       AND end_date <= ?`,
    [today]
  );

  const startedCount = startedResult.affectedRows || 0;
  const endedCount = endedResult.affectedRows || 0;

  if (startedCount || endedCount) {
    console.log(
      `[tournamentStatusJob] ${startedCount} tournament(s) -> ongoing, ${endedCount} -> completed`
    );
  }

  return { startedCount, endedCount };
}

/**
 * Registers the hourly cron job. Call once from server.js at startup.
 */
export function startTournamentStatusJob() {
  // Runs at minute 0 of every hour. Adjust the pattern if you'd rather it
  // run once a day, e.g. "0 3 * * *" for 3:00 AM server time.
  cron.schedule("0 * * * *", () => {
    autoUpdateTournamentStatuses().catch((err) => {
      console.error("[tournamentStatusJob] failed:", err.message);
    });
  });

  console.log("🕒 Tournament status auto-update job scheduled (hourly)");
}
