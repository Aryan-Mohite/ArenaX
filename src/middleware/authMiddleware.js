import { verifyToken } from "../utils/jwt.js";
import pool, { isAuthCacheHit, setAuthCache } from "../config/db.js";

/**
 * Protects routes by verifying the Bearer JWT in Authorization header.
 *
 * Security: WHERE status = 'active' — only explicitly active users pass.
 * Deleted, banned, and suspended accounts are all rejected.
 *
 * Performance (FIX LAG-3): results are cached in the in-memory auth cache
 * (defined in db.js) for 60 seconds so the DB is not hit on every request.
 * Banning/deleting a user calls invalidateAuthCache(userId) for instant eviction.
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided. Authorization header must be: Bearer <token>",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);

    // FIX LAG-3: Check the in-memory cache first.
    // Cache hit → skip DB query entirely (fastest path, ~95% of requests).
    // Cache miss → query DB, then prime the cache on success.
    if (!isAuthCacheHit(decoded.id)) {
      const [rows] = await pool.query(
        "SELECT user_id FROM users WHERE user_id = ? AND status = 'active'",
        [decoded.id]
      );

      if (rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: "Session expired or account inactive — please log in again",
        });
      }

      // Prime cache only for active users.
      setAuthCache(decoded.id);
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token has expired" });
    }
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

export default authMiddleware;