import "./src/config/env.js";
import http from "http";
import cron from "node-cron";
import app from "./src/app.js";
import pool from "./src/config/db.js";
import { startTournamentStatusJob } from "./src/jobs/tournamentStatusJob.js";
import { syncFeaturedTournaments } from "./src/jobs/pandaScoreSyncJob.js";

// ─── Required environment variable guard ──────────────────────────────────────
const REQUIRED_ENV = ["DB_USER", "DB_HOST", "DB_NAME", "DB_PASSWORD", "JWT_SECRET"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`⚠️  Missing environment variables: ${missing.join(", ")} — check hPanel Node.js env vars`);
  // Log warning but do NOT exit — allows /health to respond so you can debug via browser
}

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`✅ ArenaX server running on port ${PORT} [${process.env.NODE_ENV}]`);

  // ── Background automation ────────────────────────────────────────────────
  // 1. Hourly: flip tournament status (upcoming/ongoing/completed) based on dates.
  startTournamentStatusJob();

  // 2. Daily at 3:00 AM server time: pull fresh featured tournaments from
  //    PandaScore so the tournament page stays populated without manual entry.
  //    Requires PANDASCORE_API_KEY in .env — skips quietly if not set.
  if (process.env.PANDASCORE_API_KEY) {
    cron.schedule("0 3 * * *", () => {
      syncFeaturedTournaments().catch((err) =>
        console.error("[pandaScoreSync] scheduled run failed:", err.message)
      );
    });
    console.log("🕒 Featured tournament sync job scheduled (daily @ 3AM)");
    // Run once at boot too, so new deploys see data immediately rather than
    // waiting for the next 3AM slot.
    syncFeaturedTournaments().catch((err) =>
      console.error("[pandaScoreSync] initial run failed:", err.message)
    );
  } else {
    console.log("ℹ️  PANDASCORE_API_KEY not set — featured tournament sync disabled");
  }
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    console.log("HTTP server closed.");
    try {
      await pool.end();
      console.log("DB pool closed.");
    } catch (err) {
      console.error("Error closing DB pool:", err.message);
    }
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
