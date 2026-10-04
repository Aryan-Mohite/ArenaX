// Prints any ledger anomalies and exits non-zero if there are some.
//   node scripts/reconcileCoins.js
import "../src/config/env.js";
import pool from "../src/config/db.js";
import { findCoinAnomalies } from "../src/services/coinOpsService.js";

const a = await findCoinAnomalies();
console.log(JSON.stringify(a, null, 2));
await pool.end();
process.exit(a.total > 0 ? 1 : 0);
