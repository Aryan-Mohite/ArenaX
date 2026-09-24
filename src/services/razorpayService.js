import Razorpay from "razorpay";
import crypto from "crypto";

// Only instantiate once real keys are set — lets the rest of the app (and
// `npm run build` / local dev without a merchant account) work without
// crashing on import.
let client = null;
function getClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error(
      "Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env"
    );
  }
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
}

// amount is in the plan's base currency unit (e.g. rupees); Razorpay wants
// the smallest unit (paise), hence *100.
export async function createOrder({ amount, currency = "INR", receipt }) {
  const order = await getClient().orders.create({
    amount: Math.round(amount * 100),
    currency,
    receipt,
  });
  return order; // { id, amount, currency, receipt, status, ... }
}

// Checkout-flow verification: after Razorpay's checkout.js completes, the
// frontend gets order_id + payment_id + signature and sends them here.
// HMAC-SHA256(order_id + "|" + payment_id, key_secret) must match.
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}

// Webhook verification: Razorpay signs the raw request body with a
// separate webhook secret (set in the Razorpay dashboard, not the API
// secret). Must be computed over the raw bytes, not JSON.stringify(req.body)
// — re-serializing can reorder keys or change whitespace and break the hash.
export function verifyWebhookSignature({ rawBody, signature }) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
  }
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
}
