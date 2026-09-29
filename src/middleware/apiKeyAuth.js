import crypto from "crypto";
import pool from "../config/db.js";
import { hasFeature } from "../services/featureService.js";

export const hashApiKey = (raw) =>
  crypto.createHash("sha256").update(raw).digest("hex");

/**
 * Authenticates read-only public API requests (/api/v1/*).
 * Key is sent as `X-API-Key: axk_…` or `Authorization: Bearer axk_…`.
 *
 * The owner must STILL hold the `api_access` feature — downgrading off the
 * Organization tier disables their keys without needing to delete them.
 */
const apiKeyAuth = async (req, res, next) => {
  try {
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null;
    const raw = req.headers["x-api-key"] || bearer;

    if (!raw || typeof raw !== "string" || !raw.startsWith("axk_")) {
      return res.status(401).json({ success: false, message: "Missing or malformed API key" });
    }

    const [[key]] = await pool.query(
      `SELECT k.key_id, k.user_id, k.last_used_at
         FROM organizer_api_keys k
         JOIN users u ON u.user_id = k.user_id AND u.status = 'active'
        WHERE k.key_hash = ? AND k.revoked_at IS NULL`,
      [hashApiKey(raw)]
    );
    if (!key) {
      return res.status(401).json({ success: false, message: "Invalid or revoked API key" });
    }

    if (!(await hasFeature(key.user_id, "api_access"))) {
      return res.status(403).json({
        success: false,
        message: "This key's owner no longer has API access (Organization plan required).",
      });
    }

    // Throttle the bookkeeping write — at most once per 5 minutes per key.
    const stale = !key.last_used_at || Date.now() - new Date(key.last_used_at).getTime() > 5 * 60 * 1000;
    if (stale) {
      pool.query("UPDATE organizer_api_keys SET last_used_at = NOW() WHERE key_id = ?", [key.key_id])
        .catch(() => {});
    }

    req.apiUser = { id: key.user_id, keyId: key.key_id };
    next();
  } catch (err) { next(err); }
};

export default apiKeyAuth;
