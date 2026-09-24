import { Router } from "express";
import {
  getPlans,
  createOrder,
  verifyPayment,
  handleWebhook,
  cancelSubscription,
  getMySubscription,
} from "../controllers/paymentController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { body } from "express-validator";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

// ─── Public ─────────────────────────────────────────────────────────────────
router.get("/plans", getPlans);

// Razorpay calls this directly — no auth, verified via HMAC signature instead.
router.post("/webhook", handleWebhook);

// ─── Authenticated ──────────────────────────────────────────────────────────
router.post(
  "/orders",
  authMiddleware,
  [body("plan_id").isInt({ min: 1 })],
  validate,
  createOrder
);

router.post(
  "/verify",
  authMiddleware,
  [
    body("razorpay_order_id").isString().notEmpty(),
    body("razorpay_payment_id").isString().notEmpty(),
    body("razorpay_signature").isString().notEmpty(),
  ],
  validate,
  verifyPayment
);

router.get("/subscription", authMiddleware, getMySubscription);
router.post("/cancel", authMiddleware, cancelSubscription);

export default router;
