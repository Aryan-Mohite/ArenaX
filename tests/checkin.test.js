// Integration tests for tournament check-in. Real database, no mocks.
//   DB_HOST=127.0.0.1 DB_USER=... DB_PASSWORD=... DB_NAME=arenax_test npm test
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { skipReason, getPool, resetDb, createUser, mockRes } from "./helpers.js";

const ctl = skipReason ? null : await import("../src/controllers/checkInController.js");
const tCtl = skipReason ? null : await import("../src/controllers/tournamentController.js");

const call = async (fn, { user, params = {}, body = {} }) => {
  const res = mockRes();
  let err;
  await fn({ user, params, body }, res, (e) => { err = e; });
  if (err) throw err;
  return res;
};

describe("tournament check-in", { skip: skipReason }, () => {
  let pool, gameId, org, outsider, tid;
  let capA, memA, capB, teamA, teamB, teamC, capC;

  const team = async (name, captain, extraMember) => {
    const [r] = await pool.query("INSERT INTO teams (team_name, game_id, created_by) VALUES (?, ?, ?)", [name, gameId, captain]);
    await pool.query("INSERT INTO team_members (team_id, user_id, `role`, status) VALUES (?, ?, 'captain', 'active')", [r.insertId, captain]);
    if (extraMember) await pool.query("INSERT INTO team_members (team_id, user_id, `role`, status) VALUES (?, ?, 'member', 'active')", [r.insertId, extraMember]);
    return r.insertId;
  };
  const register = (team_id, status = "pending") =>
    pool.query("INSERT INTO tournament_registrations (tournament_id, team_id, status) VALUES (?, ?, ?)", [tid, team_id, status]);
  const reg = async (team_id) => (await pool.query("SELECT * FROM tournament_registrations WHERE tournament_id = ? AND team_id = ?", [tid, team_id]))[0][0];
  const orgUser = () => ({ id: org });

  before(async () => { pool = await getPool(); });
  after(async () => {
    await pool.query("DELETE FROM tournaments WHERE name LIKE 'CHECKIN_TEST%'");
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM tournaments WHERE name LIKE 'CHECKIN_TEST%'");
    await resetDb();
    await pool.query("DELETE FROM notifications");
    [[{ game_id: gameId }]] = await pool.query("SELECT game_id FROM games LIMIT 1");
    org = await createUser(); outsider = await createUser();
    capA = await createUser(); memA = await createUser(); capB = await createUser(); capC = await createUser();
    const [t] = await pool.query("INSERT INTO tournaments (name, game_id, created_by, status) VALUES ('CHECKIN_TEST', ?, ?, 'upcoming')", [gameId, org]);
    tid = t.insertId;
    teamA = await team("CI Team A", capA, memA); teamB = await team("CI Team B", capB); teamC = await team("CI Team C", capC);
    await register(teamA); await register(teamB); await register(teamC);
  });

  it("only the organizer (or admin) can open check-in, and only while active", async () => {
    let r = await call(ctl.setCheckInOpen, { user: { id: outsider }, params: { id: tid }, body: { open: true } });
    assert.equal(r.statusCode, 403);
    r = await call(ctl.setCheckInOpen, { user: { id: outsider, isAdmin: true }, params: { id: tid }, body: { open: true } });
    assert.equal(r.body.check_in_open, true);
    await pool.query("UPDATE tournaments SET status = 'completed', check_in_open = 0 WHERE tournament_id = ?", [tid]);
    r = await call(ctl.setCheckInOpen, { user: orgUser(), params: { id: tid }, body: { open: true } });
    assert.equal(r.statusCode, 400);
    r = await call(ctl.setCheckInOpen, { user: orgUser(), params: { id: tid }, body: { open: "yes" } });
    assert.equal(r.statusCode, 400);
  });

  it("opening notifies each member of registered teams once (not on repeat opens)", async () => {
    let r = await call(ctl.setCheckInOpen, { user: orgUser(), params: { id: tid }, body: { open: true } });
    assert.equal(r.body.notified, 4); // capA, memA, capB, capC
    const [[{ n }]] = await pool.query("SELECT COUNT(*) n FROM notifications WHERE related_id = ? AND type = 'tournament'", [tid]);
    assert.equal(Number(n), 4);
    r = await call(ctl.setCheckInOpen, { user: orgUser(), params: { id: tid }, body: { open: true } });
    assert.equal(r.body.notified, 0);
  });

  it("captain check-in: needs open window, captain role, a registration; is idempotent", async () => {
    let r = await call(ctl.checkInTeam, { user: { id: capA }, params: { id: tid }, body: { team_id: teamA } });
    assert.equal(r.statusCode, 400); // closed
    await call(ctl.setCheckInOpen, { user: orgUser(), params: { id: tid }, body: { open: true } });

    r = await call(ctl.checkInTeam, { user: { id: memA }, params: { id: tid }, body: { team_id: teamA } });
    assert.equal(r.statusCode, 403); // plain member
    r = await call(ctl.checkInTeam, { user: { id: capA }, params: { id: tid }, body: { team_id: teamB } });
    assert.equal(r.statusCode, 403); // captain of a different team
    const [loose] = await pool.query("INSERT INTO teams (team_name, game_id, created_by) VALUES ('CI Unreg', ?, ?)", [gameId, outsider]);
    await pool.query("INSERT INTO team_members (team_id, user_id, `role`, status) VALUES (?, ?, 'captain', 'active')", [loose.insertId, outsider]);
    r = await call(ctl.checkInTeam, { user: { id: outsider }, params: { id: tid }, body: { team_id: loose.insertId } });
    assert.equal(r.statusCode, 404); // not registered

    r = await call(ctl.checkInTeam, { user: { id: capA }, params: { id: tid }, body: { team_id: teamA } });
    assert.equal(r.body.already, false);
    const first = (await reg(teamA)).checked_in_at;
    assert.ok(first);
    r = await call(ctl.checkInTeam, { user: { id: capA }, params: { id: tid }, body: { team_id: teamA } });
    assert.equal(r.body.already, true);
    assert.equal(String((await reg(teamA)).checked_in_at), String(first));
    assert.equal((await reg(teamA)).checked_in_by, capA);
  });

  it("10 simultaneous check-ins for one team write exactly once", async () => {
    await call(ctl.setCheckInOpen, { user: orgUser(), params: { id: tid }, body: { open: true } });
    const rs = await Promise.all(Array.from({ length: 10 }, () => call(ctl.checkInTeam, { user: { id: capA }, params: { id: tid }, body: { team_id: teamA } })));
    assert.ok(rs.every((r) => r.body.success));
    assert.ok((await reg(teamA)).checked_in_at);
  });

  it("finalize marks only teams that did not check in as no_show and closes check-in", async () => {
    await call(ctl.setCheckInOpen, { user: orgUser(), params: { id: tid }, body: { open: true } });
    await call(ctl.checkInTeam, { user: { id: capA }, params: { id: tid }, body: { team_id: teamA } });
    await pool.query("UPDATE tournament_registrations SET status = 'disqualified' WHERE tournament_id = ? AND team_id = ?", [tid, teamC]);

    let r = await call(ctl.finalizeCheckIn, { user: { id: outsider }, params: { id: tid } });
    assert.equal(r.statusCode, 403);
    r = await call(ctl.finalizeCheckIn, { user: orgUser(), params: { id: tid } });
    assert.equal(r.body.marked_no_show, 1); // only team B
    assert.equal((await reg(teamA)).status, "pending");
    assert.equal((await reg(teamB)).status, "no_show");
    assert.equal((await reg(teamC)).status, "disqualified"); // untouched
    const [[t]] = await pool.query("SELECT check_in_open FROM tournaments WHERE tournament_id = ?", [tid]);
    assert.equal(Number(t.check_in_open), 0);

    // a no-show team cannot check in afterwards, even if the window is reopened
    await pool.query("UPDATE tournaments SET check_in_open = 1 WHERE tournament_id = ?", [tid]);
    r = await call(ctl.checkInTeam, { user: { id: capB }, params: { id: tid }, body: { team_id: teamB } });
    assert.equal(r.statusCode, 400);
  });

  it("organizer override rescues a no-show and can undo a check-in", async () => {
    await call(ctl.finalizeCheckIn, { user: orgUser(), params: { id: tid } });
    assert.equal((await reg(teamB)).status, "no_show");
    let r = await call(ctl.setTeamCheckIn, { user: orgUser(), params: { id: tid, teamId: teamB }, body: { checked_in: true } });
    assert.ok(r.body.success);
    const b = await reg(teamB);
    assert.equal(b.status, "confirmed");
    assert.equal(b.checked_in_by, org);
    await call(ctl.setTeamCheckIn, { user: orgUser(), params: { id: tid, teamId: teamB }, body: { checked_in: false } });
    assert.equal((await reg(teamB)).checked_in_at, null);
    r = await call(ctl.setTeamCheckIn, { user: { id: outsider }, params: { id: tid, teamId: teamB }, body: { checked_in: true } });
    assert.equal(r.statusCode, 403);
    await pool.query("UPDATE tournament_registrations SET status = 'disqualified' WHERE tournament_id = ? AND team_id = ?", [tid, teamC]);
    r = await call(ctl.setTeamCheckIn, { user: orgUser(), params: { id: tid, teamId: teamC }, body: { checked_in: true } });
    assert.equal(r.statusCode, 400);
  });

  it("GET shows organizers everything and captains only their own teams", async () => {
    await call(ctl.setCheckInOpen, { user: orgUser(), params: { id: tid }, body: { open: true } });
    await call(ctl.checkInTeam, { user: { id: capA }, params: { id: tid }, body: { team_id: teamA } });
    let r = await call(ctl.getCheckIn, { user: orgUser(), params: { id: tid } });
    assert.equal(r.body.role, "organizer");
    assert.equal(r.body.teams.length, 3);
    assert.deepEqual(r.body.summary, { total: 3, checked_in: 1, no_show: 0 });
    r = await call(ctl.getCheckIn, { user: { id: capB }, params: { id: tid } });
    assert.equal(r.body.role, "captain");
    assert.deepEqual(r.body.my_teams.map((x) => x.team_name), ["CI Team B"]);
    assert.equal(r.body.my_teams[0].checked_in_at, null);
    r = await call(ctl.getCheckIn, { user: { id: memA }, params: { id: tid } });
    assert.equal(r.body.my_teams.length, 0); // plain member sees nothing to act on
    r = await call(ctl.getCheckIn, { user: orgUser(), params: { id: 999999 } });
    assert.equal(r.statusCode, 404);
  });

  it("analytics: no-show and check-in rates come from real attendance", async () => {
    await call(ctl.setCheckInOpen, { user: orgUser(), params: { id: tid }, body: { open: true } });
    await call(ctl.checkInTeam, { user: { id: capA }, params: { id: tid }, body: { team_id: teamA } });
    await call(ctl.finalizeCheckIn, { user: orgUser(), params: { id: tid } }); // B and C no-show
    const r = await call(tCtl.getTournamentAnalytics, { user: orgUser(), params: { id: tid } });
    assert.equal(r.body.analytics.checkInRate, 0.333);
    assert.equal(r.body.analytics.noShowRate, 0.667);
  });
});
