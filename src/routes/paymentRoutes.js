import { Router } from "express";
import {
  getPlans,
  createOrder,
  verifyPayment,
  handleWebhook,
  cancelSubscription,
  getMySubscription,
  disputePayment,
} from "../controllers/paymentController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { body, param } from "express-validator";
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

// §9: refund/dispute path
router.post(
  "/:paymentId/dispute",
  authMiddleware,
  [
    param("paymentId").isInt({ min: 1 }),
    body("reason").trim().notEmpty().withMessage("A reason is required").isLength({ max: 1000 }),
  ],
  validate,
  disputePayment
);

export default router;
