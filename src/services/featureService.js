import pool from "../config/db.js";

// ─── hasFeature ─────────────────────────────────────────────────────────────
// The single choke point every gated route/component checks — per the
// roadmap, this is what makes tiering enforceable instead of scattered
// ad-hoc `if (user.plan === 'pro')` checks sprinkled across controllers.
//
// A user "has" a feature if any of their active, non-expired subscriptions
// points at a plan whose feature_flags[featureKey] === true.
export async function hasFeature(userId, featureKey) {
  if (!userId || !featureKey) return false;

  const [rows] = await pool.query(
    `SELECT p.feature_flags
       FROM subscriptions s
       JOIN plans p ON p.plan_id = s.plan_id
      WHERE s.user_id = ?
        AND s.status = 'active'
        AND (s.renews_at IS NULL OR s.renews_at >= NOW())`,
    [userId]
  );

  return rows.some((row) => {
    // mysql2 auto-parses JSON columns, but guard against a raw string
    // in case the driver config or a manual query ever returns one.
    const flags =
      typeof row.feature_flags === "string"
        ? JSON.parse(row.feature_flags)
        : row.feature_flags;
    return flags?.[featureKey] === true;
  });
}

// ─── requireFeature middleware ─────────────────────────────────────────────
// Usage: router.post("/tournaments/:id/announce", authMiddleware, requireFeature("announcements"), ...)
// Must run after authMiddleware (needs req.user.id).
export function requireFeature(featureKey) {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, message: "Login required" });
      }

      const allowed = await hasFeature(req.user.id, featureKey);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: `This requires a plan with '${featureKey}' access.`,
          upgradeRequired: true,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
