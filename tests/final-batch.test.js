// Integration tests for the last coins batch: redemption disputes, the monthly
// cash budget, the free Team Finder boost, Pro streak freeze, coin expiry, the
// anomaly check, redemption risk flags, the accounting CSV and the admin stats.
// Real database; every expected number is computed by hand from the fixtures.
//
//   DB_HOST=127.0.0.1 DB_USER=... DB_PASSWORD=... DB_NAME=arenax_test npm test
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { skipReason, getPool, resetDb, createUser, giveCoins, setSetting, makePro, giftCardId, proDaysId, ledgerRows, mockRes } from "./helpers.js";

const svc = skipReason ? null : await import("../src/services/coinService.js");
const ops = skipReason ? null : await import("../src/services/coinOpsService.js");
const ach = skipReason ? null : await import("../src/services/achievementService.js");
const adminCtl = skipReason ? null : await import("../src/controllers/adminCoinController.js");
const userCtl = skipReason ? null : await import("../src/controllers/coinController.js");
const tfCtl = skipReason ? null : await import("../src/controllers/teamFinderController.js");

const balance = async (u) => (await svc.getBalance(u)).available;
const rejects = async (promise, code) => {
  await assert.rejects(promise, (e) => { assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`); return true; });
};
const bootIdOf = async (name) => {
  const pool = await getPool();
  const [[r]] = await pool.query("SELECT reward_id FROM reward_catalog WHERE reward_key = ?", [name]);
  return r.reward_id;
};
const ledgerAt = async (userId, delta, reason, ref, daysAgo, status = "available") => {
  const pool = await getPool();
  await pool.query(
    "INSERT INTO coin_ledger (user_id, delta, reason, ref_key, status, created_at) VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))",
    [userId, delta, reason, ref, status, daysAgo]
  );
};
// Redeem a gift card and mark it delivered with a code.
const deliveredGiftCard = async (u, inr = 10) => {
  await giveCoins(u, inr * 100);
  const r = await svc.redeemReward(u, await giftCardId(inr));
  const pool = await getPool();
  await pool.query("UPDATE redemptions SET status = 'fulfilled', fulfillment = 'CODE-ABC-123' WHERE redemption_id = ?", [r.redemption_id]);
  return r.redemption_id;
};
const ago = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

describe("Final coins batch", { skip: skipReason }, () => {
  before(async () => { await getPool(); });
  beforeEach(resetDb);
  after(async () => { await (await getPool()).end(); });

  // ── Redemption disputes ────────────────────────────────────────────────────
  describe("redemption disputes", () => {
    it("lets a user report a delivered gift card, once, with a proper reason", async () => {
      const u = await createUser();
      const id = await deliveredGiftCard(u);
      await rejects(ops.openRedemptionDispute(u, id, "short"), "BAD_REASON");
      const r = await ops.openRedemptionDispute(u, id, "The code says it was already redeemed.");
      assert.ok(r.dispute_id);
      await rejects(ops.openRedemptionDispute(u, id, "Still not working, please help."), "ALREADY_OPEN");
    });

    it("only allows the owner, and only for manually delivered rewards", async () => {
      const u = await createUser(); const other = await createUser();
      const id = await deliveredGiftCard(u);
      await rejects(ops.openRedemptionDispute(other, id, "This is not my redemption at all."), "NOT_FOUND");
      await giveCoins(u, 3000);
      const pro = await svc.redeemReward(u, await proDaysId(3));
      await rejects(ops.openRedemptionDispute(u, pro.redemption_id, "My Pro days never showed up."), "NOT_DISPUTABLE");
    });

    it("allows reporting an undelivered request only after 3 days", async () => {
      const u = await createUser();
      await giveCoins(u, 1000);
      const r = await svc.redeemReward(u, await giftCardId(10));
      await rejects(ops.openRedemptionDispute(u, r.redemption_id, "It has not arrived yet at all."), "NOT_DISPUTABLE");
      const pool = await getPool();
      await pool.query("UPDATE redemptions SET created_at = DATE_SUB(NOW(), INTERVAL 80 HOUR) WHERE redemption_id = ?", [r.redemption_id]);
      assert.ok((await ops.openRedemptionDispute(u, r.redemption_id, "It has not arrived yet at all.")).dispute_id);
    });

    it("replace: stores the new code and keeps the redemption fulfilled", async () => {
      const u = await createUser(); const admin = await createUser({ username: "boss" });
      const id = await deliveredGiftCard(u);
      const d = await ops.openRedemptionDispute(u, id, "The code says it was already redeemed.");
      await rejects(ops.resolveRedemptionDispute(d.dispute_id, admin, "replace", "sent a new one", ""), "CODE_REQUIRED");
      await ops.resolveRedemptionDispute(d.dispute_id, admin, "replace", "sent a new one", "NEW-CODE-999");
      const pool = await getPool();
      const [[r]] = await pool.query("SELECT status, fulfillment FROM redemptions WHERE redemption_id = ?", [id]);
      assert.deepEqual([r.status, r.fulfillment], ["fulfilled", "NEW-CODE-999"]);
      assert.equal((await ops.listRedemptionDisputes("replaced")).length, 1);
    });

    it("refund: coins come back once, the request closes as refunded and no longer counts toward the monthly limit", async () => {
      const u = await createUser(); const admin = await createUser({ username: "boss" });
      const id = await deliveredGiftCard(u);                 // 1000 coins spent
      assert.equal(await balance(u), 0);
      const d = await ops.openRedemptionDispute(u, id, "The code says it was already redeemed.");
      await ops.resolveRedemptionDispute(d.dispute_id, admin, "refund", "refunded, sorry", null);
      assert.equal(await balance(u), 1000);
      const pool = await getPool();
      const [[r]] = await pool.query("SELECT status FROM redemptions WHERE redemption_id = ?", [id]);
      assert.equal(r.status, "refunded");
      await rejects(ops.resolveRedemptionDispute(d.dispute_id, admin, "refund", "again", null), "BAD_STATE");
      assert.equal(await balance(u), 1000);

      // monthly limit is 2: the refunded one must not use a slot
      await giveCoins(u, 1000);                               // 2000 available
      await svc.redeemReward(u, await giftCardId(10));
      await svc.redeemReward(u, await giftCardId(10));        // would be the 3rd if "refunded" still counted
      assert.equal((await ops.findCoinAnomalies()).total, 0);
    });

    it("deny: no coins move; two admins resolving at once only succeed once", async () => {
      const u = await createUser(); const a1 = await createUser({ username: "a1" }); const a2 = await createUser({ username: "a2" });
      const id = await deliveredGiftCard(u);
      const d = await ops.openRedemptionDispute(u, id, "The code says it was already redeemed.");
      const res = await Promise.allSettled([
        ops.resolveRedemptionDispute(d.dispute_id, a1, "refund", "refund it", null),
        ops.resolveRedemptionDispute(d.dispute_id, a2, "refund", "refund it", null),
      ]);
      assert.equal(res.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(await balance(u), 1000);                   // refunded exactly once
      assert.equal((await ledgerRows(u, "reason = 'redemption_refund'")).length, 1);

      const u2 = await createUser();
      const id2 = await deliveredGiftCard(u2);
      const d2 = await ops.openRedemptionDispute(u2, id2, "The code says it was already redeemed.");
      await ops.resolveRedemptionDispute(d2.dispute_id, a1, "deny", "code is valid", null);
      assert.equal(await balance(u2), 0);
      await rejects(ops.resolveRedemptionDispute(d2.dispute_id, a1, "deny", "second try", null), "BAD_STATE");
      await rejects(ops.resolveRedemptionDispute(d2.dispute_id, a1, "deny", "", null), "NOTE_REQUIRED");
    });

    it("controller maps errors to HTTP codes and shows dispute state on the user's list", async () => {
      const u = await createUser();
      const id = await deliveredGiftCard(u);
      let res = mockRes();
      await userCtl.disputeRedemption({ user: { id: u }, params: { id }, body: { reason: "x" } }, res, (e) => { throw e; });
      assert.equal(res.statusCode, 400);
      res = mockRes();
      await userCtl.disputeRedemption({ user: { id: u }, params: { id }, body: { reason: "The code says it was already redeemed." } }, res, (e) => { throw e; });
      assert.equal(res.statusCode, 201);
      res = mockRes();
      await userCtl.getMyRedemptions({ user: { id: u } }, res, (e) => { throw e; });
      assert.equal(res.body.redemptions[0].dispute_status, "open");
    });
  });

  // ── Monthly cash budget ────────────────────────────────────────────────────
  describe("monthly cash budget", () => {
    it("stops gift card / top-up redemptions once the month's budget is used, without taking coins", async () => {
      await setSetting("monthly_cash_budget_inr", 20);
      const [a, b, c] = [await createUser(), await createUser(), await createUser()];
      for (const u of [a, b, c]) await giveCoins(u, 1000);
      await svc.redeemReward(a, await giftCardId(10));
      await svc.redeemReward(b, await giftCardId(10));
      await rejects(svc.redeemReward(c, await giftCardId(10)), "BUDGET_REACHED");
      assert.equal(await balance(c), 1000);
    });

    it("a rejected request frees its budget; Pro days and boosts ignore the budget; 0 means no limit", async () => {
      await setSetting("monthly_cash_budget_inr", 10);
      const [a, b] = [await createUser(), await createUser()];
      await giveCoins(a, 4000); await giveCoins(b, 1000);
      const first = await svc.redeemReward(a, await giftCardId(10));
      await rejects(svc.redeemReward(b, await giftCardId(10)), "BUDGET_REACHED");
      await svc.redeemReward(a, await proDaysId(3));                     // not cash: allowed
      await svc.rejectRedemption(first.redemption_id, null, "test");
      await svc.redeemReward(b, await giftCardId(10));                   // budget freed

      await setSetting("monthly_cash_budget_inr", 0);
      const c = await createUser(); await giveCoins(c, 1000);
      await svc.redeemReward(c, await giftCardId(10));                   // unlimited again
    });

    it("serialises budgeted redemptions with a named lock (a redemption waits while another holds it)", async () => {
      await setSetting("monthly_cash_budget_inr", 100);
      const u = await createUser();
      await giveCoins(u, 1000);
      const pool = await getPool();
      const holder = await pool.getConnection();
      await holder.query("SELECT GET_LOCK('arenax_coin_budget', 0)");
      const start = Date.now();
      const finishedAt = svc.redeemReward(u, await giftCardId(10)).then(() => Date.now());
      await new Promise((r) => setTimeout(r, 400));
      await holder.query("SELECT RELEASE_LOCK('arenax_coin_budget')");
      holder.release();
      const doneAt = await finishedAt;                           // completes only once the lock is free
      assert.ok(doneAt - start >= 350, `the redemption should have waited for the budget lock (took ${doneAt - start}ms)`);
      assert.equal(await balance(u), 0);
    });

    it("5 people redeeming at the same moment can't overshoot the budget", async () => {
      await setSetting("monthly_cash_budget_inr", 20);
      const users = [];
      for (let i = 0; i < 5; i++) { const u = await createUser(); await giveCoins(u, 1000); users.push(u); }
      const gift = await giftCardId(10);
      const res = await Promise.allSettled(users.map((u) => svc.redeemReward(u, gift)));
      assert.equal(res.filter((r) => r.status === "fulfilled").length, 2);   // exactly Rs.20 / Rs.10
      for (const r of res.filter((x) => x.status === "rejected")) assert.equal(r.reason.code, "BUDGET_REACHED");
    });
  });

  // ── Team Finder boost (free coin sink) ─────────────────────────────────────
  describe("Team Finder boost", () => {
    it("is applied instantly, extends when bought again, and costs coins only", async () => {
      const u = await createUser();
      await giveCoins(u, 1000);
      const boost = await bootIdOf("tf_boost_24h");
      const r = await svc.redeemReward(u, boost);
      assert.equal(r.status, "fulfilled");
      assert.equal(r.coins_spent, 300);
      const pool = await getPool();
      const hours = async () => Number((await pool.query("SELECT TIMESTAMPDIFF(HOUR, NOW(), ends_at) AS h FROM team_finder_boosts WHERE user_id = ?", [u]))[0][0].h);
      assert.ok([23, 24].includes(await hours()));
      await svc.redeemReward(u, boost);
      assert.ok([47, 48].includes(await hours()));
      assert.equal(await balance(u), 400);
    });

    it("is refused for ArenaX Pro members (they already have priority) and takes no coins", async () => {
      const u = await createUser();
      await giveCoins(u, 1000); await makePro(u);
      await rejects(svc.redeemReward(u, await bootIdOf("tf_boost_24h")), "ALREADY_PRIORITY");
      assert.equal(await balance(u), 1000);
    });

    it("puts a boosted poster's post first in Team Finder, and stops when the boost ends", async () => {
      const plain = await createUser(); const boosted = await createUser();
      const pool = await getPool();
      await pool.query("INSERT IGNORE INTO games (game_id, game_name, slug) VALUES (9001, 'Test Game', 'test-game')");
      // the boosted user's post is OLDER, so it only wins because of the boost
      await pool.query("INSERT INTO team_finder_posts (user_id, game_id, description, created_at) VALUES (?, 9001, 'boosted', DATE_SUB(NOW(), INTERVAL 2 HOUR))", [boosted]);
      await pool.query("INSERT INTO team_finder_posts (user_id, game_id, description) VALUES (?, 9001, 'plain')", [plain]);
      const order = async () => {
        const res = mockRes();
        await tfCtl.getPosts({ query: { game_id: 9001 } }, res, (e) => { throw e; });
        return (res.body.posts || res.body.data || []).map((p) => p.description);
      };
      assert.deepEqual(await order(), ["plain", "boosted"]);
      await pool.query("INSERT INTO team_finder_boosts (user_id, ends_at) VALUES (?, DATE_ADD(NOW(), INTERVAL 5 HOUR))", [boosted]);
      assert.deepEqual(await order(), ["boosted", "plain"]);
      await pool.query("UPDATE team_finder_boosts SET ends_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE)");
      assert.deepEqual(await order(), ["plain", "boosted"]);
    });
  });

  // ── Pro streak freeze ──────────────────────────────────────────────────────
  describe("Pro streak freeze", () => {
    const setStreak = async (u, streak, lastDaysAgo, usedDaysAgo = null) => {
      const pool = await getPool();
      await pool.query(
        "INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_login_date, streak_freeze_used_on) VALUES (?, ?, ?, ?, ?)",
        [u, streak, streak, ago(lastDaysAgo), usedDaysAgo === null ? null : ago(usedDaysAgo)]
      );
    };

    it("forgives one missed day for Pro, but not for free users", async () => {
      const pro = await createUser(); const free = await createUser();
      await makePro(pro);
      await setStreak(pro, 5, 2); await setStreak(free, 5, 2);
      assert.equal((await ach.updateLoginStreak(pro)).currentStreak, 6);
      assert.equal((await ach.updateLoginStreak(free)).currentStreak, 1);
    });

    it("never saves a streak after 2+ missed days", async () => {
      const pro = await createUser(); await makePro(pro);
      await setStreak(pro, 5, 3);
      assert.equal((await ach.updateLoginStreak(pro)).currentStreak, 1);
    });

    it("works at most once per cooldown (default 7 days), then again after it", async () => {
      const a = await createUser(); const b = await createUser();
      await makePro(a); await makePro(b);
      await setStreak(a, 9, 2, 3);                            // used 3 days ago: still cooling down
      await setStreak(b, 9, 2, 8);                            // used 8 days ago: available again
      assert.equal((await ach.updateLoginStreak(a)).currentStreak, 1);
      assert.equal((await ach.updateLoginStreak(b)).currentStreak, 10);
    });

    it("respects the admin cooldown setting", async () => {
      await setSetting("streak_freeze_cooldown_days", 2);
      const pro = await createUser(); await makePro(pro);
      await setStreak(pro, 4, 2, 3);
      assert.equal((await ach.updateLoginStreak(pro)).currentStreak, 5);
    });

    it("an expired Pro plan loses the perk", async () => {
      const u = await createUser(); await makePro(u, -1);
      await setStreak(u, 5, 2);
      assert.equal((await ach.updateLoginStreak(u)).currentStreak, 1);
    });
  });

  // ── Coin expiry + nightly maintenance ──────────────────────────────────────
  describe("coin expiry and nightly maintenance", () => {
    it("does nothing while coin_expiry_days is 0 (the default)", async () => {
      const u = await createUser();
      await ledgerAt(u, 100, "login", "old", 400);
      assert.deepEqual(await ops.expireOldCoins(), { expired_users: 0, expired_coins: 0 });
      assert.equal(await balance(u), 100);
    });

    it("expires only coins older than the cutoff, and is idempotent for the day", async () => {
      await setSetting("coin_expiry_days", 30);
      const u = await createUser();
      await ledgerAt(u, 100, "login", "old", 40);
      await ledgerAt(u, 50, "login", "new", 2);
      const r = await ops.expireOldCoins();
      assert.deepEqual([r.expired_users, r.expired_coins], [1, 100]);
      assert.equal(await balance(u), 50);
      assert.deepEqual(await ops.expireOldCoins(), { expired_users: 0, expired_coins: 0 });
      assert.equal(await balance(u), 50);
    });

    it("is first-in-first-out: coins already spent were the oldest, so they can't expire twice", async () => {
      await setSetting("coin_expiry_days", 30);
      const u = await createUser();
      await ledgerAt(u, 100, "login", "old", 40);
      await ledgerAt(u, -60, "redemption", "redeem:9001", 5);      // spent 60 of the old coins
      await ledgerAt(u, 50, "login", "new", 2);
      assert.equal(await balance(u), 90);
      const r = await ops.expireOldCoins();
      assert.equal(r.expired_coins, 40);                            // only the 40 old coins still held
      assert.equal(await balance(u), 50);

      const v = await createUser();
      await ledgerAt(v, 100, "login", "old", 40);
      await ledgerAt(v, -100, "redemption", "redeem:9002", 5);     // spent every old coin
      await ledgerAt(v, 30, "login", "new", 2);
      assert.equal((await ops.expireOldCoins()).expired_coins, 0);
      assert.equal(await balance(v), 30);
    });

    it("the nightly run vests due pending coins for users who never open the app", async () => {
      const u = await createUser();
      const pool = await getPool();
      await pool.query(
        "INSERT INTO coin_ledger (user_id, delta, reason, ref_key, status, available_at) VALUES (?, 25, 'profile_complete', 'p1', 'pending', DATE_SUB(NOW(), INTERVAL 1 HOUR))", [u]
      );
      const r = await ops.runCoinMaintenance();
      assert.equal(r.settled_users, 1);
      assert.equal(await balance(u), 25);
      assert.equal(r.anomalies_total, 0);
    });
  });

  // ── Anomaly check ──────────────────────────────────────────────────────────
  describe("ledger anomaly check", () => {
    it("is clean for a normal history", async () => {
      const u = await createUser();
      await giveCoins(u, 2000);
      const r = await svc.redeemReward(u, await giftCardId(10));
      await svc.rejectRedemption(r.redemption_id, null, "test");
      await deliveredGiftCard(await createUser());
      assert.equal((await ops.findCoinAnomalies()).total, 0);
    });

    it("detects a negative balance, a missing debit, a missing refund, stuck pending coins and an empty delivered code", async () => {
      const pool = await getPool();
      const u = await createUser();
      await ledgerAt(u, -50, "admin_adjust", "bad", 1);                           // negative balance
      const gift = await giftCardId(10);
      await pool.query("INSERT INTO redemptions (user_id, reward_id, coins_spent, inr_value, status) VALUES (?, ?, 1000, 10, 'requested')", [u, gift]);   // no debit row
      await pool.query("INSERT INTO redemptions (user_id, reward_id, coins_spent, inr_value, status) VALUES (?, ?, 1000, 10, 'rejected')", [u, gift]);    // no refund
      await pool.query("INSERT INTO redemptions (user_id, reward_id, coins_spent, inr_value, status) VALUES (?, ?, 1000, 10, 'fulfilled')", [u, gift]);   // delivered, no code
      await pool.query("INSERT INTO coin_ledger (user_id, delta, reason, ref_key, status, available_at) VALUES (?, 5, 'team_join', 't', 'pending', DATE_SUB(NOW(), INTERVAL 5 DAY))", [u]);
      const a = await ops.findCoinAnomalies();
      assert.equal(a.negative_balances.length, 1);
      assert.equal(a.missing_debits.length, 3);
      assert.equal(a.missing_refunds.length, 1);
      assert.equal(a.overdue_pending, 1);
      assert.equal(a.empty_codes.length, 1);
    });
  });

  // ── Redemption risk flags ──────────────────────────────────────────────────
  describe("risk flags", () => {
    it("flags new accounts, unusually fast earners, repeat redeemers, referral-heavy accounts and admin grants", async () => {
      const settings = await svc.getSettings();
      const fresh = await createUser({ ageDays: 3 });
      const fast = await createUser({ ageDays: 60 });
      const repeat = await createUser({ ageDays: 60 });
      const refs = await createUser({ ageDays: 60 });
      const granted = await createUser({ ageDays: 60 });
      const normal = await createUser({ ageDays: 60 });
      await ledgerAt(fast, 600, "dailies", "burst", 1);                             // allowance is 2*((5+10)*7+50+25+25+50)=510
      await ledgerAt(normal, 400, "dailies", "ok", 1);
      for (let i = 0; i < 5; i++) await ledgerAt(refs, 200, "referral", `referral:${i}`, 3);
      await giveCoins(granted, 100);
      await giveCoins(repeat, 5000);
      await svc.redeemReward(repeat, await giftCardId(10)); await svc.redeemReward(repeat, await giftCardId(10));
      const pool = await getPool();
      const [users] = await pool.query("SELECT user_id, created_at AS user_since FROM users");
      const map = await ops.riskFlagsFor(users, settings);
      assert.deepEqual(map.get(fresh).flags, ["new_account"]);
      assert.deepEqual(map.get(fast).flags, ["high_earn_rate"]);
      assert.deepEqual(map.get(repeat).flags.sort(), ["admin_grants", "repeat_redeemer"]);
      assert.deepEqual(map.get(refs).flags, ["referral_heavy"]);
      assert.deepEqual(map.get(granted).flags, ["admin_grants"]);
      assert.deepEqual(map.get(normal).flags, []);
      assert.equal(map.get(fast).earned_7d, 600);
    });

    it("the admin queue returns flags with each request", async () => {
      const u = await createUser({ ageDays: 8 });
      await giveCoins(u, 1000);
      await svc.redeemReward(u, await giftCardId(10));
      const res = mockRes();
      await adminCtl.getRedemptionQueue({ query: { status: "requested" } }, res, (e) => { throw e; });
      assert.equal(res.body.redemptions.length, 1);
      assert.deepEqual(res.body.redemptions[0].flags, ["new_account", "admin_grants"]);
    });
  });

  // ── Accounting CSV ─────────────────────────────────────────────────────────
  describe("redemptions CSV export", () => {
    it("exports the right rows and columns, never the codes, and neutralises spreadsheet formulas", async () => {
      const pool = await getPool();
      const evil = await createUser({ username: "=HYPERLINK(\"http://x\")" });
      const id = await deliveredGiftCard(evil);
      await pool.query("UPDATE redemptions SET admin_note = 'sent, \"ok\"\nthanks' WHERE redemption_id = ?", [id]);
      const plain = await createUser({ username: "plain" });
      await giveCoins(plain, 1000);
      await svc.redeemReward(plain, await giftCardId(10));

      const all = await ops.buildRedemptionsCsv({});
      assert.ok(all.startsWith("\uFEFFredemption_id,date,username,email,reward,type,coins_spent,inr_value,status,code_delivered,admin_note\r\n"));
      assert.ok(!all.includes("CODE-ABC-123"), "gift card codes must never be exported");
      assert.ok(all.includes('"\'=HYPERLINK(""http://x"")"'), "formula must be neutralised and quoted");
      assert.ok(all.includes("\"sent, \"\"ok\"\"\nthanks\""), "commas, quotes and newlines must be escaped");

      const onlyRequested = (await ops.buildRedemptionsCsv({ status: "requested" })).trim().split("\r\n");
      assert.equal(onlyRequested.length, 2);                      // header + 1
      assert.ok(onlyRequested[1].includes(",plain,"));
      assert.ok(onlyRequested[1].includes(",no,"));              // code_delivered = no
      const future = await ops.buildRedemptionsCsv({ from: "2999-01-01" });
      assert.equal(future.trim().split("\r\n").length, 1);       // header only
    });
  });

  // ── Admin stats: budget + anomalies ────────────────────────────────────────
  describe("admin coin stats", () => {
    const stats = async () => {
      const res = mockRes();
      await adminCtl.getCoinStats({}, res, (e) => { throw e; });
      return res.body.stats;
    };

    it("reports budget status (off / ok / warning / reached), liability vs budget and anomalies", async () => {
      assert.equal((await stats()).budget_status, "off");
      await setSetting("monthly_cash_budget_inr", 100);
      const u = await createUser(); await giveCoins(u, 20000);   // liability Rs.200 > budget Rs.100
      let s = await stats();
      assert.equal(s.budget_status, "ok");
      assert.equal(s.liability_exceeds_budget, true);
      assert.equal(s.cash_committed_this_month_inr, 0);

      await setSetting("max_cash_redemptions_per_month", 50);
      for (let i = 0; i < 8; i++) await svc.redeemReward(u, await giftCardId(10));   // Rs.80 = 80%
      s = await stats();
      assert.equal(s.cash_committed_this_month_inr, 80);
      assert.equal(s.budget_status, "warning");
      for (let i = 0; i < 2; i++) await svc.redeemReward(u, await giftCardId(10));   // Rs.100
      assert.equal((await stats()).budget_status, "reached");
      assert.equal((await stats()).anomalies, 0);
    });
  });

  it("light balance endpoint returns available and pending", async () => {
    const u = await createUser();
    await giveCoins(u, 70);
    const res = mockRes();
    await userCtl.getMyBalance({ user: { id: u } }, res, (e) => { throw e; });
    assert.deepEqual([res.body.available, res.body.pending], [70, 0]);
  });
});
