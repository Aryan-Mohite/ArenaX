import { Router } from "express";
import { sendMessage, getConversation, getInbox } from "../controllers/messageController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateSendMessage } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import { param } from "express-validator";

const router = Router();

// All message routes require auth
router.use(authMiddleware);

// GET /api/messages/inbox
router.get("/inbox", getInbox);

// GET /api/messages/:user_id
router.get(
  "/:user_id",
  [param("user_id").isInt({ min: 1 })],
  validate,
  getConversation
);

// POST /api/messages
router.post("/", validateSendMessage, validate, sendMessage);

export default router;
