import pool from "../config/db.js";
import {
  fetchEsportsGames,
  searchGames as rawgSearch,
  getGameDetails as rawgDetails,
} from "../services/rawgService.js";

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

    query += " ORDER BY rating DESC NULLS LAST, game_name ASC";

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

// ─── SYNC GAMES FROM RAWG ─────────────────────────────────────────────────────
// POST /api/games/sync
// Fetches top esports titles from RAWG and upserts them into the DB.
// Protect with a secret header in production (X-Sync-Secret).
export const syncGamesFromRawg = async (req, res, next) => {
  try {
    // Optional: verify a sync secret in production
    const syncSecret = process.env.RAWG_SYNC_SECRET;
    if (syncSecret && req.headers["x-sync-secret"] !== syncSecret) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const games = await fetchEsportsGames();

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const g of games) {
      // Safety net: never attempt to insert a row with no game_name
      if (!g.game_name || !g.game_name.trim()) {
        console.warn("[sync] Skipping game with null/empty game_name", g);
        skipped++;
        continue;
      }

      const result = await pool.query(
        `INSERT INTO games
           (game_name, genre, developer, release_year, cover_image, icon, status,
            rawg_id, rating, rating_count, platforms, metacritic, description, website, slug, screenshots)
         VALUES ($1,$2,$3,$4,$5,$5,'active',$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (game_name) DO UPDATE SET
           genre        = EXCLUDED.genre,
           developer    = COALESCE(EXCLUDED.developer, games.developer),
           release_year = COALESCE(EXCLUDED.release_year, games.release_year),
           cover_image  = COALESCE(EXCLUDED.cover_image, games.cover_image),
           icon         = COALESCE(EXCLUDED.icon, games.icon),
           rawg_id      = EXCLUDED.rawg_id,
           rating       = EXCLUDED.rating,
           rating_count = EXCLUDED.rating_count,
           platforms    = EXCLUDED.platforms,
           metacritic   = EXCLUDED.metacritic,
           description  = EXCLUDED.description,
           website      = EXCLUDED.website,
           slug         = EXCLUDED.slug,
           screenshots  = EXCLUDED.screenshots
         RETURNING (xmax = 0) AS is_insert`,
        [
          g.game_name,
          g.genre,
          g.developer,
          g.release_year,
          g.cover_image,
          g.rawg_id,
          g.rating,
          g.rating_count,
          g.platforms,
          g.metacritic,
          g.description,
          g.website,
          g.slug,
          g.screenshots || [],
        ]
      );

      if (result.rows[0]?.is_insert) inserted++;
      else updated++;
    }

    res.json({
      success: true,
      message: `Sync complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped`,
      total: games.length,
      inserted,
      updated,
      skipped,
    });
  } catch (err) {
    next(err);
  }
};

// ─── PROXY: SEARCH RAWG ───────────────────────────────────────────────────────
// GET /api/games/rawg/search?q=valorant&page=1&page_size=20
// The API key stays on the server — the frontend never sees it.
export const rawgSearchProxy = async (req, res, next) => {
  try {
    const { q, page = 1, page_size = 20 } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: "Query param 'q' is required" });
    }
    const results = await rawgSearch(q, Number(page), Number(page_size));
    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
};

// ─── PROXY: GET RAWG GAME DETAILS ─────────────────────────────────────────────
// GET /api/games/rawg/:slug
export const rawgDetailsProxy = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const details = await rawgDetails(slug);
    res.json({ success: true, game: details });
  } catch (err) {
    next(err);
  }
};