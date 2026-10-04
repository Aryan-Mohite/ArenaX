// Integration tests for GET /api/admin/analytics/coins (getCoinAnalytics).
// Every expected number below is computed by hand from the fixtures, so a wrong
// JOIN, a double count or a divide-by-zero shows up as a failing assertion.
//
//   DB_HOST=127.0.0.1 DB_USER=... DB_PASSWORD=... DB_NAME=arenax_test npm test
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  skipReason, getPool, resetDb, createUser, giveCoins, makePro,
  giftCardId, proDaysId, mockRes,
} from "./helpers.js";

const svc = skipReason ? null : await import("../src/services/coinService.js");
const ctl = skipReason ? null : await import("../src/controllers/adminCoinController.js");

const call = async (days) => {
  const res = mockRes();
  await ctl.getCoinAnalytics({ query: days === undefined ? {} : { days: String(days) } }, res, (e) => { throw e; });
  return res.body;
};

// A ledger row dated `offsetDays` after the user signed up (or now if null).
const ledger = async (userId, delta, reason, ref, { status = "available", daysAgo = 0 } = {}) => {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO coin_ledger (user_id, delta, reason, ref_key, status, created_at)
     VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
    [userId, delta, reason, ref, status, daysAgo]
  );
};
const ledgerAfterSignup = async (userId, delta, reason, ref, offsetDays) => {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO coin_ledger (user_id, delta, reason, ref_key, status, created_at)
     VALUES (?, ?, ?, ?, 'available', DATE_ADD((SELECT created_at FROM users WHERE user_id = ?), INTERVAL ? DAY))`,
    [userId, delta, reason, ref, userId, offsetDays]
  );
};
const login = async (userId, daysAgo = 0) => {
  const pool = await getPool();
  await pool.query(
    "INSERT INTO events (user_id, event_type, created_at) VALUES (?, 'login', DATE_SUB(NOW(), INTERVAL ? DAY))",
    [userId, daysAgo]
  );
};
const loginAfterSignup = async (userId, offsetDays) => {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO events (user_id, event_type, created_at)
     VALUES (?, 'login', DATE_ADD((SELECT created_at FROM users WHERE user_id = ?), INTERVAL ? DAY))`,
    [userId, userId, offsetDays]
  );
};

describe("Coin analytics", { skip: skipReason }, () => {
  before(async () => { await getPool(); });
  beforeEach(resetDb);
  after(async () => { await (await getPool()).end(); });

  it("returns clean nulls (no divide-by-zero, no crash) when there is no data", async () => {
    const r = await call();
    assert.equal(r.success, true);
    assert.equal(r.days, 30);
    assert.equal(r.summary.issued, 0);
    assert.equal(r.summary.redemption_rate, null);
    assert.equal(r.summary.cash_cost_per_active_user_inr, null);
    assert.equal(r.pro.trial_conversion_rate, null);
    assert.equal(r.retention.d7, null);
    assert.equal(r.trend.length, 30);
  });

  it("only accepts 7 / 30 / 90 day windows", async () => {
    assert.equal((await call(5)).days, 30);
    assert.equal((await call("abc")).days, 30);
    assert.equal((await call(7)).trend.length, 7);
    assert.equal((await call(90)).trend.length, 90);
  });

  it("computes the economy summary, pro funnel and trend correctly", async () => {
    const A = await createUser(); const B = await createUser(); const C = await createUser();
    const D = await createUser(); const E = await createUser();

    // Earn rows inside the window: 5 + 10 + 5 + 25 = 45 issued by 3 earners (A, B, C).
    await ledger(A, 5, "login", "a-login");
    await ledger(A, 10, "dailies", "a-dailies");
    await ledger(B, 5, "login", "b-login");
    await ledger(C, 25, "profile_complete", "c-profile");
    // Must NOT count as issued: reversed, and outside the 30-day window (but still outstanding).
    await ledger(B, 40, "team_join", "b-team", { status: "reversed" });
    await ledger(D, 5, "login", "d-old", { daysAgo: 60 });

    // Manual grants (excluded from "issued", reported as manual_net) to fund redemptions.
    await giveCoins(A, 1000, "m-a"); await giveCoins(B, 1000, "m-b"); await giveCoins(C, 1500, "m-c");

    // A: fulfilled-later gift card (1000). B: gift card then rejected+refunded. C: Pro days (1500).
    const gift = await giftCardId(10);
    await svc.redeemReward(A, gift);
    const bReq = await svc.redeemReward(B, gift);
    await svc.rejectRedemption(bReq.redemption_id, null, "test");
    await svc.redeemReward(C, await proDaysId(3));

    // Mark A's gift card as delivered so it counts toward cash cost.
    const pool = await getPool();
    await pool.query("UPDATE redemptions SET status = 'fulfilled' WHERE user_id = ? AND status = 'requested'", [A]);

    // Paid Pro: A, and C (who earlier used a coin Pro trial -> converted).
    await makePro(A); await makePro(C);

    // Logins in the window: A, B, C, E -> active users = 4.
    for (const u of [A, B, C, E]) await login(u, 1);

    const r = await call(30);
    const s = r.summary;
    assert.equal(s.issued, 45);
    assert.equal(s.earners, 3);
    assert.equal(s.active_users, 4);
    assert.equal(s.issued_per_earner, 15);
    assert.equal(s.issued_per_active_user, 11);          // round(45 / 4)
    assert.equal(s.manual_net, 3500);
    assert.equal(s.spent, 2500);                          // 1000 (A) + 1000-1000 (B) + 1500 (C)
    assert.equal(s.redemptions_total, 3);
    assert.equal(s.redeemers, 2);                         // A and C; B was rejected
    assert.equal(s.redemption_rate, Number((2 / 3).toFixed(4)));
    assert.equal(s.redemptions_rejected, 1);
    assert.equal(s.rejection_rate, Number((1 / 3).toFixed(4)));
    assert.equal(s.cash_cost_inr, 10);                    // only A's fulfilled gift card; Pro days cost no cash
    assert.equal(s.cash_cost_per_active_user_inr, 2.5);
    // outstanding: A 5+10+1000-1000=15, B 5+1000-1000+1000=1005, C 25+1500-1500=25, D 5 (old but still held)
    assert.equal(s.outstanding, 1050);
    assert.equal(s.max_liability_inr, 10.5);

    assert.equal(r.pro.earners, 3);
    assert.equal(r.pro.earners_with_paid_pro, 2);         // coin-granted Pro rows must not count as paid
    assert.equal(r.pro.paid_pro_share, Number((2 / 3).toFixed(4)));
    assert.equal(r.pro.trialists, 1);
    assert.equal(r.pro.trial_converted, 1);
    assert.equal(r.pro.trial_conversion_rate, 1);

    const today = r.trend[r.trend.length - 1];
    assert.equal(today.issued, 45);
    assert.equal(today.spent, 2500);
    assert.equal(r.trend.slice(0, -1).every((d) => d.issued === 0 && d.spent === 0), true);
  });

  it("a Pro-days trial that never bought paid Pro is not counted as converted or as paid Pro", async () => {
    const C = await createUser();
    await ledger(C, 25, "profile_complete", "c-profile");   // makes C an earner in the window
    await giveCoins(C, 1500);
    await svc.redeemReward(C, await proDaysId(3));           // coin-granted Pro only (gateway 'coins')
    const r = await call(30);
    assert.equal(r.pro.earners, 1);
    assert.equal(r.pro.earners_with_paid_pro, 0);
    assert.equal(r.pro.paid_pro_share, 0);
    assert.equal(r.pro.trialists, 1);
    assert.equal(r.pro.trial_converted, 0);
    assert.equal(r.pro.trial_conversion_rate, 0);
  });

  it("splits D7 / D30 retention by early non-login coin activity, only for post-launch signups", async () => {
    // Pre-launch user: owns the earliest ledger row, which defines "coins went live" (50 days ago).
    const pre = await createUser({ ageDays: 60 });
    await ledger(pre, 5, "login", "launch", { daysAgo: 50 });
    await loginAfterSignup(pre, 7);                       // would be "retained", but must be excluded (signed up before launch)

    const E1 = await createUser({ ageDays: 20 });         // engaged, retained at D7
    await ledgerAfterSignup(E1, 10, "dailies", "e1", 1);
    await loginAfterSignup(E1, 7);
    const E2 = await createUser({ ageDays: 20 });         // engaged, not retained
    await ledgerAfterSignup(E2, 25, "first_game", "e2", 2);
    const E3 = await createUser({ ageDays: 40 });         // engaged, retained at D7 and D30
    await ledgerAfterSignup(E3, 10, "dailies", "e3", 1);
    await loginAfterSignup(E3, 7);
    await loginAfterSignup(E3, 30);

    const O1 = await createUser({ ageDays: 20 });         // no coin activity, retained at D7
    await loginAfterSignup(O1, 7);
    const O2 = await createUser({ ageDays: 20 });         // only login coins -> NOT engaged
    await ledgerAfterSignup(O2, 5, "login", "o2", 1);
    const O3 = await createUser({ ageDays: 20 });         // nothing
    const O4 = await createUser({ ageDays: 40 });         // nothing, 40 days old (in D30 cohort)
    const E4 = await createUser({ ageDays: 20 });         // earned only on day 5 -> outside the 3-day window -> NOT engaged
    await ledgerAfterSignup(E4, 10, "dailies", "e4", 5);
    void O3; void O4; void E4;

    const r = await call(30);
    assert.ok(r.retention.since);
    assert.deepEqual(r.retention.d7.engaged, { size: 3, retained: 2, rate: Number((2 / 3).toFixed(4)) });
    assert.deepEqual(r.retention.d7.other, { size: 5, retained: 1, rate: 0.2 });   // O1, O2, O3, O4, E4
    assert.deepEqual(r.retention.d30.engaged, { size: 1, retained: 1, rate: 1 });  // E3
    assert.deepEqual(r.retention.d30.other, { size: 1, retained: 0, rate: 0 });    // O4
  });
});
