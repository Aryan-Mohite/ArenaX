import { verifyToken } from "../utils/jwt.js";
import pool from "../config/db.js";

/**
 * Protects routes by verifying the Bearer JWT in Authorization header.
 *
 * FIX (medium): Changed WHERE status != 'banned' → status = 'active'.
 * Previously, deleted accounts (status = 'deleted') could still authenticate
 * because 'deleted' != 'banned' is true. Now only explicitly active users pass.
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

    // FIX: was "status != 'banned'" — deleted, suspended, or any non-active
    // user could still authenticate. Now only status = 'active' passes.
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
