// Integration tests for the ArenaX Pro purchase flow and how it interacts with
// Pro days earned through Arena Coins. Payments go through the real
// verifyPayment controller with a correctly signed Razorpay callback, so the
// signature check, the transaction and the SQL all run for real.
//
//   DB_HOST=127.0.0.1 DB_USER=... DB_PASSWORD=... DB_NAME=arenax_test npm test
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { skipReason, getPool, resetDb, createUser, giveCoins, proDaysId, mockRes } from "./helpers.js";

process.env.RAZORPAY_KEY_SECRET = "test_secret";
process.env.RAZORPAY_KEY_ID = "test_key";

const pay = skipReason ? null : await import("../src/controllers/paymentController.js");
const svc = skipReason ? null : await import("../src/services/coinService.js");

let orderSeq = 0;
const planId = async (key) => {
  const pool = await getPool();
  const [[p]] = await pool.query("SELECT plan_id FROM plans WHERE plan_key = ?", [key]);
  return p.plan_id;
};

// Inserts a pending payment for a plan and returns a correctly signed callback body.
const newOrder = async (userId, key) => {
  const pool = await getPool();
  const orderId = `order_test_${++orderSeq}`;
  await pool.query(
    "INSERT INTO payments (user_id, plan_id, gateway, gateway_order_id, amount, currency, status) VALUES (?, ?, 'razorpay', ?, 99, 'INR', 'created')",
    [userId, await planId(key), orderId]
  );
  const paymentId = `pay_test_${orderSeq}`;
  const signature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  return { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature };
};
const verify = async (userId, body) => {
  const res = mockRes();
  await pay.verifyPayment({ body, user: { id: userId } }, res, (e) => { throw e; });
  return res;
};
const buy = async (userId, key) => verify(userId, await newOrder(userId, key));

const mySub = async (userId) => {
  const res = mockRes();
  await pay.getMySubscription({ user: { id: userId } }, res, (e) => { throw e; });
  return res.body;
};
const cancel = async (userId) => {
  const res = mockRes();
  await pay.cancelSubscription({ user: { id: userId } }, res, (e) => { throw e; });
  return res;
};

// Direct subscription fixtures. `hours` may be negative (already expired).
const addSub = async (userId, key, gateway, hours, status = "active") => {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO subscriptions (user_id, plan_id, status, renews_at, gateway, started_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?, DATE_SUB(NOW(), INTERVAL 1 HOUR))`,
    [userId, await planId(key), status, hours, gateway]
  );
};
const subs = async (userId) => {
  const pool = await getPool();
  const [rows] = await pool.query(
    `SELECT s.subscription_id, p.plan_key, s.gateway, s.status,
            TIMESTAMPDIFF(MINUTE, NOW(), s.renews_at) AS mins_left
       FROM subscriptions s JOIN plans p ON p.plan_id = s.plan_id
      WHERE s.user_id = ? ORDER BY s.subscription_id`,
    [userId]
  );
  return rows;
};
const active = async (userId) => (await subs(userId)).filter((s) => s.status === "active");
const near = (mins, expectedHours, tolMins = 3) =>
  assert.ok(Math.abs(mins - expectedHours * 60) <= tolMins, `expected ~${expectedHours}h, got ${(mins / 60).toFixed(2)}h`);

describe("ArenaX Pro purchase flow", { skip: skipReason }, () => {
  before(async () => { await getPool(); });
  beforeEach(resetDb);
  after(async () => { await (await getPool()).end(); });

  // ── Reading the current subscription ───────────────────────────────────────
  describe("getMySubscription", () => {
    it("is empty for a user with no subscriptions", async () => {
      const u = await createUser();
      const r = await mySub(u);
      assert.equal(r.subscription, null);
      assert.equal(r.coin_pro_until, null);
      assert.equal(r.expired, null);
    });

    it("does not treat an expired plan as current, and reports what lapsed so the user can renew", async () => {
      const u = await createUser();
      await addSub(u, "gamer_pro", "razorpay", -48);       // status still 'active', but ended 2 days ago
      const r = await mySub(u);
      assert.equal(r.subscription, null);
      assert.equal(r.expired.plan_key, "gamer_pro");
      assert.ok(r.expired.ended_at);
    });

    it("prefers a paid plan over coin-granted Pro, and still reports the coin Pro end date", async () => {
      const u = await createUser();
      await addSub(u, "gamer_pro", "coins", 72);
      await addSub(u, "organizer_pro", "razorpay", 24 * 20);
      const r = await mySub(u);
      assert.equal(r.subscription.plan_key, "organizer_pro");
      assert.ok(r.coin_pro_until);
    });

    it("returns coin-granted Pro as the subscription when it is all the user has", async () => {
      const u = await createUser();
      await addSub(u, "gamer_pro", "coins", 72);
      const r = await mySub(u);
      assert.equal(r.subscription.plan_key, "gamer_pro");
      assert.equal(r.subscription.gateway, "coins");
      assert.ok(r.coin_pro_until);
    });
  });

  // ── Buying ArenaX Pro ──────────────────────────────────────────────────────
  describe("buying ArenaX Pro", () => {
    it("activates a 30-day subscription and links the payment", async () => {
      const u = await createUser();
      const res = await buy(u, "gamer_pro");
      assert.equal(res.body.success, true);
      const a = await active(u);
      assert.equal(a.length, 1);
      assert.equal(a[0].gateway, "razorpay");
      near(a[0].mins_left, 30 * 24);
      const pool = await getPool();
      const [[p]] = await pool.query("SELECT status, subscription_id FROM payments WHERE user_id = ?", [u]);
      assert.equal(p.status, "success");
      assert.equal(p.subscription_id, a[0].subscription_id);
    });

    it("rejects a callback with a bad signature and activates nothing", async () => {
      const u = await createUser();
      const body = await newOrder(u, "gamer_pro");
      const res = await verify(u, { ...body, razorpay_signature: "0".repeat(64) });
      assert.equal(res.statusCode, 400);
      assert.equal((await active(u)).length, 0);
    });

    it("is idempotent: replaying the same callback never stacks time", async () => {
      const u = await createUser();
      const body = await newOrder(u, "gamer_pro");
      await verify(u, body);
      const first = await active(u);
      await verify(u, body);
      await verify(u, body);
      const after = await active(u);
      assert.equal(after.length, 1);
      assert.equal(after[0].subscription_id, first[0].subscription_id);
      near(after[0].mins_left, 30 * 24);
      assert.equal((await subs(u)).length, 1, "no extra subscription rows");
    });

    it("keeps remaining coin-Pro days: they are added to the paid period", async () => {
      const u = await createUser();
      await addSub(u, "gamer_pro", "coins", 3 * 24);       // 3 days left from Arena Coins
      await buy(u, "gamer_pro");
      const a = await active(u);
      assert.equal(a.length, 1, "coin subscription is folded into the paid one");
      assert.equal(a[0].gateway, "razorpay");
      near(a[0].mins_left, 33 * 24);
    });

    it("ignores already-expired coin Pro (nothing to carry over)", async () => {
      const u = await createUser();
      await addSub(u, "gamer_pro", "coins", -10);
      await buy(u, "gamer_pro");
      const a = await active(u);
      assert.equal(a.length, 1);
      near(a[0].mins_left, 30 * 24);
    });

    it("an early renewal keeps the days left on the current paid Pro", async () => {
      const u = await createUser();
      await addSub(u, "gamer_pro", "razorpay", 10 * 24);
      await buy(u, "gamer_pro");
      const a = await active(u);
      assert.equal(a.length, 1);
      near(a[0].mins_left, 40 * 24);
    });

    it("still supersedes a different paid plan (one paid plan at a time)", async () => {
      const u = await createUser();
      await addSub(u, "organizer_pro", "razorpay", 15 * 24);
      await buy(u, "gamer_pro");
      const a = await active(u);
      assert.equal(a.length, 1);
      assert.equal(a[0].plan_key, "gamer_pro");
      near(a[0].mins_left, 30 * 24);                        // organizer days are not carried across plans
    });
  });

  // ── Buying something else must not destroy coin Pro ────────────────────────
  describe("buying an organizer plan", () => {
    it("leaves coin-granted Pro days running", async () => {
      const u = await createUser();
      await addSub(u, "gamer_pro", "coins", 5 * 24);
      await buy(u, "organizer_pro");
      const a = await active(u);
      assert.deepEqual(a.map((s) => `${s.plan_key}:${s.gateway}`).sort(), ["gamer_pro:coins", "organizer_pro:razorpay"]);
      near(a.find((s) => s.gateway === "coins").mins_left, 5 * 24);
    });
  });

  // ── Downgrade / cancel ─────────────────────────────────────────────────────
  describe("cancelSubscription", () => {
    it("cancels the paid plan but keeps coin-granted Pro days", async () => {
      const u = await createUser();
      await addSub(u, "gamer_pro", "coins", 4 * 24);
      await addSub(u, "organizer_pro", "razorpay", 20 * 24);
      const res = await cancel(u);
      assert.equal(res.body.success, true);
      const a = await active(u);
      assert.deepEqual(a.map((s) => s.gateway), ["coins"]);
    });

    it("tells a coin-only user there is no paid plan, and leaves their days alone", async () => {
      const u = await createUser();
      await addSub(u, "gamer_pro", "coins", 4 * 24);
      const res = await cancel(u);
      assert.equal(res.statusCode, 404);
      assert.equal((await active(u)).length, 1);
    });
  });

  // ── Coins can't buy Pro days that would overlap a paid Pro ─────────────────
  describe("redeeming Pro days with coins", () => {
    it("is refused while a paid Pro is active, and no coins are taken", async () => {
      const u = await createUser();
      await giveCoins(u, 3000);
      await addSub(u, "gamer_pro", "razorpay", 10 * 24);
      await assert.rejects(svc.redeemReward(u, await proDaysId(3)), (e) => { assert.equal(e.code, "ALREADY_PRO"); return true; });
      assert.equal((await svc.getBalance(u)).available, 3000);
      assert.equal((await subs(u)).length, 1, "no coin subscription created");
    });

    it("works when the user only has coin Pro, or when their paid Pro has expired", async () => {
      const a = await createUser();
      await giveCoins(a, 3000);
      await addSub(a, "gamer_pro", "coins", 24);
      const r1 = await svc.redeemReward(a, await proDaysId(3));
      assert.equal(r1.status, "fulfilled");

      const b = await createUser();
      await giveCoins(b, 3000);
      await addSub(b, "gamer_pro", "razorpay", -24);        // lapsed
      const r2 = await svc.redeemReward(b, await proDaysId(3));
      assert.equal(r2.status, "fulfilled");
    });

    it("is not blocked by a paid organizer plan (that's a different product)", async () => {
      const u = await createUser();
      await giveCoins(u, 3000);
      await addSub(u, "organizer_pro", "razorpay", 10 * 24);
      const r = await svc.redeemReward(u, await proDaysId(3));
      assert.equal(r.status, "fulfilled");
    });
  });
});
