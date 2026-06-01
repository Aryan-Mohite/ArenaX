import pool from "../config/db.js";

// ─── GET ALL TOURNAMENTS ──────────────────────────────────────────────────────
export const getTournaments = async (req, res, next) => {
  try {
    const { game_id, region, status, limit: _rawLimit = 20, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);

    let query = `
      SELECT t.*, g.game_name, g.icon AS game_icon,
             COUNT(tr.registration_id) AS registered_teams
      FROM tournaments t
      JOIN games g ON g.game_id = t.game_id
      LEFT JOIN tournament_registrations tr ON tr.tournament_id = t.tournament_id
      WHERE 1=1
    `;
    const params = [];

    if (game_id) { params.push(game_id); query += " AND t.game_id = ?"; }
    if (region)  { params.push(region);  query += " AND t.region LIKE ?"; }
    if (status)  { params.push(status);  query += " AND t.status = ?"; }

    params.push(limit, Number(offset));
    query += " GROUP BY t.tournament_id, g.game_name, g.icon ORDER BY t.start_date ASC LIMIT ? OFFSET ?";

    const [rows] = await pool.query(query, params);
    res.json({ success: true, tournaments: rows });
  } catch (err) { next(err); }
};

// ─── GET SINGLE TOURNAMENT ────────────────────────────────────────────────────
export const getTournamentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [tournamentRows] = await pool.query(
      `SELECT t.*, g.game_name, g.icon AS game_icon
       FROM tournaments t
       JOIN games g ON g.game_id = t.game_id
       WHERE t.tournament_id = ?`,
      [id]
    );
    if (tournamentRows.length === 0)
      return res.status(404).json({ success: false, message: "Tournament not found" });

    const [teams] = await pool.query(
      `SELECT te.team_id, te.team_name, te.logo, tr.registered_at, tr.status
       FROM tournament_registrations tr
       JOIN teams te ON te.team_id = tr.team_id
       WHERE tr.tournament_id = ?`,
      [id]
    );

    const [matches] = await pool.query(
      `SELECT m.*, t1.team_name AS team1_name, t2.team_name AS team2_name,
              w.team_name AS winner_name
       FROM matches m
       JOIN teams t1 ON t1.team_id = m.team1_id
       JOIN teams t2 ON t2.team_id = m.team2_id
       LEFT JOIN teams w ON w.team_id = m.winner_team_id
       WHERE m.tournament_id = ?
       ORDER BY m.match_date ASC`,
      [id]
    );

    res.json({
      success: true,
      tournament: { ...tournamentRows[0], registered_teams: teams, matches },
    });
  } catch (err) { next(err); }
};

// ─── CREATE TOURNAMENT ────────────────────────────────────────────────────────
export const createTournament = async (req, res, next) => {
  try {
    const {
      name, game_id, prize_pool, entry_fee, region, format,
      start_date, end_date, registration_deadline,
      image_url, description, organizer_name, location, join_link,
      max_teams,
    } = req.body;

    const userId = req.user?.id || null;

    const [game] = await pool.query("SELECT game_id FROM games WHERE game_id = ?", [game_id]);
    if (game.length === 0)
      return res.status(404).json({ success: false, message: "Game not found" });

    const [result] = await pool.query(
      `INSERT INTO tournaments
         (name, game_id, prize_pool, entry_fee, region, format,
          start_date, end_date, registration_deadline, status,
          image_url, description, organizer_name, location, join_link, created_by, max_teams)
       VALUES (?,?,?,?,?,?,?,?,?,'upcoming',?,?,?,?,?,?,?)`,
      [
        name, game_id, prize_pool || 0, entry_fee || 0, region || null, format,
        start_date, end_date, registration_deadline || null,
        image_url || null, description || null,
        organizer_name || null, location || null, join_link || null,
        userId, max_teams || null,
      ]
    );

    const [tournament] = await pool.query(
      "SELECT * FROM tournaments WHERE tournament_id = ?",
      [result.insertId]
    );

    res.status(201).json({ success: true, tournament: tournament[0] });
  } catch (err) { next(err); }
};

// ─── REGISTER TEAM FOR TOURNAMENT ─────────────────────────────────────────────
// FIX (medium): added max_teams cap check. Previously unlimited teams could register.
export const registerForTournament = async (req, res, next) => {
  try {
    const { id: tournament_id } = req.params;
    const { team_id } = req.body;
    const userId = req.user.id;

    const [tRows] = await pool.query(
      "SELECT * FROM tournaments WHERE tournament_id = ?",
      [tournament_id]
    );
    if (tRows.length === 0)
      return res.status(404).json({ success: false, message: "Tournament not found" });

    const t = tRows[0];
    if (t.status !== "upcoming")
      return res.status(400).json({ success: false, message: "Tournament registration is closed" });

    if (t.registration_deadline && new Date() > new Date(t.registration_deadline))
      return res.status(400).json({ success: false, message: "Registration deadline has passed" });

    const [membership] = await pool.query(
      "SELECT * FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active'",
      [team_id, userId]
    );
    if (membership.length === 0)
      return res.status(403).json({ success: false, message: "You are not a member of this team" });

    const [existing] = await pool.query(
      "SELECT * FROM tournament_registrations WHERE tournament_id = ? AND team_id = ?",
      [tournament_id, team_id]
    );
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: "Team is already registered" });

    // FIX: enforce max_teams cap if the tournament has one set
    if (t.max_teams) {
      const [[countRow]] = await pool.query(
        "SELECT COUNT(*) AS current_count FROM tournament_registrations WHERE tournament_id = ?",
        [tournament_id]
      );
      if (Number(countRow.current_count) >= t.max_teams) {
        return res.status(409).json({
          success: false,
          message: `Tournament is full (max ${t.max_teams} teams)`,
        });
      }
    }

    const [result] = await pool.query(
      "INSERT INTO tournament_registrations (tournament_id, team_id, status) VALUES (?, ?, 'pending')",
      [tournament_id, team_id]
    );

    const [registration] = await pool.query(
      "SELECT * FROM tournament_registrations WHERE registration_id = ?",
      [result.insertId]
    );

    res.status(201).json({ success: true, registration: registration[0] });
  } catch (err) { next(err); }
};

// ─── UPDATE TOURNAMENT STATUS ─────────────────────────────────────────────────
export const updateTournamentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const validStatuses = ["upcoming", "ongoing", "completed", "cancelled"];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: "Invalid status value" });

    const [existing] = await pool.query(
      "SELECT tournament_id, created_by FROM tournaments WHERE tournament_id = ?",
      [id]
    );
    if (existing.length === 0)
      return res.status(404).json({ success: false, message: "Tournament not found" });
    if (existing[0].created_by !== userId && !req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Only the organizer or an admin can update tournament status" });

    await pool.query("UPDATE tournaments SET status = ? WHERE tournament_id = ?", [status, id]);

    const [updated] = await pool.query(
      "SELECT * FROM tournaments WHERE tournament_id = ?",
      [id]
    );

    res.json({ success: true, tournament: updated[0] });
  } catch (err) { next(err); }
};

// ─── DELETE TOURNAMENT ────────────────────────────────────────────────────────
export const deleteTournament = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [rows] = await pool.query(
      "SELECT tournament_id, created_by FROM tournaments WHERE tournament_id = ?",
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Tournament not found" });

    if (rows[0].created_by !== userId && !req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Only the organizer or an admin can delete this tournament" });

    await pool.query("DELETE FROM tournaments WHERE tournament_id = ?", [id]);

    res.json({ success: true, message: "Tournament deleted successfully" });
  } catch (err) { next(err); }
};
