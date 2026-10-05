import crypto from "crypto";
import pool from "../config/db.js";

// Device / IP signals. Used ONLY to raise flags for an admin and to enforce two
// narrow rules (one cash redemption per device per month; no referral coins
// between accounts on the same device). IP is a weak signal (shared hostel or
// mobile-carrier addresses), so it never blocks anything on its own.

const DEVICE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidDeviceId = (v) => typeof v === "string" && DEVICE_RE.test(v);

function secret() {
  return process.env.SIGNAL_HASH_SECRET || process.env.JWT_SECRET || "arenax-signal-fallback";
}

// IPv4 as-is; IPv6 reduced to the /64 prefix (one household/device rotates the
// lower 64 bits freely). Strips the ::ffff: IPv4-mapped prefix.
export function normalizeIp(ip) {
  if (!ip || typeof ip !== "string") return null;
  let x = ip.trim().replace(/^::ffff:/i, "");
  if (x.includes(":")) {
    const parts = x.split(":");
    // expand "::" so the first four groups are well defined
    if (x.includes("::")) {
      const [h, t] = x.split("::");
      const head = h ? h.split(":") : [];
      const tail = t ? t.split(":") : [];
      const fill = Array(Math.max(0, 8 - head.length - tail.length)).fill("0");
      return [...head, ...fill, ...tail].slice(0, 4).map((g) => g.toLowerCase().padStart(4, "0")).join(":") + "::/64";
    }
    return parts.slice(0, 4).map((g) => g.toLowerCase().padStart(4, "0")).join(":") + "::/64";
  }
  return x;
}

export const hmac = (value) =>
  value ? crypto.createHmac("sha256", secret()).update(String(value)).digest("hex") : null;

export function signalFromReq(req) {
  const rawDevice = req.get ? req.get("x-device-id") : req.headers?.["x-device-id"];
  const ua = (req.get ? req.get("user-agent") : req.headers?.["user-agent"]) || "";
  return {
    ipHash: hmac(normalizeIp(req.ip)),
    deviceId: isValidDeviceId(rawDevice) ? rawDevice.toLowerCase() : null,
    uaHash: ua ? crypto.createHash("sha256").update(ua).digest("hex").slice(0, 16) : null,
  };
}

export async function recordSignal(userId, kind, req) {
  const { ipHash, deviceId, uaHash } = signalFromReq(req);
  if (!ipHash && !deviceId) return;
  await pool.query(
    "INSERT INTO user_signals (user_id, kind, ip_hash, device_id, ua_hash) VALUES (?, ?, ?, ?, ?)",
    [userId, kind, ipHash, deviceId, uaHash]
  );
}

// Fire-and-forget: never throws, never delays or breaks signup/login.
export function recordSignalSafe(userId, kind, req) {
  recordSignal(userId, kind, req).catch((e) => console.error("[signals] record failed:", e.message));
}

// Other accounts that have used any of this user's devices (strong signal).
export async function accountsSharingDevice(userId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT DISTINCT s2.user_id
       FROM user_signals s1
       JOIN user_signals s2 ON s2.device_id = s1.device_id AND s2.user_id <> s1.user_id
      WHERE s1.user_id = ? AND s1.device_id IS NOT NULL`,
    [userId]
  );
  return rows.map((r) => r.user_id);
}

export async function sharesDevice(a, b, conn = pool) {
  const [rows] = await conn.query(
    `SELECT 1 FROM user_signals s1 JOIN user_signals s2 ON s2.device_id = s1.device_id
      WHERE s1.user_id = ? AND s2.user_id = ? AND s1.device_id IS NOT NULL LIMIT 1`,
    [a, b]
  );
  return rows.length > 0;
}

// Batch version for the admin queue: user_id -> { shared_device, ip_signups }
//   shared_device : how many OTHER accounts used one of this user's devices
//   ip_signups    : how many OTHER accounts signed up from this user's signup IP
//                   within 7 days of this user's signup (a weak, noisy signal)
export async function signalSummaryFor(userIds) {
  const out = new Map(userIds.map((id) => [id, { shared_device: 0, ip_signups: 0 }]));
  if (!userIds.length) return out;

  const [dev] = await pool.query(
    `SELECT s1.user_id, COUNT(DISTINCT s2.user_id) AS n
       FROM user_signals s1
       JOIN user_signals s2 ON s2.device_id = s1.device_id AND s2.user_id <> s1.user_id
      WHERE s1.user_id IN (?) AND s1.device_id IS NOT NULL
      GROUP BY s1.user_id`,
    [userIds]
  );
  for (const r of dev) out.get(r.user_id).shared_device = Number(r.n);

  const [ip] = await pool.query(
    `SELECT s1.user_id, COUNT(DISTINCT s2.user_id) AS n
       FROM user_signals s1
       JOIN user_signals s2 ON s2.ip_hash = s1.ip_hash AND s2.kind = 'signup' AND s2.user_id <> s1.user_id
            AND s2.created_at BETWEEN DATE_SUB(s1.created_at, INTERVAL 7 DAY) AND DATE_ADD(s1.created_at, INTERVAL 7 DAY)
      WHERE s1.user_id IN (?) AND s1.kind = 'signup' AND s1.ip_hash IS NOT NULL
      GROUP BY s1.user_id`,
    [userIds]
  );
  for (const r of ip) out.get(r.user_id).ip_signups = Number(r.n);
  return out;
}

// Linked accounts for the admin ledger modal (usernames, never raw IPs).
export async function linkedAccountsFor(userId) {
  const [byDevice] = await pool.query(
    `SELECT u.user_id, u.username, u.status, COUNT(*) AS shared_sessions
       FROM user_signals s1
       JOIN user_signals s2 ON s2.device_id = s1.device_id AND s2.user_id <> s1.user_id
       JOIN users u ON u.user_id = s2.user_id
      WHERE s1.user_id = ? AND s1.device_id IS NOT NULL
      GROUP BY u.user_id, u.username, u.status ORDER BY shared_sessions DESC LIMIT 25`,
    [userId]
  );
  const [bySignupIp] = await pool.query(
    `SELECT u.user_id, u.username, u.status
       FROM user_signals s1
       JOIN user_signals s2 ON s2.ip_hash = s1.ip_hash AND s2.kind = 'signup' AND s2.user_id <> s1.user_id
       JOIN users u ON u.user_id = s2.user_id
      WHERE s1.user_id = ? AND s1.kind = 'signup' AND s1.ip_hash IS NOT NULL
      GROUP BY u.user_id, u.username, u.status LIMIT 25`,
    [userId]
  );
  return { same_device: byDevice, same_signup_ip: bySignupIp };
}

export async function purgeOldSignals(days = 90) {
  const [r] = await pool.query(
    "DELETE FROM user_signals WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
    [Math.max(1, Number(days) || 90)]
  );
  return r.affectedRows;
}
