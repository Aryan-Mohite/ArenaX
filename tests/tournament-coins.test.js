// Integration tests for tournament attendance coins. Real database, no mocks.
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { skipReason, getPool, resetDb, createUser, setSetting } from "./helpers.js";

const svc = skipReason ? null : await import("../src/services/tournamentCoinService.js");
const sig = skipReason ? null : await import("../src/services/signalService.js");
const coin = skipReason ? null : await import("../src/services/coinService.js");
const settle = skipReason ? null : coin.settlePending;

const fakeReq = (ip, device) => ({ ip, get: (h) => ({ "x-device-id": device, "user-agent": "UA" })[h.toLowerCase()] });
const dev = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

describe("tournament attendance coins", { skip: skipReason }, () => {
  let pool, gameId, org, tid;
  const team = async (name, captain, members = []) => {
    const [r] = await pool.query("INSERT INTO teams (team_name, game_id, created_by) VALUES (?, ?, ?)", [name, gameId, captain]);
    await pool.query("INSERT INTO team_members (team_id, user_id, `role`, status) VALUES (?, ?, 'captain', 'active')", [r.insertId, captain]);
    for (const m of members) await pool.query("INSERT INTO team_members (team_id, user_id, `role`, status) VALUES (?, ?, 'member', 'active')", [r.insertId, m]);
    return r.insertId;
  };
  const enter = (team_id, checkedIn = true, status = "pending") =>
    pool.query("INSERT INTO tournament_registrations (tournament_id, team_id, status, checked_in_at) VALUES (?, ?, ?, ?)", [tid, team_id, status, checkedIn ? new Date() : null]);
  const complete = () => pool.query("UPDATE tournaments SET status = 'completed' WHERE tournament_id = ?", [tid]);
  const ledger = async (u) => (await pool.query("SELECT * FROM coin_ledger WHERE user_id = ? AND reason = 'tournament_attendance'", [u]))[0];
  // 4 checked-in teams of 2 players each; returns all player ids
  const standardField = async (n = 4) => {
    const players = [];
    for (let i = 0; i < n; i++) {
      const c = await createUser({ ageDays: 30 }), m = await createUser({ ageDays: 30 });
      players.push(c, m);
      await enter(await team(`TC Team ${i}`, c, [m]));
    }
    return players;
  };

  before(async () => { pool = await getPool(); });
  after(async () => { await pool.query("DELETE FROM tournaments WHERE name LIKE 'TC_TEST%'"); await pool.end(); });
  beforeEach(async () => {
    await pool.query("DELETE FROM tournaments WHERE name LIKE 'TC_TEST%'");
    await resetDb();
    await pool.query("DELETE FROM organizer_verifications");
    [[{ game_id: gameId }]] = await pool.query("SELECT game_id FROM games LIMIT 1");
    org = await createUser({ ageDays: 60 });
    await pool.query("INSERT INTO organizer_verifications (user_id, status) VALUES (?, 'approved')", [org]);
    const [t] = await pool.query("INSERT INTO tournaments (name, game_id, created_by, status) VALUES ('TC_TEST', ?, ?, 'ongoing')", [gameId, org]);
    tid = t.insertId;
  });

  it("pays every player on checked-in teams once, as pending, with the default amount", async () => {
    const players = await standardField();
    await complete();
    const r = await svc.awardTournamentCoins(tid);
    assert.equal(r.reason, "paid");
    assert.equal(r.paid, 8);
    const rows = await ledger(players[0]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].delta, 40);
    assert.equal(rows[0].status, "pending");
    const again = await svc.awardTournamentCoins(tid); // idempotent
    assert.equal(again.paid, 0);
    assert.equal((await ledger(players[0])).length, 1);
  });

  it("pays nothing before the tournament is completed", async () => {
    await standardField();
    const r = await svc.awardTournamentCoins(tid);
    assert.equal(r.reason, "not_completed");
  });

  it("no-shows, disqualified teams and teams that never checked in earn nothing", async () => {
    const field = await standardField(4);
    const ns = await createUser({ ageDays: 30 }), dq = await createUser({ ageDays: 30 }), nci = await createUser({ ageDays: 30 });
    await enter(await team("TC NS", ns), true, "no_show");
    await enter(await team("TC DQ", dq), true, "disqualified");
    await enter(await team("TC NCI", nci), false);
    await complete();
    await svc.awardTournamentCoins(tid);
    for (const u of [ns, dq, nci]) assert.equal((await ledger(u)).length, 0);
    assert.equal((await ledger(field[0])).length, 1);
  });

  it("too few checked-in teams pays nothing; the minimum is editable", async () => {
    await standardField(3);
    await complete();
    assert.equal((await svc.awardTournamentCoins(tid)).reason, "too_few_teams");
    await setSetting("tournament_min_teams", 3);
    assert.equal((await svc.awardTournamentCoins(tid)).reason, "paid");
  });

  it("unverified organizer pays nothing unless the check is turned off; admin-run events pass", async () => {
    await pool.query("DELETE FROM organizer_verifications");
    await standardField();
    await complete();
    assert.equal((await svc.awardTournamentCoins(tid)).reason, "organizer_not_verified");
    const [[o]] = await pool.query("SELECT email FROM users WHERE user_id = ?", [org]);
    process.env.ADMIN_EMAILS = `someone@else.com, ${o.email.toUpperCase()}`;
    assert.equal((await svc.awardTournamentCoins(tid)).reason, "paid");
    delete process.env.ADMIN_EMAILS;
  });

  it("verified-organizer check can be switched off", async () => {
    await pool.query("DELETE FROM organizer_verifications");
    await setSetting("tournament_require_verified_organizer", 0);
    await standardField();
    await complete();
    assert.equal((await svc.awardTournamentCoins(tid)).reason, "paid");
  });

  it("organizer, new accounts, unverified email and banned users are skipped", async () => {
    await standardField();
    const orgPlayer = org;
    await enter(await team("TC OrgTeam", orgPlayer));
    const young = await createUser({ ageDays: 0 });
    await enter(await team("TC Young", young));
    const banned = await createUser({ ageDays: 30 });
    await pool.query("UPDATE users SET status = 'banned' WHERE user_id = ?", [banned]);
    await enter(await team("TC Banned", banned));
    await complete();
    const r = await svc.awardTournamentCoins(tid);
    for (const u of [orgPlayer, young, banned]) assert.equal((await ledger(u)).length, 0);
    assert.ok(r.skipped.is_organizer && r.skipped.account_too_new && r.skipped.unverified_or_inactive);
  });

  it("one person on two teams / two accounts on one device is paid once", async () => {
    const a = await createUser({ ageDays: 30 }), b = await createUser({ ageDays: 30 });
    await sig.recordSignal(a, "login", fakeReq("1.1.1.1", dev(1)));
    await sig.recordSignal(b, "login", fakeReq("2.2.2.2", dev(1)));
    await enter(await team("TC DevA", a));
    await enter(await team("TC DevB", b));
    for (let i = 0; i < 2; i++) await enter(await team(`TC Pad ${i}`, await createUser({ ageDays: 30 })));
    await complete();
    const r = await svc.awardTournamentCoins(tid);
    assert.equal((await ledger(a)).length + (await ledger(b)).length, 1);
    assert.equal(r.skipped.shared_device, 1);
  });

  it("monthly cap is enforced per player and is editable (0 = nobody earns)", async () => {
    await setSetting("tournament_reward_monthly_cap", 1);
    const players = await standardField();
    await pool.query("INSERT INTO coin_ledger (user_id, delta, reason, ref_key, base_amount, status) VALUES (?, 40, 'tournament_attendance', 'tournament:99999', 40, 'available')", [players[0]]);
    await complete();
    const r = await svc.awardTournamentCoins(tid);
    assert.equal((await ledger(players[0])).length, 1); // only the pre-existing row
    assert.equal(r.paid, 7);
    assert.equal(r.skipped.monthly_cap, 1);
  });

  it("per-tournament player cap limits the cost", async () => {
    await setSetting("tournament_max_players", 5);
    await standardField();
    await complete();
    const r = await svc.awardTournamentCoins(tid);
    assert.equal(r.paid, 5);
    assert.equal(r.skipped.player_cap, 3);
  });

  it("amount of 0 turns it off; admin edits change the payout; Pro multiplier applies only if listed", async () => {
    const players = await standardField();
    await complete();
    await setSetting("earn_tournament_attendance", 0);
    assert.equal((await svc.awardTournamentCoins(tid)).reason, "disabled");
    await setSetting("earn_tournament_attendance", 75);
    await svc.awardTournamentCoins(tid);
    assert.equal((await ledger(players[0]))[0].delta, 75);
  });

  it("coins vest after the vest period, and are reversed if the player was banned meanwhile", async () => {
    const players = await standardField();
    await complete();
    await svc.awardTournamentCoins(tid);
    await pool.query("UPDATE users SET status = 'banned' WHERE user_id = ?", [players[0]]);
    await pool.query("UPDATE coin_ledger SET available_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE reason = 'tournament_attendance'");
    await settle(players[0]);
    await settle(players[1]);
    assert.equal((await ledger(players[0]))[0].status, "reversed");
    assert.equal((await ledger(players[1]))[0].status, "available");
  });

  it("recentTournamentPayouts summarises per tournament", async () => {
    await standardField();
    await complete();
    await svc.awardTournamentCoins(tid);
    const rows = await svc.recentTournamentPayouts(5);
    assert.equal(rows[0].players, 8);
    assert.equal(Number(rows[0].coins), 320);
    assert.equal(rows[0].name, "TC_TEST");
  });
});
