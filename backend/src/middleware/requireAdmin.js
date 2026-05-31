import pool from "../config/db.js";

/**
 * Middleware: enforces that the authenticated user has admin privileges.
 * Must be used AFTER authMiddleware (which populates req.user).
 *
 * FIX (critical): previously trusted req.user.isAdmin from the JWT payload alone.
 * A forged or leaked token with isAdmin:true would grant full admin access.
 * Now we perform a live DB check — re-verifying the email against ADMIN_EMAILS.
 * This also ensures that removing an email from ADMIN_EMAILS takes effect
 * immediately, even for users with an existing valid token.
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const [rows] = await pool.query(
      "SELECT email FROM users WHERE user_id = ? AND status = 'active'",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!adminEmails.includes(rows[0].email.toLowerCase())) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    // Attach verified isAdmin flag so downstream handlers can rely on it
    req.user.isAdmin = true;
    next();
  } catch (err) {
    next(err);
  }
};

export default requireAdmin;
