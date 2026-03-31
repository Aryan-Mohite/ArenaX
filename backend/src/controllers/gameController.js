import pool from "../config/db.js";

// ─── GET ALL GAMES ────────────────────────────────────────────────────────────
export const getGames = async (req, res, next) => {
  try {
    const { genre, q } = req.query;
    let query = "SELECT * FROM games WHERE status = 'active'";
    const params = [];

    if (genre) {
      params.push(genre);
      query += ` AND genre ILIKE $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      query += ` AND game_name ILIKE $${params.length}`;
    }

    query += " ORDER BY game_name ASC";

    const result = await pool.query(query, params);
    res.json({ success: true, games: result.rows });
  } catch (err) {
    next(err);
  }
};

// ─── GET SINGLE GAME ──────────────────────────────────────────────────────────
export const getGameById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const gameResult = await pool.query(
      "SELECT * FROM games WHERE game_id = $1 AND status = 'active'",
      [id]
    );
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    // Get upcoming tournaments for this game
    const tournamentsResult = await pool.query(
      `SELECT tournament_id, name, prize_pool, region, start_date, format, status
       FROM tournaments
       WHERE game_id = $1 AND status IN ('upcoming','ongoing')
       ORDER BY start_date ASC LIMIT 5`,
      [id]
    );

    // Get active community for this game
    const communityResult = await pool.query(
      "SELECT * FROM communities WHERE game_id = $1 LIMIT 1",
      [id]
    );

    res.json({
      success: true,
      game: {
        ...gameResult.rows[0],
        upcoming_tournaments: tournamentsResult.rows,
        community: communityResult.rows[0] || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET MY FAVOURITE GAMES ───────────────────────────────────────────────────
export const getMyGames = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT g.*, ugp.rank, ugp.elo_rating, ugp.win_rate, ugp.matches_played, ugp.role
       FROM user_game_profile ugp
       JOIN games g ON g.game_id = ugp.game_id
       WHERE ugp.user_id = $1
       ORDER BY g.game_name ASC`,
      [userId]
    );

    res.json({ success: true, games: result.rows });
  } catch (err) {
    next(err);
  }
};

// ─── ADD GAME TO FAVOURITES ───────────────────────────────────────────────────
export const addFavouriteGame = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { game_id, rank, role } = req.body;

    const game = await pool.query(
      "SELECT game_id FROM games WHERE game_id = $1 AND status = 'active'",
      [game_id]
    );
    if (game.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    const result = await pool.query(
      `INSERT INTO user_game_profile (user_id, game_id, rank, role, elo_rating)
       VALUES ($1, $2, $3, $4, 1000)
       ON CONFLICT (user_id, game_id) DO NOTHING
       RETURNING *`,
      [userId, game_id, rank || null, role || null]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ success: false, message: "Game already in your list" });
    }

    res.status(201).json({ success: true, game_profile: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── REMOVE GAME FROM FAVOURITES ─────────────────────────────────────────────
export const removeFavouriteGame = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { game_id } = req.params;

    const result = await pool.query(
      "DELETE FROM user_game_profile WHERE user_id = $1 AND game_id = $2 RETURNING *",
      [userId, game_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Game not in your list" });
    }

    res.json({ success: true, message: "Game removed from favourites" });
  } catch (err) {
    next(err);
  }
};
