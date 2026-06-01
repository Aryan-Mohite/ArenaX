import pool from "../config/db.js";
import { loadGamesFromJson } from "../services/gameDataService.js";

// ─── GET ALL GAMES ────────────────────────────────────────────────────────────
export const getGames = async (req, res, next) => {
  try {
    const { genre, q, platform } = req.query;
    let query = "SELECT * FROM games WHERE status = 'active'";
    const params = [];

    // ILIKE → LIKE  (utf8mb4_unicode_ci collation is case-insensitive by default)
    if (genre)    { params.push(`%${genre}%`);    query += " AND genre LIKE ?"; }
    if (q)        { params.push(`%${q}%`);        query += " AND game_name LIKE ?"; }
    if (platform) { params.push(`%${platform}%`); query += " AND platforms LIKE ?"; }

    // ORDER BY rating DESC NULLS LAST →
    //   rating IS NULL ASC  (0 for non-null first, 1 for null last)
    //   then rating DESC
    query += " ORDER BY rating IS NULL ASC, rating DESC, game_name ASC";

    const [rows] = await pool.query(query, params);
    res.json({ success: true, games: rows });
  } catch (err) { next(err); }
};

// ─── GET SINGLE GAME ──────────────────────────────────────────────────────────
export const getGameById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [gameRows] = await pool.query(
      "SELECT * FROM games WHERE game_id = ? AND status = 'active'",
      [id]
    );
    if (gameRows.length === 0)
      return res.status(404).json({ success: false, message: "Game not found" });

    const [tournaments] = await pool.query(
      `SELECT tournament_id, name, prize_pool, region, start_date, format, status
       FROM tournaments
       WHERE game_id = ? AND status IN ('upcoming','ongoing')
       ORDER BY start_date ASC LIMIT 5`,
      [id]
    );

    const [communities] = await pool.query(
      "SELECT * FROM communities WHERE game_id = ? LIMIT 1",
      [id]
    );

    res.json({
      success: true,
      game: {
        ...gameRows[0],
        upcoming_tournaments: tournaments,
        community: communities[0] || null,
      },
    });
  } catch (err) { next(err); }
};

// ─── GET MY FAVOURITE GAMES ───────────────────────────────────────────────────
export const getMyGames = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT g.*, ugp.rank, ugp.elo_rating, ugp.win_rate, ugp.matches_played, ugp.role
       FROM user_game_profile ugp
       JOIN games g ON g.game_id = ugp.game_id
       WHERE ugp.user_id = ?
       ORDER BY g.game_name ASC`,
      [userId]
    );
    res.json({ success: true, games: rows });
  } catch (err) { next(err); }
};

// ─── ADD GAME TO FAVOURITES ───────────────────────────────────────────────────
export const addFavouriteGame = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { game_id, rank, role } = req.body;

    const [game] = await pool.query(
      "SELECT game_id FROM games WHERE game_id = ? AND status = 'active'",
      [game_id]
    );
    if (game.length === 0)
      return res.status(404).json({ success: false, message: "Game not found" });

    // INSERT IGNORE replaces ON CONFLICT DO NOTHING
    // NOTE: `rank` and `role` are reserved words in MySQL 8.0 — must be backtick-quoted
    const [result] = await pool.query(
      `INSERT IGNORE INTO user_game_profile (user_id, game_id, \`rank\`, \`role\`, elo_rating)
       VALUES (?, ?, ?, ?, 1000)`,
      [userId, game_id, rank || null, role || null]
    );

    if (result.affectedRows === 0)
      return res.status(409).json({ success: false, message: "Game already in your list" });

    // Fetch the new row (RETURNING not available in MySQL)
    const [profile] = await pool.query(
      "SELECT * FROM user_game_profile WHERE user_id = ? AND game_id = ?",
      [userId, game_id]
    );

    res.status(201).json({ success: true, game_profile: profile[0] });
  } catch (err) { next(err); }
};

// ─── REMOVE GAME FROM FAVOURITES ─────────────────────────────────────────────
export const removeFavouriteGame = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { game_id } = req.params;

    const [result] = await pool.query(
      "DELETE FROM user_game_profile WHERE user_id = ? AND game_id = ?",
      [userId, game_id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: "Game not in your list" });

    res.json({ success: true, message: "Game removed from favourites" });
  } catch (err) { next(err); }
};

// ─── SYNC GAMES FROM LOCAL JSON ───────────────────────────────────────────────
export const syncGamesFromJson = async (req, res, next) => {
  try {
    const games = loadGamesFromJson();

    let inserted = 0, updated = 0, skipped = 0, communitiesCreated = 0;

    for (const g of games) {
      if (!g.game_name?.trim()) {
        console.warn("[sync] Skipping game with null/empty game_name", g);
        skipped++;
        continue;
      }

      // ON CONFLICT DO UPDATE → ON DUPLICATE KEY UPDATE
      // MySQL returns affectedRows=1 for INSERT, 2 for UPDATE via ON DUPLICATE KEY
      const [result] = await pool.query(
        `INSERT INTO games
           (game_name, genre, developer, release_year, cover_image, icon, status,
            rating, platforms, description, slug, screenshots)
         VALUES (?,?,?,?,?,?,'active',?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           genre        = VALUES(genre),
           developer    = COALESCE(VALUES(developer),  developer),
           release_year = COALESCE(VALUES(release_year), release_year),
           cover_image  = COALESCE(VALUES(cover_image),  cover_image),
           icon         = COALESCE(VALUES(icon),        icon),
           rating       = VALUES(rating),
           platforms    = VALUES(platforms),
           description  = VALUES(description),
           slug         = VALUES(slug),
           screenshots  = VALUES(screenshots)`,
        [
          g.game_name, g.genre, g.developer, g.release_year,
          g.cover_image, g.cover_image,
          g.rating, g.platforms, g.description, g.slug,
          JSON.stringify(g.screenshots || []),
        ]
      );

      // affectedRows: 1 = inserted, 2 = updated, 0 = identical (no change)
      const isInsert = result.affectedRows === 1;
      if (isInsert) inserted++; else updated++;

      // game_id: insertId is populated for INSERT; for UPDATE LAST_INSERT_ID() holds it
      const game_id = result.insertId ||
        (await pool.query("SELECT game_id FROM games WHERE game_name = ?", [g.game_name]))[0][0]?.game_id;

      // Auto-create community if none exists
      const [existingCom] = await pool.query(
        "SELECT community_id FROM communities WHERE game_id = ? LIMIT 1",
        [game_id]
      );

      if (existingCom.length === 0) {
        await pool.query(
          "INSERT INTO communities (game_id, name, description) VALUES (?, ?, ?)",
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

    // Hard-delete games no longer in JSON
    // != ALL($1::text[]) → NOT IN (?)
    // mysql2 expands an array param inside NOT IN (?) correctly
    const activeNames = games
      .filter((g) => g.game_name?.trim())
      .map((g) => g.game_name.trim());

    let deleted = 0;
    if (activeNames.length > 0) {
      // Pass array directly — mysql2 expands it for IN / NOT IN
      const [deleteResult] = await pool.query(
        "DELETE FROM games WHERE game_name NOT IN (?)",
        [activeNames]
      );
      deleted = deleteResult.affectedRows;
      if (deleted > 0) console.log(`[sync] Hard-deleted ${deleted} game(s)`);
    }

    res.json({
      success: true,
      message: `Sync complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${deleted} deleted. ${communitiesCreated} communities auto-created.`,
      total: games.length, inserted, updated, skipped, deleted, communitiesCreated,
    });
  } catch (err) { next(err); }
};
