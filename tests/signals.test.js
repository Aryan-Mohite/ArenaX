// Integration tests for device / IP abuse signals. Real database, no mocks.
//   DB_HOST=127.0.0.1 DB_USER=... DB_PASSWORD=... DB_NAME=arenax_test npm test
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { skipReason, getPool, resetDb, createUser, giveCoins, setSetting, giftCardId, mockRes } from "./helpers.js";

const sig = skipReason ? null : await import("../src/services/signalService.js");
const coin = skipReason ? null : await import("../src/services/coinService.js");
const ops = skipReason ? null : await import("../src/services/coinOpsService.js");
const refSvc = skipReason ? null : await import("../src/services/referralService.js");
const coinCtl = skipReason ? null : await import("../src/controllers/coinController.js");

const D1 = "11111111-1111-4111-8111-111111111111";
const D2 = "22222222-2222-4222-8222-222222222222";
const D3 = "33333333-3333-4333-8333-333333333333";
const fakeReq = (ip, device, ua = "UA/1.0") => ({
  ip,
  get: (h) => ({ "x-device-id": device, "user-agent": ua })[h.toLowerCase()],
});

describe("device / IP signals", { skip: skipReason }, () => {
  let pool;
  before(async () => { pool = await getPool(); });
  after(async () => { await pool.end(); });
  beforeEach(resetDb);

  it("stores hashes, never the raw IP; rejects malformed device ids", async () => {
    const u = await createUser();
    await sig.recordSignal(u, "login", fakeReq("203.0.113.9", D1));
    await sig.recordSignal(u, "login", fakeReq("203.0.113.9", "not-a-uuid"));
    const [rows] = await pool.query("SELECT * FROM user_signals WHERE user_id = ? ORDER BY signal_id", [u]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].device_id, D1);
    assert.equal(rows[1].device_id, null);
    assert.match(rows[0].ip_hash, /^[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(rows).includes("203.0.113.9"));
    assert.equal(rows[0].ip_hash, rows[1].ip_hash); // stable for the same IP
  });

  it("IPv6 addresses in the same /64 hash alike; IPv4-mapped equals plain IPv4", () => {
    assert.equal(sig.hmac(sig.normalizeIp("2401:4900:1c2a:77b::1")), sig.hmac(sig.normalizeIp("2401:4900:1c2a:77b:aaaa:bbbb:cccc:dddd")));
    assert.notEqual(sig.hmac(sig.normalizeIp("2401:4900:1c2a:77b::1")), sig.hmac(sig.normalizeIp("2401:4900:1c2a:77c::1")));
    assert.equal(sig.normalizeIp("::ffff:10.1.2.3"), "10.1.2.3");
  });

  it("recordSignalSafe never throws (e.g. user does not exist)", async () => {
    sig.recordSignalSafe(999999, "login", fakeReq("1.1.1.1", D1));
    await new Promise((r) => setTimeout(r, 150));
  });

  it("per-device rule: second account on the same device cannot redeem a gift card the same month", async () => {
    const a = await createUser(), b = await createUser(), c = await createUser();
    for (const u of [a, b, c]) await giveCoins(u, 5000);
    await sig.recordSignal(a, "login", fakeReq("1.1.1.1", D1));
    await sig.recordSignal(b, "login", fakeReq("2.2.2.2", D1)); // same device, different IP
    await sig.recordSignal(c, "login", fakeReq("1.1.1.1", D2)); // same IP, different device
    const gc = await giftCardId(10);

    const first = await coin.redeemReward(a, gc);
    assert.equal(first.status, "requested");
    await assert.rejects(coin.redeemReward(b, gc), (e) => e.code === "DEVICE_LIMIT");
    const [[bal]] = await pool.query("SELECT COALESCE(SUM(delta),0) AS s FROM coin_ledger WHERE user_id = ?", [b]);
    assert.equal(Number(bal.s), 5000); // coins untouched
    const other = await coin.redeemReward(c, gc); // shared IP alone never blocks
    assert.equal(other.status, "requested");
  });

  it("a rejected redemption frees the device; setting 0 turns the rule off; non-cash rewards ignore it", async () => {
    const a = await createUser(), b = await createUser();
    for (const u of [a, b]) await giveCoins(u, 5000);
    await sig.recordSignal(a, "login", fakeReq("1.1.1.1", D1));
    await sig.recordSignal(b, "login", fakeReq("1.1.1.1", D1));
    const gc = await giftCardId(10);
    const r = await coin.redeemReward(a, gc);
    await pool.query("UPDATE redemptions SET status = 'rejected' WHERE redemption_id = ?", [r.redemption_id]);
    assert.equal((await coin.redeemReward(b, gc)).status, "requested");

    await setSetting("cash_redemptions_per_device_per_month", 0);
    await giveCoins(a, 5000);
    assert.equal((await coin.redeemReward(a, gc)).status, "requested"); // rule off
  });

  it("redeem endpoint records the device first, so users who never re-logged-in are covered", async () => {
    const a = await createUser(), b = await createUser();
    for (const u of [a, b]) await giveCoins(u, 5000);
    const gc = await giftCardId(10);
    const go = async (u) => { const res = mockRes(); await coinCtl.redeem({ ...fakeReq("9.9.9.9", D3), user: { id: u }, body: { reward_id: gc } }, res, (e) => { throw e; }); return res; };
    assert.equal((await go(a)).statusCode, 201);
    const second = await go(b);
    assert.equal(second.statusCode, 409);
    assert.equal(second.body.code, "DEVICE_LIMIT");
  });

  it("referral coins are blocked when referrer and friend share a device, paid otherwise", async () => {
    const mk = async (referrer, friendDevice) => {
      const friend = await createUser({ ageDays: 3, bio: "hi", picture: "https://x/y.png" });
      await pool.query("UPDATE users SET referred_by = ? WHERE user_id = ?", [referrer, friend]);
      await pool.query("INSERT INTO referral_rewards (referrer_id, referred_user_id, status) VALUES (?, ?, 'pending')", [referrer, friend]);
      await pool.query("INSERT IGNORE INTO games (game_id, game_name, slug) VALUES (9001, 'Test Game', 'test-game')");
      await pool.query("INSERT INTO user_game_profile (user_id, game_id) VALUES (?, 9001)", [friend]);
      await pool.query("INSERT IGNORE INTO communities (community_id, game_id, name) VALUES (9001, 9001, 'Test Community')");
      await pool.query("INSERT INTO community_posts (community_id, user_id, title, content) VALUES (9001, ?, 't', 'c')", [friend]);
      await sig.recordSignal(friend, "signup", fakeReq("5.5.5.5", friendDevice));
      return friend;
    };
    const ref = await createUser();
    await sig.recordSignal(ref, "login", fakeReq("5.5.5.5", D1));
    const sameDev = await mk(ref, D1);
    const diffDev = await mk(ref, D2);
    await refSvc.creditActivatedReferrals(ref);
    const [rows] = await pool.query("SELECT referred_user_id, status FROM referral_rewards WHERE referrer_id = ?", [ref]);
    const st = Object.fromEntries(rows.map((r) => [r.referred_user_id, r.status]));
    assert.equal(st[sameDev], "blocked");
    assert.equal(st[diffDev], "credited");
    await refSvc.creditActivatedReferrals(ref); // re-run: blocked stays blocked, nothing double-paid
    const [[n]] = await pool.query("SELECT COUNT(*) AS n FROM coin_ledger WHERE user_id = ? AND reason = 'referral'", [ref]);
    assert.equal(Number(n.n), 1);
  });

  it("admin risk flags: shared_device always; shared_signup_ip only at 3+ others", async () => {
    const a = await createUser(), b = await createUser();
    const farm = [await createUser(), await createUser(), await createUser()];
    await sig.recordSignal(a, "signup", fakeReq("7.7.7.7", D1));
    await sig.recordSignal(b, "login", fakeReq("8.8.8.8", D1));
    for (const f of farm) await sig.recordSignal(f, "signup", fakeReq("6.6.6.6", `${Math.random().toString(16).slice(2, 10)}-0000-4000-8000-000000000000`));
    const lone = await createUser();
    await sig.recordSignal(lone, "signup", fakeReq("6.6.6.6", D2)); // 3 other signups from 6.6.6.6
    const settings = await coin.getSettings();
    const rows = [a, farm[0], lone].map((id) => ({ user_id: id, user_since: new Date() }));
    const flags = await ops.riskFlagsFor(rows, settings);
    assert.ok(flags.get(a).flags.includes("shared_device"));
    assert.ok(!flags.get(a).flags.includes("shared_signup_ip"));
    assert.ok(flags.get(lone).flags.includes("shared_signup_ip"));
    assert.ok(flags.get(farm[0]).flags.includes("shared_signup_ip")); // sees farm[1], farm[2] and lone = 3 others

    // boundary: three accounts on one IP = each sees only 2 others -> not flagged
    const trio = [await createUser(), await createUser(), await createUser()];
    for (const [i, t] of trio.entries()) await sig.recordSignal(t, "signup", fakeReq("5.5.5.5", `aaaaaaa${i}-0000-4000-8000-000000000000`));
    const f2 = await ops.riskFlagsFor(trio.map((id) => ({ user_id: id, user_since: new Date() })), settings);
    for (const t of trio) assert.ok(!f2.get(t).flags.includes("shared_signup_ip"));
  });

  it("linkedAccountsFor lists usernames by device and by signup IP, never IPs", async () => {
    const a = await createUser({ username: "alice_t" }), b = await createUser({ username: "bob_t" }), c = await createUser({ username: "carol_t" });
    await sig.recordSignal(a, "signup", fakeReq("4.4.4.4", D1));
    await sig.recordSignal(b, "login", fakeReq("3.3.3.3", D1));
    await sig.recordSignal(c, "signup", fakeReq("4.4.4.4", D2));
    const l = await sig.linkedAccountsFor(a);
    assert.deepEqual(l.same_device.map((x) => x.username), ["bob_t"]);
    assert.deepEqual(l.same_signup_ip.map((x) => x.username), ["carol_t"]);
    assert.ok(!JSON.stringify(l).includes("4.4.4.4"));
  });

  it("purgeOldSignals deletes only rows past retention", async () => {
    const u = await createUser();
    await sig.recordSignal(u, "login", fakeReq("1.1.1.1", D1));
    await sig.recordSignal(u, "login", fakeReq("1.1.1.1", D1));
    await pool.query("UPDATE user_signals SET created_at = DATE_SUB(NOW(), INTERVAL 100 DAY) LIMIT 1");
    assert.equal(await sig.purgeOldSignals(90), 1);
    const [[n]] = await pool.query("SELECT COUNT(*) AS n FROM user_signals");
    assert.equal(Number(n.n), 1);
  });
});
