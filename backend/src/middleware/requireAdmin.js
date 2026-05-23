/**
 * Middleware: enforces that the authenticated user has admin privileges.
 * Must be used AFTER authMiddleware (which populates req.user).
 * Centralises the isAdmin check so handlers don't each need to repeat it.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
};

export default requireAdmin;
