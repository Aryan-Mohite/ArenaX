import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     Number(process.env.DB_PORT) || 3306,

  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         100,
  connectTimeout:     10000,

  timezone:           "+00:00",
  dateStrings:        false,
  supportBigNumbers:  true,
  bigNumberStrings:   false,
  enableKeepAlive:    true,

  typeCast(field, next) {
    if (field.type === "TINY" && field.length === 1) {
      return field.string() === "1";
    }
    return next();
  },
});

// ─── AUTH STATUS CACHE ────────────────────────────────────────────────────────
const AUTH_CACHE_TTL_MS = 60_000;

const authCache = new Map();

export function isAuthCacheHit(userId) {
  const entry = authCache.get(userId);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    authCache.delete(userId);
    return false;
  }
  return true;
}

export function setAuthCache(userId) {
  authCache.set(userId, { expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
}

export function invalidateAuthCache(userId) {
  authCache.delete(userId);
}

// Sweep expired entries every 5 minutes to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [uid, entry] of authCache) {
    if (now > entry.expiresAt) authCache.delete(uid);
  }
}, 5 * 60_000);

// ─── CONNECTION WITH RETRY ────────────────────────────────────────────────────
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
        // Do NOT exit — server stays alive so /health endpoint can report status
        return;
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