import { verifyToken } from "../utils/jwt.js";
import pool from "../config/db.js";

/**
 * Protects routes by verifying the Bearer JWT in Authorization header.
 * Also checks that the user_id in the token still exists in the DB —
 * prevents stale tokens (e.g. after a DB wipe) from causing FK errors downstream.
 * On success, attaches decoded payload to req.user.
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

    // Guard: make sure this user_id still exists in the DB.
    // Catches stale tokens after a DB reset / migration without spamming FK errors.
    const userCheck = await pool.query(
      "SELECT user_id FROM users WHERE user_id = $1 AND status != 'banned'",
      [decoded.id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Session expired — please log in again",
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