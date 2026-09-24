import pool from "../config/db.js";
import {
  createOrder as createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "../services/razorpayService.js";

// ─── GET PLANS ──────────────────────────────────────────────────────────────
// GET /api/payments/plans — public, powers every upgrade screen (organizer
// tiers, gamer pro, and later college licenses — all read from the same
// `plans` table).
export const getPlans = async (req, res, next) => {
  try {
    const [plans] = await pool.query(
      "SELECT plan_id, plan_key, name, description, price, currency, billing_cycle, feature_flags FROM plans WHERE is_active = TRUE ORDER BY price ASC"
    );
    res.json({ success: true, plans });
  } catch (err) {
    next(err);
  }
};

// ─── CREATE ORDER ───────────────────────────────────────────────────────────
// POST /api/payments/orders  { plan_id }
// Creates a Razorpay order for the plan's price and a `payments` row in
// 'created' status (carrying plan_id, so the webhook can activate the
// subscription on its own later without depending on anything else).
export const createOrder = async (req, res, next) => {
  try {
    const { plan_id } = req.body;
    if (!plan_id) {
      return res.status(400).json({ success: false, message: "plan_id is required" });
    }

    const [planRows] = await pool.query(
      "SELECT * FROM plans WHERE plan_id = ? AND is_active = TRUE",
      [plan_id]
    );
    if (!planRows.length) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }
    const plan = planRows[0];

    if (Number(plan.price) <= 0) {
      return res.status(400).json({ success: false, message: "This plan is free — no payment needed" });
    }

    const order = await createRazorpayOrder({
      amount: Number(plan.price),
      currency: plan.currency,
      receipt: `plan_${plan.plan_id}_user_${req.user.id}_${Date.now()}`,
    });

    await pool.query(
      `INSERT INTO payments (user_id, plan_id, gateway, gateway_order_id, amount, currency, status)
       VALUES (?, ?, 'razorpay', ?, ?, ?, 'created')`,
      [req.user.id, plan.plan_id, order.id, plan.price, plan.currency]
    );

    res.json({
      success: true,
      order: { id: order.id, amount: order.amount, currency: order.currency },
      plan: { plan_id: plan.plan_id, plan_key: plan.plan_key, name: plan.name },
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    next(err);
  }
};

// ─── VERIFY PAYMENT (checkout-flow callback) ───────────────────────────────
// POST /api/payments/verify  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// UX fast-path so the frontend can show "you're upgraded" immediately,
// without waiting on the webhook. The webhook is still the source of truth
// and safely no-ops here if it already activated the same order first.
export const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ success: false, message: "Missing payment verification fields" });
    }

    if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
      return res.status(400).json({ success: false, message: "Payment signature verification failed" });
    }

    const [rows] = await pool.query(
      "SELECT * FROM payments WHERE gateway = 'razorpay' AND gateway_order_id = ? AND user_id = ?",
      [orderId, req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    await activateFromPayment(rows[0], paymentId);
    res.json({ success: true, message: "Payment verified and plan activated" });
  } catch (err) {
    next(err);
  }
};

// ─── WEBHOOK ────────────────────────────────────────────────────────────────
// POST /api/payments/webhook — no auth, called by Razorpay directly.
// Source of truth for payment state: activates the subscription even if the
// user closed their browser before the checkout callback fired.
export const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!signature || !req.rawBody) {
      return res.status(400).json({ success: false, message: "Missing signature" });
    }

    if (!verifyWebhookSignature({ rawBody: req.rawBody, signature })) {
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    // Ack fast — Razorpay retries on non-2xx/timeout. Any non-critical side
    // effect added later (e.g. a receipt email) should follow the existing
    // fire-and-forget pattern used for chat pruning, not block this response.
    res.status(200).json({ success: true });

    const event = req.body.event;
    const payload = req.body.payload?.payment?.entity;
    if (!payload?.order_id) return;

    const [rows] = await pool.query(
      "SELECT * FROM payments WHERE gateway = 'razorpay' AND gateway_order_id = ?",
      [payload.order_id]
    );
    if (!rows.length) return; // order we don't recognize — ignore

    const payment = rows[0];

    if (event === "payment.captured") {
      if (payment.status === "success") return; // already reconciled via verifyPayment
      await activateFromPayment(payment, payload.id, req.body);
    } else if (event === "payment.failed") {
      await pool.query(
        "UPDATE payments SET status = 'failed', raw_payload = ? WHERE payment_id = ?",
        [JSON.stringify(req.body), payment.payment_id]
      );
    }
  } catch (err) {
    // Response is already sent above — just log for ops to notice.
    console.error("Webhook processing error:", err);
  }
};

// ─── CANCEL SUBSCRIPTION (downgrade) ───────────────────────────────────────
// POST /api/payments/cancel
// Simplification: cancels immediately (access revoked now), not "at period
// end" — the simpler of the two to reason about correctly. Worth revisiting
// once refunds/proration matter; note it as a known gap in the README.
export const cancelSubscription = async (req, res, next) => {
  try {
    const [result] = await pool.query(
      "UPDATE subscriptions SET status = 'canceled', canceled_at = NOW() WHERE user_id = ? AND status = 'active'",
      [req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "No active subscription to cancel" });
    }
    res.json({ success: true, message: "Subscription canceled" });
  } catch (err) {
    next(err);
  }
};

// ─── GET MY SUBSCRIPTION ────────────────────────────────────────────────────
// GET /api/payments/subscription — powers the organizer dashboard's
// "current plan" display and upgrade/downgrade flow.
export const getMySubscription = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.subscription_id, s.status, s.started_at, s.renews_at, s.gateway,
              p.plan_id, p.plan_key, p.name, p.price, p.currency, p.billing_cycle, p.feature_flags
         FROM subscriptions s
         JOIN plans p ON p.plan_id = s.plan_id
        WHERE s.user_id = ? AND s.status = 'active'
        ORDER BY s.started_at DESC
        LIMIT 1`,
      [req.user.id]
    );
    res.json({ success: true, subscription: rows[0] || null });
  } catch (err) {
    next(err);
  }
};
// Marks the payment successful and opens (or renews) the subscription it
// paid for. Safe to call twice for the same payment — the caller checks
// payment.status === 'success' first, so this only ever runs once per order.
async function activateFromPayment(payment, gatewayPaymentId, rawWebhookBody = null) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE payments SET status = 'success', gateway_payment_id = ?, raw_payload = COALESCE(?, raw_payload)
       WHERE payment_id = ?`,
      [gatewayPaymentId, rawWebhookBody ? JSON.stringify(rawWebhookBody) : null, payment.payment_id]
    );

    const [planRows] = await conn.query("SELECT billing_cycle FROM plans WHERE plan_id = ?", [payment.plan_id]);
    const cycleDays = planRows[0]?.billing_cycle === "annual" ? 365 : 30;

    // One active subscription per user at a time — supersede rather than stack.
    await conn.query(
      "UPDATE subscriptions SET status = 'canceled', canceled_at = NOW() WHERE user_id = ? AND status = 'active'",
      [payment.user_id]
    );

    const [result] = await conn.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, renews_at, gateway)
       VALUES (?, ?, 'active', DATE_ADD(NOW(), INTERVAL ? DAY), 'razorpay')`,
      [payment.user_id, payment.plan_id, cycleDays]
    );

    await conn.query("UPDATE payments SET subscription_id = ? WHERE payment_id = ?", [
      result.insertId,
      payment.payment_id,
    ]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
