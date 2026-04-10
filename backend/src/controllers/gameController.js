import pool from "../config/db.js";
import { loadGamesFromJson } from "../services/gameDataService.js";

// ─── GET ALL GAMES ────────────────────────────────────────────────────────────
export const getGames = async (req, res, next) => {
  try {
    const { genre, q, platform } = req.query;
    let query = "SELECT * FROM games WHERE status = 'active'";
    const params = [];

    if (genre) {
      params.push(`%${genre}%`);
      query += ` AND genre ILIKE $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      query += ` AND game_name ILIKE $${params.length}`;
    }
    if (platform) {
      params.push(`%${platform}%`);
      query += ` AND platforms ILIKE $${params.length}`;
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

    const tournamentsResult = await pool.query(
      `SELECT tournament_id, name, prize_pool, region, start_date, format, status
       FROM tournaments
       WHERE game_id = $1 AND status IN ('upcoming','ongoing')
       ORDER BY start_date ASC LIMIT 5`,
      [id]
    );

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

// ─── SYNC GAMES FROM LOCAL JSON ───────────────────────────────────────────────
// POST /api/games/sync
// Reads data/games.json, upserts all games, and auto-creates communities.
export const syncGamesFromJson = async (req, res, next) => {
  try {
    const games = loadGamesFromJson();

    let inserted = 0;
    let updated  = 0;
    let skipped  = 0;
    let communitiesCreated = 0;

    for (const g of games) {
      if (!g.game_name || !g.game_name.trim()) {
        console.warn("[sync] Skipping game with null/empty game_name", g);
        skipped++;
        continue;
      }

      // Upsert game
      const result = await pool.query(
        `INSERT INTO games
           (game_name, genre, developer, release_year, cover_image, icon, status,
            rating, platforms, description, slug, screenshots)
         VALUES ($1,$2,$3,$4,$5,$5,'active',$6,$7,$8,$9,$10)
         ON CONFLICT (game_name) DO UPDATE SET
           genre        = EXCLUDED.genre,
           developer    = COALESCE(EXCLUDED.developer, games.developer),
           release_year = COALESCE(EXCLUDED.release_year, games.release_year),
           cover_image  = COALESCE(EXCLUDED.cover_image, games.cover_image),
           icon         = COALESCE(EXCLUDED.cover_image, games.icon),
           rating       = EXCLUDED.rating,
           platforms    = EXCLUDED.platforms,
           description  = EXCLUDED.description,
           slug         = EXCLUDED.slug,
           screenshots  = EXCLUDED.screenshots
         RETURNING game_id, (xmax = 0) AS is_insert`,
        [
          g.game_name,
          g.genre,
          g.developer,
          g.release_year,
          g.cover_image,
          g.rating,
          g.platforms,
          g.description,
          g.slug,
          g.screenshots || [],
        ]
      );

      const { game_id, is_insert } = result.rows[0];
      if (is_insert) inserted++;
      else updated++;

      // Auto-create community if none exists
      const existingCom = await pool.query(
        "SELECT community_id FROM communities WHERE game_id = $1 LIMIT 1",
        [game_id]
      );

      if (existingCom.rows.length === 0) {
        await pool.query(
          `INSERT INTO communities (game_id, name, description) VALUES ($1, $2, $3)`,
          [
            game_id,
            `${g.game_name} Community`,
            `Official ${g.game_name} community — share tips, clips, and connect with fellow players.`,
          ]
        );
        communitiesCreated++;
        console.log(`[sync] Created community for: ${g.game_name}`);
      }
    }

    // ── Hard-delete games no longer in JSON ───────────────────────────────────
    // Deletes the game row and cascades to: communities, community_posts,
    // post_comments, user_game_profile, tournaments — anything with
    // ON DELETE CASCADE on their game_id FK.
    const activeNames = games
      .filter((g) => g.game_name && g.game_name.trim())
      .map((g) => g.game_name.trim());

    const deleteResult = await pool.query(
      `DELETE FROM games
       WHERE game_name != ALL($1::text[])
       RETURNING game_name`,
      [activeNames]
    );
    const deleted = deleteResult.rows.length;
    if (deleted > 0) {
      console.log(
        `[sync] Hard-deleted ${deleted} game(s):`,
        deleteResult.rows.map((r) => r.game_name).join(", ")
      );
    }

    res.json({
      success: true,
      message: `Sync complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${deleted} deleted. ${communitiesCreated} communities auto-created.`,
      total: games.length,
      inserted,
      updated,
      skipped,
      deleted,
      communitiesCreated,
    });
  } catch (err) {
    next(err);
  }
};