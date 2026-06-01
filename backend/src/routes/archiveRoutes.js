/**
 * archiveRoutes.js
 * FIX C2: Replaced unsafe inline isAdmin (JWT-trusted) with requireAdmin middleware
 *         that does a live DB check against ADMIN_EMAILS — consistent with all other
 *         admin routes in the system.
 */

import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requireAdmin   from "../middleware/requireAdmin.js";
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

// =============================================================================
// Archive-aware DELETE routes (replace originals in tournament/team/etc. routes)
// =============================================================================

router.delete("/tournaments/:id",      authMiddleware, deleteTournament);
router.delete("/teams/:id",            authMiddleware, deleteTeam);
router.delete("/streams/:id",          authMiddleware, deleteStream);
router.delete("/community/posts/:id",  authMiddleware, deleteCommunityPost);
router.delete("/teamfinder/posts/:id", authMiddleware, deleteTeamFinderPost);
router.delete("/users/me",             authMiddleware, softDeleteMyAccount);

// =============================================================================
// Admin — archive management
// FIX C2: requireAdmin performs live DB lookup (ADMIN_EMAILS check) — not JWT-trusted
// =============================================================================

router.get("/admin/archives",                         authMiddleware, requireAdmin, listArchives);
router.get("/admin/archives/audit",                   authMiddleware, requireAdmin, getAuditLog);
router.get("/admin/archives/:entity/:id",             authMiddleware, requireAdmin, getArchivedItem);
router.post("/admin/archives/restore/tournament/:id", authMiddleware, requireAdmin, restoreTournament);
router.post("/admin/archives/restore/team/:id",       authMiddleware, requireAdmin, restoreTeam);
router.post("/admin/archives/restore/stream/:id",     authMiddleware, requireAdmin, restoreStream);
router.delete("/admin/archives/purge",                authMiddleware, requireAdmin, purgeOldArchives);

export default router;
