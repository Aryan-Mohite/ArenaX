import cron from "node-cron";
import { runCoinMaintenance } from "../services/coinOpsService.js";

/**
 * Nightly coin housekeeping: vest/reverse due pending coins, expire old coins
 * (only when an admin sets coin_expiry_days > 0), and log anything that looks
 * wrong in the ledger. Call once from server.js at startup.
 */
export function startCoinMaintenanceJob() {
  // 03:15 server time -- offset from the 03:00 pandaScore sync and the 00:30 rollup.
  cron.schedule("15 3 * * *", () => {
    runCoinMaintenance()
      .then((r) => console.log("[coinMaintenanceJob]", JSON.stringify(r)))
      .catch((err) => console.error("[coinMaintenanceJob] failed:", err.message));
  });
  console.log("✅ Coin maintenance job scheduled (03:15 daily)");
}
