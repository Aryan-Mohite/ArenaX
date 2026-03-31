import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
  // Connection pool settings
  max: 20,                // max pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Verify connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Failed to connect to PostgreSQL:", err.message);
    process.exit(1);
  }
  release();
  console.log("✅ PostgreSQL connected successfully");
});

// Log unexpected pool errors (don't crash the process)
pool.on("error", (err) => {
  console.error("Unexpected DB pool error:", err.message);
});

export default pool;
