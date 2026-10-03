// Integration tests for the Arena Coins economy (src/services/coinService.js
// and the admin settings controller). Real database, no mocks: the money
// invariants (idempotency, no negative balances, no double refunds) only mean
// something when the SQL actually runs.
//
//   DB_HOST=127.0.0.1 DB_USER=... DB_PASSWORD=... DB_NAME=arenax_test npm test
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  skipReason, getPool, resetDb, createUser, giveCoins, setSetting, makePro,
  giftCardId, proDaysId, ledgerRows, mockRes,
} from "./helpers.js";

const svc = skipReason ? null : await import("../src/services/coinService.js");
const feature = skipReason ? null : await import("../src/services/featureService.js");
const adminCtl = skipReason ? null : await import("../src/controllers/adminCoinController.js");

const balanceOf = async (u) => (await svc.getBalance(u)).available;
const rejects = async (promise, code) => {
  await assert.rejects(promise, (e) => { assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`); return true; });
};

describe("Arena Coins", { skip: skipReason }, () => {
  before(async () => { await getPool(); });
  beforeEach(resetDb);
  after(async () => { await (await getPool()).end(); });

  // ── Awarding ───────────────────────────────────────────────────────────────
  describe("awarding", () => {
    it("is idempotent: the same ref_key never pays twice", async () => {
      const u = await createUser();
      const a = await svc.awardCoins(u, "login", "login:2026-01-01");
      const b = await svc.awardCoins(u, "login", "login:2026-01-01");
      assert.equal(a.awarded, true);
      assert.equal(b.awarded, false);
      assert.equal(await balanceOf(u), 5);
    });

    it("is idempotent under concurrency (10 parallel identical awards -> 1 row)", async () => {
      const u = await createUser();
      await Promise.all(Array.from({ length: 10 }, () => svc.awardCoins(u, "dailies", "dailies:2026-01-01")));
      assert.equal((await ledgerRows(u)).length, 1);
      assert.equal(await balanceOf(u), 10);
    });

    it("pays login once a day and streak bonuses once per streak", async () => {
      const u = await createUser();
      assert.equal(await svc.awardLoginCoins(u, 1), 5);
      assert.equal(await svc.awardLoginCoins(u, 1), 0);
      assert.equal(await svc.awardLoginCoins(u, 7), 50);   // login already paid today, streak_7 is new
      assert.equal(await svc.awardLoginCoins(u, 7), 0);
      assert.equal(await balanceOf(u), 55);
    });

    it("pays Dailies once per day however many games are played", async () => {
      const u = await createUser();
      const total = [];
      for (let i = 0; i < 4; i++) total.push(await svc.awardDailiesCoins(u));
      assert.deepEqual(total, [10, 0, 0, 0]);
    });

    it("pays nothing when an earn amount is set to 0", async () => {
      const u = await createUser();
      await setSetting("earn_login", 0);
      const r = await svc.awardCoins(u, "login", "login:x");
      assert.equal(r.awarded, false);
      assert.equal((await ledgerRows(u)).length, 0);
    });
  });

  // ── Pro multiplier ─────────────────────────────────────────────────────────
  describe("Pro multiplier", () => {
    it("doubles listed reasons for Pro users but not for free users", async () => {
      const free = await createUser();
      const pro = await createUser();
      await makePro(pro);
      assert.equal((await svc.awardCoins(free, "login", "k1")).amount, 5);
      assert.equal((await svc.awardCoins(pro, "login", "k1")).amount, 10);
    });

    it("does not multiply reasons that are not in pro_multiplier_reasons", async () => {
      const pro = await createUser();
      await makePro(pro);
      assert.equal((await svc.awardCoins(pro, "profile_complete", "profile_complete")).amount, 25);
    });

    it("stops adding the bonus once the monthly cap is used", async () => {
      const pro = await createUser();
      await makePro(pro);
      await setSetting("pro_bonus_monthly_cap", 8);
      const amounts = [];
      for (const k of ["a", "b", "c"]) amounts.push((await svc.awardCoins(pro, "login", k)).amount);
      assert.deepEqual(amounts, [10, 8, 5]); // +5 bonus, +3 (cap remainder), +0
    });

    it("ignores an expired Pro subscription", async () => {
      const u = await createUser();
      await makePro(u, -1);
      assert.equal((await svc.awardCoins(u, "login", "k")).amount, 5);
    });
  });

  // ── One-time achievements, vesting ─────────────────────────────────────────
  describe("one-time coins and vesting", () => {
    const addGame = async (u) => {
      const pool = await getPool();
      await pool.query("INSERT IGNORE INTO games (game_id, game_name, slug) VALUES (9001, 'Test Game', 'test-game')");
      await pool.query("INSERT INTO user_game_profile (user_id, game_id) VALUES (?, 9001)", [u]);
    };
    const joinTeam = async (u, status = "active") => {
      const pool = await getPool();
      const [t] = await pool.query("INSERT INTO teams (team_name, created_by) VALUES (?, ?)", [`team-${u}-${Date.now()}`, u]);
      await pool.query("INSERT INTO team_members (team_id, user_id, role, status) VALUES (?, ?, 'member', ?)", [t.insertId, u, status]);
    };

    it("awards profile + first game once, and re-running changes nothing", async () => {
      const u = await createUser({ bio: "hi", picture: "https://x/y.png" });
      await addGame(u);
      await svc.syncOneTimeCoins(u);
      await svc.syncOneTimeCoins(u);
      assert.equal(await balanceOf(u), 25 + 25);
    });

    it("needs both bio and picture for profile completion", async () => {
      const u = await createUser({ bio: "hi" });
      await svc.syncOneTimeCoins(u);
      assert.equal(await balanceOf(u), 0);
    });

    it("holds team-join coins as pending, then vests them if still a member", async () => {
      const u = await createUser();
      await joinTeam(u);
      await svc.syncOneTimeCoins(u);
      assert.deepEqual(await svc.getBalance(u), { available: 0, pending: 50 });

      await svc.settlePending(u);                       // not yet due
      assert.equal(await balanceOf(u), 0);

      const pool = await getPool();
      await pool.query("UPDATE coin_ledger SET available_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE user_id = ?", [u]);
      await svc.settlePending(u);
      assert.deepEqual(await svc.getBalance(u), { available: 50, pending: 0 });
    });

    it("reverses team-join coins if the user left before vesting", async () => {
      const u = await createUser();
      await joinTeam(u);
      await svc.syncOneTimeCoins(u);
      const pool = await getPool();
      await pool.query("UPDATE team_members SET status = 'inactive' WHERE user_id = ?", [u]);
      await pool.query("UPDATE coin_ledger SET available_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE user_id = ?", [u]);
      await svc.settlePending(u);
      assert.deepEqual(await svc.getBalance(u), { available: 0, pending: 0 });
      assert.equal((await ledgerRows(u, "status = 'reversed'")).length, 1);
    });
  });

  // ── Redemption ─────────────────────────────────────────────────────────────
  describe("redemption", () => {
    it("rejects when the user can't afford it", async () => {
      const u = await createUser();
      await giveCoins(u, 999);
      await rejects(svc.redeemReward(u, await giftCardId(10)), "INSUFFICIENT_COINS");
      assert.equal(await balanceOf(u), 999);
    });

    it("deducts coins and queues a gift card request", async () => {
      const u = await createUser();
      await giveCoins(u, 1500);
      const r = await svc.redeemReward(u, await giftCardId(10));
      assert.equal(r.status, "requested");
      assert.equal(r.coins_spent, 1000);
      assert.equal(await balanceOf(u), 500);
    });

    it("enforces eligibility: unverified email, new account, banned, paused", async () => {
      const gift = await giftCardId(10);
      const unverified = await createUser({ verified: false });
      const fresh = await createUser({ ageDays: 1 });
      const banned = await createUser({ status: "banned" });
      for (const u of [unverified, fresh, banned]) await giveCoins(u, 5000);
      await rejects(svc.redeemReward(unverified, gift), "EMAIL_NOT_VERIFIED");
      await rejects(svc.redeemReward(fresh, gift), "ACCOUNT_TOO_NEW");
      await rejects(svc.redeemReward(banned, gift), "NOT_ELIGIBLE");

      const ok = await createUser();
      await giveCoins(ok, 5000);
      await setSetting("redemptions_enabled", 0);
      await rejects(svc.redeemReward(ok, gift), "REDEMPTIONS_DISABLED");
    });

    it("enforces the monthly cash limit, and rejected requests don't count against it", async () => {
      const u = await createUser();
      await giveCoins(u, 10000);
      const gift = await giftCardId(10);
      const first = await svc.redeemReward(u, gift);
      await svc.redeemReward(u, gift);
      await rejects(svc.redeemReward(u, gift), "MONTHLY_LIMIT");

      await svc.rejectRedemption(first.redemption_id, null, "test");
      await svc.redeemReward(u, gift);                 // slot freed
      assert.equal(await balanceOf(u), 10000 - 2000);
    });

    it("3 simultaneous redeems with coins for only 1 -> exactly 1 succeeds, balance never negative", async () => {
      const u = await createUser();
      await giveCoins(u, 1000);
      await setSetting("max_cash_redemptions_per_month", 100);
      const gift = await giftCardId(10);
      const results = await Promise.allSettled([1, 2, 3].map(() => svc.redeemReward(u, gift)));
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      for (const r of results.filter((x) => x.status === "rejected")) assert.equal(r.reason.code, "INSUFFICIENT_COINS");
      assert.equal(await balanceOf(u), 0);
      const pool = await getPool();
      const [[c]] = await pool.query("SELECT COUNT(*) AS n FROM redemptions WHERE user_id = ?", [u]);
      assert.equal(Number(c.n), 1);
    });

    it("never oversells limited stock (2 users, 1 unit)", async () => {
      const a = await createUser();
      const b = await createUser();
      await giveCoins(a, 1000); await giveCoins(b, 1000);
      const gift = await giftCardId(10);
      const pool = await getPool();
      await pool.query("UPDATE reward_catalog SET stock = 1 WHERE reward_id = ?", [gift]);
      const results = await Promise.allSettled([svc.redeemReward(a, gift), svc.redeemReward(b, gift)]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const [[row]] = await pool.query("SELECT stock FROM reward_catalog WHERE reward_id = ?", [gift]);
      assert.equal(row.stock, 0);
    });

    it("Pro-days rewards fulfil instantly, unlock Pro, and repeat redemptions extend the same subscription", async () => {
      const u = await createUser();
      await giveCoins(u, 3000);
      assert.equal(await feature.hasFeature(u, "coin_multiplier"), false);
      const first = await svc.redeemReward(u, await proDaysId(3));
      assert.equal(first.status, "fulfilled");
      assert.equal(await feature.hasFeature(u, "coin_multiplier"), true);
      await svc.redeemReward(u, await proDaysId(3));

      const pool = await getPool();
      const [subs] = await pool.query(
        "SELECT TIMESTAMPDIFF(HOUR, NOW(), renews_at) AS hrs FROM subscriptions WHERE user_id = ? AND gateway = 'coins'", [u]
      );
      assert.equal(subs.length, 1);
      assert.ok(subs[0].hrs >= 6 * 24 - 1 && subs[0].hrs <= 6 * 24, `expected ~6 days, got ${subs[0].hrs}h`);
    });
  });

  // ── Rejection / refunds ────────────────────────────────────────────────────
  describe("rejection", () => {
    const setup = async () => {
      const u = await createUser();
      await giveCoins(u, 1000);
      const gift = await giftCardId(10);
      const pool = await getPool();
      await pool.query("UPDATE reward_catalog SET stock = 5 WHERE reward_id = ?", [gift]);
      const r = await svc.redeemReward(u, gift);
      return { u, gift, id: r.redemption_id, pool };
    };

    it("refunds the coins through a ledger credit and returns the stock", async () => {
      const { u, gift, id, pool } = await setup();
      assert.equal(await balanceOf(u), 0);
      await svc.rejectRedemption(id, null, "bad request");
      assert.equal(await balanceOf(u), 1000);
      const [[row]] = await pool.query("SELECT stock FROM reward_catalog WHERE reward_id = ?", [gift]);
      assert.equal(row.stock, 5);
      assert.equal((await ledgerRows(u, "reason = 'redemption'")).length, 1, "original spend row must remain (append-only)");
    });

    it("refuses to reject twice", async () => {
      const { id } = await setup();
      await svc.rejectRedemption(id, null, "x");
      await rejects(svc.rejectRedemption(id, null, "x"), "BAD_STATE");
    });

    it("two simultaneous rejects refund exactly once", async () => {
      const { u, id } = await setup();
      const res = await Promise.allSettled([svc.rejectRedemption(id, null, "a"), svc.rejectRedemption(id, null, "b")]);
      assert.equal(res.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(await balanceOf(u), 1000);
      assert.equal((await ledgerRows(u, "reason = 'redemption_refund'")).length, 1);
    });
  });

  // ── Exchange rate (admin controller) ───────────────────────────────────────
  describe("exchange rate changes", () => {
    const put = async (admin, settings) => {
      const res = mockRes();
      await adminCtl.updateCoinSettings({ body: { settings }, user: { id: admin } }, res, (e) => { throw e; });
      return res;
    };

    it("refuses a more-than-2x jump, accepts a smaller one, and audits it", async () => {
      const admin = await createUser({ username: "boss" });
      const tooBig = await put(admin, { coins_per_inr: 300 });
      assert.equal(tooBig.statusCode, 400);
      assert.equal((await svc.getSettings()).coins_per_inr, 100);

      const ok = await put(admin, { coins_per_inr: 150 });
      assert.equal(ok.body.success, true);
      assert.equal((await svc.getSettings()).coins_per_inr, 150);

      const pool = await getPool();
      const [audit] = await pool.query("SELECT old_value, new_value FROM coin_settings_audit WHERE setting_key = 'coins_per_inr'");
      assert.deepEqual(audit.map((a) => [a.old_value, a.new_value]), [["100", "150"]]);
    });

    it("reprices cash rewards on the next redemption, and leaves Pro-days alone", async () => {
      const admin = await createUser({ username: "boss" });
      await put(admin, { coins_per_inr: 150 });
      const settings = await svc.getSettings();
      const pool = await getPool();
      const [[gift]] = await pool.query("SELECT * FROM reward_catalog WHERE type = 'gift_card' AND inr_value = 10");
      const [[pro]] = await pool.query("SELECT * FROM reward_catalog WHERE type = 'pro_days' AND pro_days = 3");
      assert.equal(svc.rewardCoinCost(gift, settings), 1500);
      assert.equal(svc.rewardCoinCost(pro, settings), 1500); // fixed coin cost
    });

    it("rejects out-of-range and unknown settings", () => {
      assert.ok(svc.validateSetting("coins_per_inr", 5).error);
      assert.ok(svc.validateSetting("nope", 1).error);
      assert.equal(svc.validateSetting("earn_login", 7).error, undefined);
    });
  });

  // ── Ban handling ───────────────────────────────────────────────────────────
  describe("freezeUserCoins (ban)", () => {
    it("rejects open redemptions, reverses pending, zeroes balance, keeps delivered rewards", async () => {
      const u = await createUser();
      await giveCoins(u, 4000);
      const delivered = await svc.redeemReward(u, await proDaysId(3));   // fulfilled, 1500
      const open = await svc.redeemReward(u, await giftCardId(10));      // requested, 1000
      const pool = await getPool();
      await pool.query(
        `INSERT INTO coin_ledger (user_id, delta, reason, ref_key, status, available_at)
         VALUES (?, 50, 'team_join', 'team_join', 'pending', DATE_ADD(NOW(), INTERVAL 3 DAY))`, [u]
      );
      assert.deepEqual(await svc.getBalance(u), { available: 1500, pending: 50 });

      const out = await svc.freezeUserCoins(u, null);
      assert.equal(out.rejected_redemptions, 1);
      assert.equal(out.coins_removed, 2500);                              // 1500 left + 1000 refunded
      assert.deepEqual(await svc.getBalance(u), { available: 0, pending: 0 });

      const [reds] = await pool.query("SELECT redemption_id, status, admin_note FROM redemptions WHERE user_id = ?", [u]);
      const byId = Object.fromEntries(reds.map((r) => [r.redemption_id, r]));
      assert.equal(byId[open.redemption_id].status, "rejected");
      assert.equal(byId[open.redemption_id].admin_note, "Account banned");
      assert.equal(byId[delivered.redemption_id].status, "fulfilled");
      assert.equal((await ledgerRows(u, "reason = 'ban_reversal'")).length, 1);
    });

    it("is safe to run twice and never creates a negative balance", async () => {
      const u = await createUser();
      await giveCoins(u, 300);
      await svc.freezeUserCoins(u, null);
      const again = await svc.freezeUserCoins(u, null);
      assert.equal(again.coins_removed, 0);
      assert.equal((await ledgerRows(u, "reason = 'ban_reversal'")).length, 1);
      assert.equal(await balanceOf(u), 0);
    });
  });

  // ── Admin adjustment ───────────────────────────────────────────────────────
  describe("adminAdjustCoins", () => {
    it("grants and deducts, stamping the admin id into the note", async () => {
      const u = await createUser();
      await svc.adminAdjustCoins(u, 7, 100, "goodwill");
      await svc.adminAdjustCoins(u, 7, -40, "correction");
      assert.equal(await balanceOf(u), 60);
      const rows = await ledgerRows(u, "reason = 'admin_adjust'");
      assert.equal(rows.length, 2);
      assert.match(rows[0].note, /^\[admin #7\] goodwill$/);
    });

    it("refuses a deduction larger than the available balance", async () => {
      const u = await createUser();
      await giveCoins(u, 50);
      await rejects(svc.adminAdjustCoins(u, 1, -51, "too much"), "INSUFFICIENT_BALANCE");
      assert.equal(await balanceOf(u), 50);
    });

    it("two simultaneous deductions can't overdraw", async () => {
      const u = await createUser();
      await giveCoins(u, 100);
      const res = await Promise.allSettled([
        svc.adminAdjustCoins(u, 1, -80, "first"), svc.adminAdjustCoins(u, 1, -80, "second"),
      ]);
      assert.equal(res.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(await balanceOf(u), 20);
    });

    it("validates amount, note and user", async () => {
      const u = await createUser();
      await rejects(svc.adminAdjustCoins(u, 1, 0, "zero"), "BAD_AMOUNT");
      await rejects(svc.adminAdjustCoins(u, 1, 1.5, "fraction"), "BAD_AMOUNT");
      await rejects(svc.adminAdjustCoins(u, 1, "abc", "nan"), "BAD_AMOUNT");
      await rejects(svc.adminAdjustCoins(u, 1, svc.MAX_ADMIN_ADJUST + 1, "huge"), "BAD_AMOUNT");
      await rejects(svc.adminAdjustCoins(u, 1, 10, "  "), "NOTE_REQUIRED");
      await rejects(svc.adminAdjustCoins(999999, 1, 10, "ghost"), "USER_NOT_FOUND");
      assert.equal((await ledgerRows(u)).length, 0);
    });
  });
});
