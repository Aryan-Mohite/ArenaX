// Integration tests for the investor traction link + snapshot. Real database, no mocks.
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { skipReason, getPool, resetDb, createUser, giveCoins, makePro } from "./helpers.js";

const ctl = skipReason ? null : await import("../src/controllers/tractionController.js");
const svc = skipReason ? null : await import("../src/services/tractionService.js");

const mk = () => {
  const res = { statusCode: 200, body: undefined, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.set = (h) => { Object.assign(res.headers, h); return res; };
  return res;
};
const call = async (fn, req) => { const res = mk(); let err; await fn({ params: {}, query: {}, body: {}, ...req }, res, (e) => { err = e; }); if (err) throw err; return res; };

describe("investor traction", { skip: skipReason }, () => {
  let pool, admin, gameId;
  before(async () => { pool = await getPool(); });
  after(async () => { await pool.query("DELETE FROM tournaments WHERE name LIKE 'TR_TEST%'"); await pool.query("DELETE FROM investor_links"); await pool.end(); });
  beforeEach(async () => {
    svc._clearTractionCache();
    await pool.query("DELETE FROM tournaments WHERE name LIKE 'TR_TEST%'");
    await pool.query("DELETE FROM investor_links");
    await resetDb();
    [[{ game_id: gameId }]] = await pool.query("SELECT game_id FROM games LIMIT 1");
    admin = await createUser({ ageDays: 90 });
  });
  const login = (u, daysAgo = 0) => pool.query("INSERT INTO events (user_id, event_type, created_at) VALUES (?, 'login', DATE_SUB(NOW(), INTERVAL ? DAY))", [u, daysAgo]);
  const tourney = async (name, source = "user", status = "completed") =>
    (await pool.query("INSERT INTO tournaments (name, game_id, created_by, status, source) VALUES (?, ?, ?, ?, ?)", [name, gameId, admin, status, source]))[0].insertId;

  it("link lifecycle: raw token returned once, only a hash stored, valid -> works, revoked/expired/garbage -> same 404", async () => {
    let r = await call(ctl.createInvestorLink, { user: { id: admin }, body: { label: "" } });
    assert.equal(r.statusCode, 400);
    r = await call(ctl.createInvestorLink, { user: { id: admin }, body: { label: "Angel A", expires_in_days: 7 } });
    assert.equal(r.statusCode, 201);
    const { token } = r.body;
    assert.match(token, /^[A-Za-z0-9_-]{32}$/);
    assert.equal(r.body.path, `/investors/${token}`);
    const [rows] = await pool.query("SELECT * FROM investor_links");
    assert.equal(rows.length, 1);
    assert.ok(!JSON.stringify(rows).includes(token));
    assert.match(rows[0].token_hash, /^[0-9a-f]{64}$/);

    let pub = await call(ctl.getPublicTraction, { params: { token } });
    assert.equal(pub.statusCode, 200);
    assert.equal(pub.headers["Cache-Control"], "no-store");
    assert.match(pub.headers["X-Robots-Tag"], /noindex/);
    await new Promise((r2) => setTimeout(r2, 100));
    const [[v]] = await pool.query("SELECT view_count, last_viewed_at FROM investor_links");
    assert.equal(v.view_count, 1);
    assert.ok(v.last_viewed_at);

    for (const bad of ["short", "x".repeat(70), "has space and ! chars padding padding", token.slice(0, -1) + (token.endsWith("a") ? "b" : "a")]) {
      const b = await call(ctl.getPublicTraction, { params: { token: bad } });
      assert.equal(b.statusCode, 404, bad);
      assert.equal(b.body.message, "This link is invalid or has expired.");
    }

    await pool.query("UPDATE investor_links SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE)");
    assert.equal((await call(ctl.getPublicTraction, { params: { token } })).statusCode, 404);
    await pool.query("UPDATE investor_links SET expires_at = DATE_ADD(NOW(), INTERVAL 1 DAY)");
    assert.equal((await call(ctl.getPublicTraction, { params: { token } })).statusCode, 200);

    const [[{ link_id }]] = await pool.query("SELECT link_id FROM investor_links");
    assert.equal((await call(ctl.revokeInvestorLink, { params: { id: link_id } })).statusCode, 200);
    assert.equal((await call(ctl.getPublicTraction, { params: { token } })).statusCode, 404);
    assert.equal((await call(ctl.revokeInvestorLink, { params: { id: link_id } })).statusCode, 404); // already revoked
    const list = await call(ctl.listInvestorLinks, {});
    assert.equal(list.body.links[0].state, "revoked");
    assert.equal(list.body.links[0].label, "Angel A");
  });

  it("expiry is clamped to 1-365 days", async () => {
    await call(ctl.createInvestorLink, { user: { id: admin }, body: { label: "x", expires_in_days: 99999 } });
    await call(ctl.createInvestorLink, { user: { id: admin }, body: { label: "y", expires_in_days: -5 } });
    const [rows] = await pool.query("SELECT label, DATEDIFF(expires_at, NOW()) AS d FROM investor_links ORDER BY link_id");
    assert.ok(rows[0].d >= 364 && rows[0].d <= 365);
    assert.ok(rows[1].d >= 0 && rows[1].d <= 1 + 29); // negative falls back to the 30-day default
  });

  it("snapshot never contains personal data", async () => {
    const u = await createUser({ username: "secret_person_77", ageDays: 40 });
    const [[{ email }]] = await pool.query("SELECT email FROM users WHERE user_id = ?", [u]);
    await login(u);
    const snap = await svc.getTractionSnapshot({ fresh: true });
    const json = JSON.stringify(snap);
    assert.ok(!json.includes("secret_person_77"));
    assert.ok(!json.includes(email));
    assert.ok(!/password|token_hash|ip_hash|device_id/i.test(json));
  });

  it("headline numbers: banned users excluded; DAU/WAU/MAU windows; signups growth", async () => {
    const a = await createUser({ ageDays: 3 }), b = await createUser({ ageDays: 10 }), c = await createUser({ ageDays: 40 });
    const banned = await createUser({ ageDays: 2 });
    await pool.query("UPDATE users SET status = 'banned' WHERE user_id = ?", [banned]);
    await login(a, 0); await login(b, 3); await login(c, 20); await login(banned, 0);
    await login(a, 0); // same user twice in a day counts once
    const s = await svc.getTractionSnapshot({ fresh: true });
    assert.equal(s.headline.total_users, 4); // admin + a + b + c (banned excluded)
    assert.equal(s.headline.dau, 1);          // only a; the banned user's login and a's duplicate do not count
    assert.equal(s.headline.wau, 2);          // a + b (3 days ago)
    assert.equal(s.headline.mau, 3);          // a + b + c (20 days ago)
    assert.equal(s.headline.stickiness, Number((1 / 3).toFixed(4)));
    assert.equal(s.headline.new_users_7d, 1); // a (3 days old); banned user excluded
    assert.equal(s.headline.new_users_30d, 2); // a + b
    const last = s.trend[59];
    assert.equal(last.active, 1);             // trend also excludes the banned login
  });

  it("growth compares each period with the one before it", async () => {
    for (let i = 0; i < 4; i++) await createUser({ ageDays: 3 });   // this week
    for (let i = 0; i < 2; i++) await createUser({ ageDays: 10 });  // previous week
    const s = await svc.getTractionSnapshot({ fresh: true });
    assert.equal(s.headline.new_users_7d, 4);
    assert.equal(s.headline.new_users_prev_7d, 2);
    assert.equal(s.headline.growth_7d, 1); // +100%
    assert.equal(s.headline.new_users_30d, 6); // all six are within 30 days
    assert.equal(s.headline.growth_30d, null); // nobody in the previous 30 days: no percentage rather than a fake one
  });

  it("hosted tournaments exclude imported pro events and pending/cancelled; with_teams counted separately", async () => {
    const real = await tourney("TR_TEST real", "user");
    await tourney("TR_TEST admin", "admin");
    await tourney("TR_TEST imported", "pandascore");
    await tourney("TR_TEST pending", "user", "pending_review");
    await tourney("TR_TEST cancelled", "user", "cancelled");
    const cap = await createUser(); const [t] = await pool.query("INSERT INTO teams (team_name, game_id, created_by) VALUES ('TR Team', ?, ?)", [gameId, cap]);
    await pool.query("INSERT INTO tournament_registrations (tournament_id, team_id, status) VALUES (?, ?, 'pending')", [real, t.insertId]);
    const s = await svc.getTractionSnapshot({ fresh: true });
    assert.equal(s.tournaments.hosted, 2);
    assert.equal(s.tournaments.with_teams, 1);
    assert.equal(s.tournaments.completed, 2);
  });

  it("attendance only counts tournaments that ran check-in, and only hosted ones", async () => {
    const tid = await tourney("TR_TEST ci", "user", "completed");
    const noCi = await tourney("TR_TEST noci", "user", "completed");
    const imported = await tourney("TR_TEST imp", "pandascore", "completed");
    const mkTeam = async (n) => { const c = await createUser(); return (await pool.query("INSERT INTO teams (team_name, game_id, created_by) VALUES (?, ?, ?)", [n, gameId, c]))[0].insertId; };
    const reg = async (t, team, status, ci) => pool.query("INSERT INTO tournament_registrations (tournament_id, team_id, status, checked_in_at) VALUES (?, ?, ?, ?)", [t, team, status, ci ? new Date() : null]);
    await reg(tid, await mkTeam("A1"), "pending", true);
    await reg(tid, await mkTeam("A2"), "pending", true);
    await reg(tid, await mkTeam("A3"), "pending", true);
    await reg(tid, await mkTeam("A4"), "no_show", false);
    await reg(noCi, await mkTeam("B1"), "pending", false); // no check-in run: excluded from rates
    await reg(imported, await mkTeam("C1"), "no_show", false); // imported: excluded
    const s = await svc.getTractionSnapshot({ fresh: true });
    const a = s.tournaments.attendance;
    assert.equal(a.tournaments_tracked, 1);
    assert.equal(a.registrations, 4);
    assert.equal(a.checked_in_rate, 0.75);
    assert.equal(a.no_show_rate, 0.25);
  });

  it("revenue excludes Pro granted via coins; counts paid subscriptions; admin billing MRR matches", async () => {
    const payer = await createUser(), coinPro = await createUser();
    await makePro(payer);                                   // gateway 'test' (paid)
    await makePro(coinPro);
    await pool.query("UPDATE subscriptions SET gateway = 'coins' WHERE user_id = ?", [coinPro]);
    const s = await svc.getTractionSnapshot({ fresh: true });
    assert.equal(s.revenue.paying_subscriptions, 1);
    const [[plan]] = await pool.query("SELECT price FROM plans WHERE plan_key = 'gamer_pro'");
    assert.equal(s.revenue.mrr_inr, Number(plan.price));

    const adminCtl = await import("../src/controllers/adminController.js");
    const res = mk(); await adminCtl.getBillingStats({}, res, (e) => { throw e; });
    assert.equal(res.body.billing.activeSubscriptions, 1);
    assert.equal(res.body.billing.mrr, Number(plan.price));
  });

  it("retention uses exact-day return and reports sample size; coins section is null until the economy has run", async () => {
    const users = [];
    for (let i = 0; i < 4; i++) users.push(await createUser({ ageDays: 10 }));
    // 2 of 4 return exactly on day 7 after signup
    for (const u of users.slice(0, 2)) await pool.query("INSERT INTO events (user_id, event_type, created_at) SELECT user_id, 'login', DATE_ADD(created_at, INTERVAL 7 DAY) FROM users WHERE user_id = ?", [u]);
    await pool.query("INSERT INTO events (user_id, event_type, created_at) SELECT user_id, 'login', DATE_ADD(created_at, INTERVAL 5 DAY) FROM users WHERE user_id = ?", [users[2]]); // day 5 does not count
    let s = await svc.getTractionSnapshot({ fresh: true });
    assert.equal(s.retention.d7.rate, 0.4);
    assert.equal(s.retention.d7.retained, 2);
    assert.equal(s.retention.d7.size, 5); // 4 new + admin, who has no day-7 login
    assert.equal(s.coins, null);

    await giveCoins(users[0], 500);
    await pool.query("UPDATE coin_ledger SET reason = 'login' WHERE user_id = ?", [users[0]]);
    s = await svc.getTractionSnapshot({ fresh: true });
    assert.ok(s.coins);
    assert.equal(s.coins.issued, 500);
    assert.equal(s.coins.outstanding_value_inr, 5); // 500 coins at 100 coins = Rs.1
  });

  it("snapshot is cached for 5 minutes unless fresh is requested", async () => {
    const s1 = await svc.getTractionSnapshot({ fresh: true });
    await createUser({ ageDays: 1 });
    const s2 = await svc.getTractionSnapshot();
    assert.equal(s2.headline.total_users, s1.headline.total_users);
    const s3 = await svc.getTractionSnapshot({ fresh: true });
    assert.equal(s3.headline.total_users, s1.headline.total_users + 1);
  });

  it("trend is a zero-filled 60-day series", async () => {
    await createUser({ ageDays: 0 });
    const s = await svc.getTractionSnapshot({ fresh: true });
    assert.equal(s.trend.length, 60);
    assert.ok(s.trend.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day) && d.signups >= 0 && d.active >= 0));
    assert.equal(s.trend[59].signups, 1); // the user created just now
    assert.equal(s.trend[0].signups, 0);
  });
});
