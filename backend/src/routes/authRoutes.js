import { Router } from "express";
import { register, login, getMe } from "../controllers/authController.js";
import { validateRegister, validateLogin } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// POST /api/auth/register
router.post("/register", validateRegister, validate, register);

// POST /api/auth/login
router.post("/login", validateLogin, validate, login);

// GET /api/auth/me  — requires token
router.get("/me", authMiddleware, getMe);

export default router;
