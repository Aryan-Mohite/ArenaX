import express from "express";
import { registerUser, loginUser } from "../Controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateRegister } from "../middleware/validateMiddleware.js";

const router = express.Router();

router.post("/register", validateRegister, registerUser);
router.post("/login", loginUser);
router.post("/", protect, createTournament);

export default router;