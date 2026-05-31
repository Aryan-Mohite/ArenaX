import mysql from "mysql2/promise";

// Guard: catch placeholder values left from the template .env
// so the error message is clear, not a cryptic ECONNREFUSED
const PLACEHOLDERS = ["CHANGE_ME", "CHANGE_ME_USE_openssl_rand_hex_64", ""];
const required = { DB_USER: process.env.DB_USER, DB_HOST: process.env.DB_HOST, DB_PASSWORD: process.env.DB_PASSWORD };
for (const [key, val] of Object.entries(required)) {
  if (!val || PLACEHOLDERS.some(p => val.startsWith(p))) {
    console.error(`❌ ${key} is not set in .env — open backend/.env and fill in your real database credentials.`);
    process.exit(1);
  }
}

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     Number(process.env.DB_PORT) || 3306,

  waitForConnections: true,
  connectionLimit:    20,
  // FIX M4: queueLimit was 0 (unbounded). Now capped at 100 — excess requests
  // fail fast instead of piling up in memory under a traffic spike.
  queueLimit:         100,
  connectTimeout:     10000,

  timezone:           "+00:00",
  dateStrings:        false,
  supportBigNumbers:  true,
  bigNumberStrings:   false,
  enableKeepAlive:    true,
  keepAliveInitDelay: 10000,
});

const connectWithRetry = async (retries = 3, delayMs = 2000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await pool.getConnection();
      conn.release();
      console.log("✅ MySQL connected successfully");
      return;
    } catch (err) {
      console.error(`❌ DB connection attempt ${i}/${retries} failed: ${err.message}`);
      if (i === retries) {
        console.error("All DB connection attempts exhausted. Check DB_HOST, DB_USER, DB_PASSWORD in .env");
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, delayMs * i));
    }
  }
};

connectWithRetry();

pool.on("error", (err) => {
  console.error("Unexpected DB pool error:", err.message);
});

export default pool;
