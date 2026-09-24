import { Router } from "express";
import {
  getTeamMessages,  sendTeamMessage,  deleteTeamMessage,  markTeamRead,
  getDmMessages,    sendDmMessage,    deleteDmMessage,    markDmRead,
  getSwipeMessages, sendSwipeMessage, deleteSwipeMessage, markSwipeRead,
  getUnreadCounts,
} from "../controllers/chatController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// All chat routes require authentication
router.use(authMiddleware);

// Unread badge counts (lightweight — poll every 30s)
router.get("/unread", getUnreadCounts);

// Team group chat
router.get("/team/:teamId/messages", getTeamMessages);
router.post("/team/:teamId/messages", sendTeamMessage);
router.delete("/team/:teamId/messages/:messageId", deleteTeamMessage);
router.put("/team/:teamId/read",     markTeamRead);

// DM (draft-accept) chat
router.get("/dm/:appId/messages", getDmMessages);
router.post("/dm/:appId/messages", sendDmMessage);
router.delete("/dm/:appId/messages/:messageId", deleteDmMessage);
router.put("/dm/:appId/read",     markDmRead);

// Swipe-match chat (opens automatically on a mutual Gamer DNA match)
router.get("/swipe/:matchId/messages", getSwipeMessages);
router.post("/swipe/:matchId/messages", sendSwipeMessage);
router.delete("/swipe/:matchId/messages/:messageId", deleteSwipeMessage);
router.put("/swipe/:matchId/read",     markSwipeRead);

export default router;
