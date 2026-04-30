/**
 * archiveRoutes.js
 * Place at: src/routes/archiveRoutes.js
 *
 * Uses the same authMiddleware default import pattern as all other route files.
 * Admin check is done inline (req.user.isAdmin) — no separate middleware needed.
 *
 * Register in src/app.js:
 *   import archiveRoutes from "./routes/archiveRoutes.js";
 *   app.use("/api/archive", archiveRoutes);
 */

import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  deleteTournament,
  deleteTeam,
  deleteStream,
  deleteCommunityPost,
  deleteTeamFinderPost,
  softDeleteMyAccount,
  listArchives,
  getArchivedItem,
  restoreTournament,
  restoreTeam,
  restoreStream,
  getAuditLog,
  purgeOldArchives,
} from "../controllers/archiveController.js";

const router = Router();

// ─── Inline admin guard (no separate middleware file needed) ──────────────────
const isAdmin = (req, res, next) => {
  if (!req.user?.isAdmin)
    return res.status(403).json({ success: false, message: "Admin access required" });
  next();
};

// =============================================================================
// Archive-aware DELETE routes
// These REPLACE the existing DELETE routes in tournament/team/stream/community/
// teamfinder/user route files. You can either:
//   A) Keep them here and remove the old DELETE routes from the other files, OR
//   B) Move just the handler imports into the existing route files.
// Option A (keeping here) is simpler.
// =============================================================================

router.delete("/tournaments/:id",      authMiddleware, deleteTournament);
router.delete("/teams/:id",            authMiddleware, deleteTeam);
router.delete("/streams/:id",          authMiddleware, deleteStream);
router.delete("/community/posts/:id",  authMiddleware, deleteCommunityPost);
router.delete("/teamfinder/posts/:id", authMiddleware, deleteTeamFinderPost);
router.delete("/users/me",             authMiddleware, softDeleteMyAccount);

// =============================================================================
// Admin — archive management
// =============================================================================

router.get("/admin/archives",                         authMiddleware, isAdmin, listArchives);
router.get("/admin/archives/audit",                   authMiddleware, isAdmin, getAuditLog);
router.get("/admin/archives/:entity/:id",             authMiddleware, isAdmin, getArchivedItem);
router.post("/admin/archives/restore/tournament/:id", authMiddleware, isAdmin, restoreTournament);
router.post("/admin/archives/restore/team/:id",       authMiddleware, isAdmin, restoreTeam);
router.post("/admin/archives/restore/stream/:id",     authMiddleware, isAdmin, restoreStream);
router.delete("/admin/archives/purge",                authMiddleware, isAdmin, purgeOldArchives);

export default router;