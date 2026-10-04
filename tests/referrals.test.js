// Integration tests for referral rewards paying Arena Coins. Real database;
// every expected number is computed by hand from the fixtures.
//
//   DB_HOST=127.0.0.1 DB_USER=... DB_PASSWORD=... DB_NAME=arenax_test npm test
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { skipReason, getPool, resetDb, createUser, setSetting, ledgerRows, mockRes } from "./helpers.js";

const refSvc = skipReason ? null : await import("../src/services/referralService.js");
const coinSvc = skipReason ? null : await import("../src/services/coinService.js");
const ctl = skipReason ? null : await import("../src/controllers/referralController.js");

// A referred user who has (or hasn't) finished onboarding: profile + game + a community post.
const makeFriend = async (referrerId, { activated = true, status = "active" } = {}) => {
  const pool = await getPool();
  const friend = await createUser({
    status,
    ageDays: 3,
    bio: activated ? "hi" : null,
    picture: activated ? "https://x/y.png" : null,
  });
  await pool.query("UPDATE users SET referred_by = ? WHERE user_id = ?", [referrerId, friend]);
  await pool.query("INSERT INTO referral_rewards (referrer_id, referred_user_id, status) VALUES (?, ?, 'pending')", [referrerId, friend]);
  if (activated) {
    await pool.query("INSERT IGNORE INTO games (game_id, game_name, slug) VALUES (9001, 'Test Game', 'test-game')");
    await pool.query("INSERT INTO user_game_profile (user_id, game_id) VALUES (?, 9001)", [friend]);
    await pool.query("INSERT IGNORE INTO communities (community_id, game_id, name) VALUES (9001, 9001, 'Test Community')");
    await pool.query("INSERT INTO community_posts (community_id, user_id, title, content) VALUES (9001, ?, 't', 'c')", [friend]);
  }
  return friend;
};
const reward = async (friendId) => {
  const pool = await getPool();
  const [[r]] = await pool.query("SELECT status, coins_amount FROM referral_rewards WHERE referred_user_id = ?", [friendId]);
  return r;
};
const myReferrals = async (userId) => {
  const res = mockRes();
  await ctl.getMyReferrals({ user: { id: userId } }, res, (e) => { throw e; });
  return res.body;
};

describe("Referral coin rewards", { skip: skipReason }, () => {
  before(async () => { await getPool(); });
  beforeEach(resetDb);
  after(async () => { await (await getPool()).end(); });

  it("pays nothing until the friend has finished onboarding", async () => {
    const me = await createUser();
    const f = await makeFriend(me, { activated: false });
    await refSvc.creditActivatedReferrals(me);
    assert.equal((await reward(f)).status, "pending");
    assert.equal((await ledgerRows(me)).length, 0);
  });

  it("pays 200 coins on activation, held as pending for 7 days, and records it on the referral", async () => {
    const me = await createUser();
    const f = await makeFriend(me);
    await refSvc.creditActivatedReferrals(me);
    const r = await reward(f);
    assert.equal(r.status, "credited");
    assert.equal(r.coins_amount, 200);
    const rows = await ledgerRows(me, "reason = 'referral'");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].delta, 200);
    assert.equal(rows[0].status, "pending");
    assert.equal(rows[0].ref_key, `referral:${f}`);
    assert.deepEqual(await coinSvc.getBalance(me), { available: 0, pending: 200 });
    const holdDays = (new Date(rows[0].available_at) - Date.now()) / 86400000;
    assert.ok(holdDays > 6.9 && holdDays <= 7.01, `hold was ${holdDays} days`);
  });

  it("is idempotent, including 5 simultaneous runs (never pays one friend twice)", async () => {
    const me = await createUser();
    const f = await makeFriend(me);
    await Promise.all(Array.from({ length: 5 }, () => refSvc.creditActivatedReferrals(me)));
    await refSvc.creditActivatedReferrals(me);
    assert.equal((await ledgerRows(me, "reason = 'referral'")).length, 1);
    assert.equal((await reward(f)).status, "credited");
  });

  it("pays instantly when the hold is set to 0 days", async () => {
    await setSetting("referral_hold_days", 0);
    const me = await createUser();
    await makeFriend(me);
    await refSvc.creditActivatedReferrals(me);
    assert.deepEqual(await coinSvc.getBalance(me), { available: 200, pending: 0 });
  });

  it("vests after the hold when the friend is still a normal account", async () => {
    const me = await createUser();
    await makeFriend(me);
    await refSvc.creditActivatedReferrals(me);
    const pool = await getPool();
    await pool.query("UPDATE coin_ledger SET available_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE user_id = ?", [me]);
    await coinSvc.settlePending(me);
    assert.deepEqual(await coinSvc.getBalance(me), { available: 200, pending: 0 });
  });

  it("reverses the coins if the friend was banned during the hold (farmed referral)", async () => {
    const me = await createUser();
    const f = await makeFriend(me);
    await refSvc.creditActivatedReferrals(me);
    const pool = await getPool();
    await pool.query("UPDATE users SET status = 'banned' WHERE user_id = ?", [f]);
    await pool.query("UPDATE coin_ledger SET available_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE user_id = ?", [me]);
    await coinSvc.settlePending(me);
    assert.deepEqual(await coinSvc.getBalance(me), { available: 0, pending: 0 });
    assert.equal((await ledgerRows(me, "status = 'reversed'")).length, 1);
  });

  it("pays nothing to a banned referrer, or for a banned friend", async () => {
    const banned = await createUser({ status: "banned" });
    await makeFriend(banned);
    await refSvc.creditActivatedReferrals(banned);
    assert.equal((await ledgerRows(banned)).length, 0);

    const me = await createUser();
    const f = await makeFriend(me, { status: "banned" });
    await refSvc.creditActivatedReferrals(me);
    assert.equal((await reward(f)).status, "pending");
    assert.equal((await ledgerRows(me)).length, 0);
  });

  it("enforces the monthly cap; the overflow stays pending and pays next month", async () => {
    await setSetting("referral_monthly_cap", 2);
    const me = await createUser();
    const [a, b, c] = [await makeFriend(me), await makeFriend(me), await makeFriend(me)];
    await refSvc.creditActivatedReferrals(me);
    assert.deepEqual([(await reward(a)).status, (await reward(b)).status, (await reward(c)).status], ["credited", "credited", "pending"]);
    assert.equal((await ledgerRows(me, "reason = 'referral'")).length, 2);

    await refSvc.creditActivatedReferrals(me);            // still capped this month
    assert.equal((await reward(c)).status, "pending");

    const pool = await getPool();                           // roll the two payouts into "last month"
    await pool.query("UPDATE referral_rewards SET credited_at = DATE_SUB(credited_at, INTERVAL 40 DAY) WHERE status = 'credited'");
    await refSvc.creditActivatedReferrals(me);
    assert.equal((await reward(c)).status, "credited");
    assert.equal((await ledgerRows(me, "reason = 'referral'")).length, 3);
  });

  it("is paused when the reward is set to 0", async () => {
    await setSetting("earn_referral", 0);
    const me = await createUser();
    const f = await makeFriend(me);
    await refSvc.creditActivatedReferrals(me);
    assert.equal((await reward(f)).status, "pending");
    assert.equal((await ledgerRows(me)).length, 0);
  });

  it("does not pay the same friend again if a payout row already exists (crash between pay and flip)", async () => {
    const me = await createUser();
    const f = await makeFriend(me);
    const pool = await getPool();
    await pool.query(
      "INSERT INTO coin_ledger (user_id, delta, reason, ref_key, status) VALUES (?, 200, 'referral', ?, 'available')",
      [me, `referral:${f}`]
    );
    await refSvc.creditActivatedReferrals(me);
    assert.equal((await ledgerRows(me, "reason = 'referral'")).length, 1);
    assert.equal((await reward(f)).status, "credited");
  });

  it("dashboard: counts, coins earned vs on hold, per-invite state and live program rules", async () => {
    const me = await createUser();
    const a = await makeFriend(me);                         // activated, paid
    const b = await makeFriend(me);                         // activated, paid, then vested
    await makeFriend(me, { activated: false });             // still onboarding
    await refSvc.creditActivatedReferrals(me);
    const pool = await getPool();
    await pool.query("UPDATE coin_ledger SET available_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE user_id = ? AND ref_key = ?", [me, `referral:${b}`]);

    const r = await myReferrals(me);
    assert.deepEqual(
      { i: r.summary.invitedCount, a: r.summary.activatedCount, p: r.summary.pendingCount, e: r.summary.coinsEarned, h: r.summary.coinsOnHold },
      { i: 3, a: 2, p: 1, e: 200, h: 200 }
    );
    const byFriend = Object.fromEntries(r.invited.map((x) => [x.referred_user_id, x]));
    assert.equal(byFriend[a].coin_status, "pending");
    assert.equal(byFriend[b].coin_status, "available");
    assert.equal(r.invited.filter((x) => x.status === "pending")[0].progress.profileComplete, false);
    assert.deepEqual(r.program, { coinsPerReferral: 200, holdDays: 7, monthlyCap: 10, creditedThisMonth: 2, capReached: false, paused: false });
  });

  it("admin analytics: funnel, coins paid / on hold / reversed, top referrers", async () => {
    const hold0 = 0; await setSetting("referral_hold_days", hold0);
    const star = await createUser({ username: "star" });
    const quiet = await createUser({ username: "quiet" });
    await makeFriend(star); await makeFriend(star); await makeFriend(star, { activated: false });
    await makeFriend(quiet);
    await refSvc.creditActivatedReferrals(star);
    await refSvc.creditActivatedReferrals(quiet);

    const res = mockRes();
    await ctl.getReferralAnalytics({}, res, (e) => { throw e; });
    const { summary: s, top } = res.body;
    assert.equal(s.invited, 4);
    assert.equal(s.activated, 3);
    assert.equal(s.pending, 1);
    assert.equal(s.activation_rate, 0.75);
    assert.equal(s.referrers, 2);
    assert.equal(s.coins_paid, 600);                         // 3 payouts x 200, hold is 0
    assert.equal(s.coins_on_hold, 0);
    assert.equal(s.invited_30d, 4);
    assert.equal(s.share_of_signups, Number((4 / 6).toFixed(4)));   // 2 referrers + 4 friends = 6 users, 4 via referral
    assert.deepEqual(top.map((t) => [t.username, t.invited, t.activated, t.coins]), [["star", 3, 2, 400], ["quiet", 1, 1, 200]]);
  });

  it("admin analytics is clean on an empty database", async () => {
    const res = mockRes();
    await ctl.getReferralAnalytics({}, res, (e) => { throw e; });
    assert.equal(res.body.summary.invited, 0);
    assert.equal(res.body.summary.activation_rate, null);
    assert.equal(res.body.summary.share_of_signups, null);
    assert.deepEqual(res.body.top, []);
  });
});
