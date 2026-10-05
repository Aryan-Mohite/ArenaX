import pool from "../config/db.js";

// Tournament check-in.
//   Organizer opens check-in  -> every member of every registered team is notified.
//   Team captain checks the team in while it is open.
//   Organizer can check a team in by hand, undo it, and finalize: teams that
//   never checked in are marked status = 'no_show' and check-in closes.
// Nothing here awards coins. This only produces trustworthy attendance data.

const ACTIVE = ["upcoming", "ongoing"];

async function loadTournament(id) {
  const [rows] = await pool.query(
    "SELECT tournament_id, name, created_by, status, check_in_open FROM tournaments WHERE tournament_id = ?",
    [id]
  );
  return rows[0] || null;
}
const isOrganizer = (t, req) => t.created_by === req.user.id || !!req.user.isAdmin;

// ─── ORGANIZER: open / close ────────────────────────────────────────────────
// PATCH /api/tournaments/:id/check-in  { open: boolean }
export const setCheckInOpen = async (req, res, next) => {
  try {
    const t = await loadTournament(req.params.id);
    if (!t) return res.status(404).json({ success: false, message: "Tournament not found" });
    if (!isOrganizer(t, req))
      return res.status(403).json({ success: false, message: "Only the organizer or an admin can do this" });
    if (typeof req.body.open !== "boolean")
      return res.status(400).json({ success: false, message: "open must be true or false" });
    if (req.body.open && !ACTIVE.includes(t.status))
      return res.status(400).json({ success: false, message: "Check-in can only be opened for upcoming or ongoing tournaments" });

    const wasOpen = !!t.check_in_open;
    await pool.query("UPDATE tournaments SET check_in_open = ? WHERE tournament_id = ?", [req.body.open ? 1 : 0, t.tournament_id]);

    let notified = 0;
    if (req.body.open && !wasOpen) {
      const [recipients] = await pool.query(
        `SELECT DISTINCT tm.user_id
           FROM tournament_registrations tr
           JOIN team_members tm ON tm.team_id = tr.team_id AND tm.status = 'active'
          WHERE tr.tournament_id = ? AND tr.status NOT IN ('disqualified', 'no_show')`,
        [t.tournament_id]
      );
      if (recipients.length) {
        const msg = `Check-in is now open for "${t.name}". Your team captain needs to check the team in.`;
        await pool.query(
          "INSERT INTO notifications (user_id, type, message, related_id) VALUES ?",
          [recipients.map((r) => [r.user_id, "tournament", msg, t.tournament_id])]
        );
        notified = recipients.length;
      }
    }
    res.json({ success: true, check_in_open: !!req.body.open, notified });
  } catch (err) { next(err); }
};

// ─── CAPTAIN: check a team in ───────────────────────────────────────────────
// POST /api/tournaments/:id/check-in  { team_id }
export const checkInTeam = async (req, res, next) => {
  try {
    const t = await loadTournament(req.params.id);
    if (!t) return res.status(404).json({ success: false, message: "Tournament not found" });
    if (!t.check_in_open)
      return res.status(400).json({ success: false, message: "Check-in is not open for this tournament" });

    const teamId = Number(req.body.team_id);
    if (!Number.isInteger(teamId) || teamId < 1)
      return res.status(400).json({ success: false, message: "team_id is required" });

    const [cap] = await pool.query(
      "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active' AND `role` = 'captain'",
      [teamId, req.user.id]
    );
    if (!cap.length)
      return res.status(403).json({ success: false, message: "Only the team captain can check the team in" });

    const [regs] = await pool.query(
      "SELECT registration_id, status, checked_in_at FROM tournament_registrations WHERE tournament_id = ? AND team_id = ?",
      [t.tournament_id, teamId]
    );
    if (!regs.length)
      return res.status(404).json({ success: false, message: "This team is not registered for the tournament" });
    const reg = regs[0];
    if (reg.status === "disqualified" || reg.status === "no_show")
      return res.status(400).json({ success: false, message: "This team can no longer check in" });
    if (reg.checked_in_at)
      return res.json({ success: true, already: true, checked_in_at: reg.checked_in_at });

    // Conditional update: two simultaneous taps cannot double-write.
    await pool.query(
      "UPDATE tournament_registrations SET checked_in_at = NOW(), checked_in_by = ? WHERE registration_id = ? AND checked_in_at IS NULL",
      [req.user.id, reg.registration_id]
    );
    res.json({ success: true, already: false });
  } catch (err) { next(err); }
};

// ─── READ ───────────────────────────────────────────────────────────────────
// GET /api/tournaments/:id/check-in
//   organizer/admin -> every registered team + summary
//   everyone else   -> only the teams they captain that are registered
export const getCheckIn = async (req, res, next) => {
  try {
    const t = await loadTournament(req.params.id);
    if (!t) return res.status(404).json({ success: false, message: "Tournament not found" });

    if (isOrganizer(t, req)) {
      const [teams] = await pool.query(
        `SELECT tr.registration_id, te.team_id, te.team_name, tr.status, tr.checked_in_at
           FROM tournament_registrations tr JOIN teams te ON te.team_id = tr.team_id
          WHERE tr.tournament_id = ? ORDER BY te.team_name`,
        [t.tournament_id]
      );
      const active = teams.filter((x) => x.status !== "disqualified");
      return res.json({
        success: true,
        role: "organizer",
        check_in_open: !!t.check_in_open,
        teams,
        summary: {
          total: active.length,
          checked_in: active.filter((x) => x.checked_in_at).length,
          no_show: teams.filter((x) => x.status === "no_show").length,
        },
      });
    }

    const [mine] = await pool.query(
      `SELECT te.team_id, te.team_name, tr.status, tr.checked_in_at
         FROM tournament_registrations tr
         JOIN teams te ON te.team_id = tr.team_id
         JOIN team_members tm ON tm.team_id = tr.team_id AND tm.user_id = ? AND tm.status = 'active' AND tm.\`role\` = 'captain'
        WHERE tr.tournament_id = ?`,
      [req.user.id, t.tournament_id]
    );
    res.json({ success: true, role: "captain", check_in_open: !!t.check_in_open, my_teams: mine });
  } catch (err) { next(err); }
};

// ─── ORGANIZER: manual override ─────────────────────────────────────────────
// PATCH /api/tournaments/:id/check-in/teams/:teamId  { checked_in: boolean }
// Checking a team in by hand also rescues it from 'no_show'.
export const setTeamCheckIn = async (req, res, next) => {
  try {
    const t = await loadTournament(req.params.id);
    if (!t) return res.status(404).json({ success: false, message: "Tournament not found" });
    if (!isOrganizer(t, req))
      return res.status(403).json({ success: false, message: "Only the organizer or an admin can do this" });
    if (typeof req.body.checked_in !== "boolean")
      return res.status(400).json({ success: false, message: "checked_in must be true or false" });

    const teamId = Number(req.params.teamId);
    const [regs] = await pool.query(
      "SELECT registration_id, status FROM tournament_registrations WHERE tournament_id = ? AND team_id = ?",
      [t.tournament_id, teamId]
    );
    if (!regs.length) return res.status(404).json({ success: false, message: "Team is not registered" });
    if (regs[0].status === "disqualified")
      return res.status(400).json({ success: false, message: "Disqualified teams cannot be checked in" });

    if (req.body.checked_in) {
      await pool.query(
        `UPDATE tournament_registrations
            SET checked_in_at = COALESCE(checked_in_at, NOW()), checked_in_by = COALESCE(checked_in_by, ?),
                status = IF(status = 'no_show', 'confirmed', status)
          WHERE registration_id = ?`,
        [req.user.id, regs[0].registration_id]
      );
    } else {
      await pool.query(
        "UPDATE tournament_registrations SET checked_in_at = NULL, checked_in_by = NULL WHERE registration_id = ?",
        [regs[0].registration_id]
      );
    }
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ─── ORGANIZER: finalize ────────────────────────────────────────────────────
// POST /api/tournaments/:id/check-in/finalize
// Closes check-in and marks every team that did not check in as 'no_show'.
export const finalizeCheckIn = async (req, res, next) => {
  try {
    const t = await loadTournament(req.params.id);
    if (!t) return res.status(404).json({ success: false, message: "Tournament not found" });
    if (!isOrganizer(t, req))
      return res.status(403).json({ success: false, message: "Only the organizer or an admin can do this" });

    await pool.query("UPDATE tournaments SET check_in_open = 0 WHERE tournament_id = ?", [t.tournament_id]);
    const [r] = await pool.query(
      `UPDATE tournament_registrations SET status = 'no_show'
        WHERE tournament_id = ? AND checked_in_at IS NULL AND status NOT IN ('disqualified', 'no_show')`,
      [t.tournament_id]
    );
    res.json({ success: true, marked_no_show: r.affectedRows });
  } catch (err) { next(err); }
};
