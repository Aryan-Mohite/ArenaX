// Shared fixtures for the integration tests. These run against a REAL MySQL /
// MariaDB database that already has the schema + migrations applied.
//
// SAFETY: the tests wipe users, ledger, redemptions etc. between cases, so the
// whole suite refuses to run unless DB_NAME ends in "_test".
//
// Run:  DB_HOST=127.0.0.1 DB_USER=... DB_PASSWORD=... DB_NAME=arenax_test npm test
export const dbConfigured =
  !!process.env.DB_HOST && !!process.env.DB_USER && !!process.env.DB_NAME;

export const dbIsSafe = dbConfigured && /_test$/.test(process.env.DB_NAME);

export const skipReason = !dbConfigured
  ? "DB_HOST / DB_USER / DB_NAME not set; skipping DB integration tests"
  : !dbIsSafe
  ? `DB_NAME "${process.env.DB_NAME}" does not end in _test; refusing to run destructive tests`
  : false;

let _pool;
export async function getPool() {
  if (!_pool) _pool = (await import("../src/config/db.js")).default;
  return _pool;
}

let seq = 0;

// Wipes everything the tests touch. coin_settings is emptied on purpose:
// getSettings() falls back to the built-in DEFAULTS when a row is absent.
export async function resetDb() {
  const pool = await getPool();
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of [
    "redemption_disputes", "team_finder_boosts", "team_finder_posts", "user_streaks", "coin_ledger", "referral_rewards", "community_posts", "redemptions", "subscriptions", "team_members", "teams",
    "user_game_profile", "coin_settings_audit", "coin_settings", "events", "payment_disputes", "payments", "users",
  ]) {
    await pool.query(`DELETE FROM ${t}`);
  }
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  await pool.query("UPDATE reward_catalog SET stock = NULL");
}

export async function createUser(o = {}) {
  const pool = await getPool();
  seq += 1;
  const days = o.ageDays ?? 30;
  const [r] = await pool.query(
    `INSERT INTO users (username, email, password_hash, email_verified, status, bio, profile_picture, created_at)
     VALUES (?, ?, 'x', ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
    [
      o.username || `tester${seq}`, `tester${seq}@example.test`,
      o.verified === false ? 0 : 1, o.status || "active",
      o.bio ?? null, o.picture ?? null, days,
    ]
  );
  return r.insertId;
}

// Puts coins on an account without going through the earn rules.
export async function giveCoins(userId, amount, key = `seed:${++seq}`) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO coin_ledger (user_id, delta, reason, ref_key, status)
     VALUES (?, ?, 'admin_adjust', ?, 'available')`,
    [userId, amount, key]
  );
}

export async function setSetting(key, value, adminId = null) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO coin_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, String(value), adminId]
  );
}

export async function makePro(userId, days = 30) {
  const pool = await getPool();
  const [[plan]] = await pool.query("SELECT plan_id FROM plans WHERE plan_key = 'gamer_pro'");
  await pool.query(
    `INSERT INTO subscriptions (user_id, plan_id, status, renews_at, gateway)
     VALUES (?, ?, 'active', DATE_ADD(NOW(), INTERVAL ? DAY), 'test')`,
    [userId, plan.plan_id, days]
  );
}

export async function rewardId(name) {
  const pool = await getPool();
  const [[r]] = await pool.query("SELECT reward_id FROM reward_catalog WHERE name LIKE ? LIMIT 1", [`%${name}%`]);
  return r.reward_id;
}

export async function ledgerRows(userId, where = "1=1") {
  const pool = await getPool();
  const [rows] = await pool.query(
    `SELECT * FROM coin_ledger WHERE user_id = ? AND ${where} ORDER BY entry_id`, [userId]
  );
  return rows;
}

// Fake Express res for calling controllers directly.
export function mockRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

export async function giftCardId(inr) {
  const pool = await getPool();
  const [[r]] = await pool.query(
    "SELECT reward_id FROM reward_catalog WHERE type = 'gift_card' AND inr_value = ? LIMIT 1", [inr]
  );
  return r.reward_id;
}

export async function proDaysId(days) {
  const pool = await getPool();
  const [[r]] = await pool.query(
    "SELECT reward_id FROM reward_catalog WHERE type = 'pro_days' AND pro_days = ? LIMIT 1", [days]
  );
  return r.reward_id;
}
