import { Router } from "express";
import {
  sendRegisterOtp,
  verifyRegisterOtp,
  resendRegisterOtp,
  login,
  getMe,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} from "../controllers/authController.js";
import {
  validateRegister,
  validateLogin,
  validateVerifyRegisterOtp,
  validateResendOtp,
  validateResetPassword,
  validateForgotPassword,
  validateVerifyResetOtp,
} from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// ─── Registration (2-step: send OTP → verify OTP) ─────────────────────────────
router.post("/register/send-otp",   validateRegister,          validate, sendRegisterOtp);
// FIX (medium): was calling validate with no schema — any OTP string reached compareOtp
router.post("/register/verify",     validateVerifyRegisterOtp, validate, verifyRegisterOtp);
// FIX (high): added email validator for resend route
router.post("/register/resend-otp", validateResendOtp,         validate, resendRegisterOtp);

// ─── Login ────────────────────────────────────────────────────────────────────
router.post("/login", validateLogin, validate, login);

// ─── Current user ─────────────────────────────────────────────────────────────
router.get("/me", authMiddleware, getMe);

// ─── Forgot / reset password (3-step: send OTP → verify OTP → set password) ──
router.post("/forgot-password",        validateForgotPassword,   validate, forgotPassword);
router.post("/forgot-password/verify", validateVerifyResetOtp,   validate, verifyResetOtp);
router.post("/forgot-password/reset",  validateResetPassword,    validate, resetPassword);

export default router;
