import pool from "../config/db.js";

// ─── GET ALL TOURNAMENTS (with filters) ───────────────────────────────────────
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

    if (game_id) { params.push(game_id);  query += ` AND t.game_id = $${params.length}`; }
    if (region)  { params.push(region);   query += ` AND t.region ILIKE $${params.length}`; }
    if (status)  { params.push(status);   query += ` AND t.status = $${params.length}`; }

    params.push(Number(limit), Number(offset));
    query += `
      GROUP BY t.tournament_id, g.game_name, g.icon
      ORDER BY t.start_date ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await pool.query(query, params);
    res.json({ success: true, tournaments: result.rows });
  } catch (err) { next(err); }
};

// ─── GET SINGLE TOURNAMENT ────────────────────────────────────────────────────
export const getTournamentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tournamentResult = await pool.query(
      `SELECT t.*, g.game_name, g.icon AS game_icon
       FROM tournaments t
       JOIN games g ON g.game_id = t.game_id
       WHERE t.tournament_id = $1`,
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Tournament not found" });
    }

    const teamsResult = await pool.query(
      `SELECT te.team_id, te.team_name, te.logo, tr.registered_at, tr.status
       FROM tournament_registrations tr
       JOIN teams te ON te.team_id = tr.team_id
       WHERE tr.tournament_id = $1`,
      [id]
    );

    const matchesResult = await pool.query(
      `SELECT m.*, t1.team_name AS team1_name, t2.team_name AS team2_name,
              w.team_name AS winner_name
       FROM matches m
       JOIN teams t1 ON t1.team_id = m.team1_id
       JOIN teams t2 ON t2.team_id = m.team2_id
       LEFT JOIN teams w ON w.team_id = m.winner_team_id
       WHERE m.tournament_id = $1
       ORDER BY m.match_date ASC`,
      [id]
    );

    res.json({
      success: true,
      tournament: {
        ...tournamentResult.rows[0],
        registered_teams: teamsResult.rows,
        matches: matchesResult.rows,
      },
    });
  } catch (err) { next(err); }
};

// ─── CREATE TOURNAMENT ────────────────────────────────────────────────────────
export const createTournament = async (req, res, next) => {
  try {
    const {
      name, game_id, prize_pool, entry_fee, region,
      format, start_date, end_date, registration_deadline,
      // New organizer fields
      image_url, description, organizer_name, location, join_link,
    } = req.body;

    const userId = req.user?.id || null;

    const game = await pool.query("SELECT game_id FROM games WHERE game_id = $1", [game_id]);
    if (game.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    const result = await pool.query(
      `INSERT INTO tournaments
         (name, game_id, prize_pool, entry_fee, region, format,
          start_date, end_date, registration_deadline, status,
          image_url, description, organizer_name, location, join_link, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'upcoming',$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        name, game_id, prize_pool || 0, entry_fee || 0, region || null, format,
        start_date, end_date, registration_deadline || null,
        image_url || null, description || null,
        organizer_name || null, location || null, join_link || null,
        userId,
      ]
    );

    res.status(201).json({ success: true, tournament: result.rows[0] });
  } catch (err) { next(err); }
};

// ─── REGISTER TEAM FOR TOURNAMENT ─────────────────────────────────────────────
export const registerForTournament = async (req, res, next) => {
  try {
    const { id: tournament_id } = req.params;
    const { team_id } = req.body;
    const userId = req.user.id;

    const tournament = await pool.query(
      "SELECT * FROM tournaments WHERE tournament_id = $1",
      [tournament_id]
    );
    if (tournament.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Tournament not found" });
    }
    if (tournament.rows[0].status !== "upcoming") {
      return res.status(400).json({ success: false, message: "Tournament registration is closed" });
    }

    const t = tournament.rows[0];
    if (t.registration_deadline && new Date() > new Date(t.registration_deadline)) {
      return res.status(400).json({ success: false, message: "Registration deadline has passed" });
    }

    const membership = await pool.query(
      "SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'active'",
      [team_id, userId]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ success: false, message: "You are not a member of this team" });
    }

    const existing = await pool.query(
      "SELECT * FROM tournament_registrations WHERE tournament_id = $1 AND team_id = $2",
      [tournament_id, team_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Team is already registered" });
    }

    const result = await pool.query(
      `INSERT INTO tournament_registrations (tournament_id, team_id, status)
       VALUES ($1, $2, 'pending') RETURNING *`,
      [tournament_id, team_id]
    );

    res.status(201).json({ success: true, registration: result.rows[0] });
  } catch (err) { next(err); }
};

// ─── UPDATE TOURNAMENT STATUS ─────────────────────────────────────────────────
export const updateTournamentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const validStatuses = ["upcoming", "ongoing", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    // Only the organizer (created_by) or an admin can change tournament status
    const existing = await pool.query(
      "SELECT tournament_id, created_by FROM tournaments WHERE tournament_id = $1",
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Tournament not found" });
    }
    if (existing.rows[0].created_by !== userId && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: "Only the organizer or an admin can update tournament status" });
    }

    const result = await pool.query(
      "UPDATE tournaments SET status = $1 WHERE tournament_id = $2 RETURNING *",
      [status, id]
    );

    res.json({ success: true, tournament: result.rows[0] });
  } catch (err) { next(err); }
};

// ─── DELETE TOURNAMENT (organizer or admin) ───────────────────────────────────
export const deleteTournament = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin === true;

    // Fetch the tournament first to check ownership
    const existing = await pool.query(
      "SELECT tournament_id, created_by, status FROM tournaments WHERE tournament_id = $1",
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Tournament not found" });
    }
    if (existing.rows[0].created_by !== userId && !isAdmin) {
      return res.status(403).json({ success: false, message: "Only the organizer or an admin can delete this tournament" });
    }

    await pool.query("DELETE FROM tournaments WHERE tournament_id = $1", [id]);
    res.json({ success: true, message: isAdmin ? "Tournament removed by admin" : "Tournament deleted" });
  } catch (err) { next(err); }
};
