import pool from "../config/db.js";
import { recordMatchResult } from "../services/tournamentService.js";
import { updateEloAfterMatch } from "../services/matchmakingService.js";
import { findMatch } from "../services/matchmakingService.js";

// ─── FIND A MATCH (ELO-based) ─────────────────────────────────────────────────
export const findMatchForUser = async (req, res, next) => {
  try {
    const { game_id } = req.body;
    const userId = req.user.id;

    const opponent = await findMatch(userId, game_id);

    if (!opponent) {
      return res.status(200).json({
        success: true,
        found: false,
        message: "No suitable opponent found right now. Try again shortly.",
      });
    }

    res.json({ success: true, found: true, opponent });
  } catch (err) {
    next(err);
  }
};

// ─── RECORD MATCH RESULT ──────────────────────────────────────────────────────
export const submitMatchResult = async (req, res, next) => {
  try {
    const { match_id, winner_team_id, loser_team_id, score, game_id } = req.body;

    // Record result in DB
    const match = await recordMatchResult(match_id, winner_team_id, score);

    // Update ELO for both teams' members (simplified: updates team captains)
    if (game_id && winner_team_id && loser_team_id) {
      const [winnerCaptain, loserCaptain] = await Promise.all([
        pool.query(
          "SELECT user_id FROM team_members WHERE team_id = $1 AND role = 'captain' LIMIT 1",
          [winner_team_id]
        ),
        pool.query(
          "SELECT user_id FROM team_members WHERE team_id = $1 AND role = 'captain' LIMIT 1",
          [loser_team_id]
        ),
      ]);

      if (winnerCaptain.rows.length > 0 && loserCaptain.rows.length > 0) {
        await updateEloAfterMatch(
          winnerCaptain.rows[0].user_id,
          loserCaptain.rows[0].user_id,
          game_id
        );
      }
    }

    res.json({ success: true, match });
  } catch (err) {
    next(err);
  }
};

// ─── GET MATCH DETAILS ────────────────────────────────────────────────────────
export const getMatch = async (req, res, next) => {
  try {
    const { id } = req.params;

    const matchResult = await pool.query(
      `SELECT m.*,
              t1.team_name AS team1_name, t1.logo AS team1_logo,
              t2.team_name AS team2_name, t2.logo AS team2_logo,
              w.team_name  AS winner_name
       FROM matches m
       JOIN teams t1 ON t1.team_id = m.team1_id
       LEFT JOIN teams t2 ON t2.team_id = m.team2_id
       LEFT JOIN teams w  ON w.team_id  = m.winner_team_id
       WHERE m.match_id = $1`,
      [id]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Match not found" });
    }

    const statsResult = await pool.query(
      `SELECT mps.*, u.username, u.profile_picture
       FROM match_player_stats mps
       JOIN users u ON u.user_id = mps.user_id
       WHERE mps.match_id = $1
       ORDER BY mps.kills DESC`,
      [id]
    );

    res.json({
      success: true,
      match: { ...matchResult.rows[0], player_stats: statsResult.rows },
    });
  } catch (err) {
    next(err);
  }
};

// ─── SUBMIT PLAYER STATS ──────────────────────────────────────────────────────
export const submitPlayerStats = async (req, res, next) => {
  try {
    const { id: match_id } = req.params;
    const { stats } = req.body; // array of { user_id, kills, deaths, assists, damage, mvp }

    if (!Array.isArray(stats) || stats.length === 0) {
      return res.status(400).json({ success: false, message: "stats must be a non-empty array" });
    }

    const inserted = [];
    for (const s of stats) {
      const result = await pool.query(
        `INSERT INTO match_player_stats
           (match_id, user_id, kills, deaths, assists, damage, mvp)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [match_id, s.user_id, s.kills || 0, s.deaths || 0, s.assists || 0, s.damage || 0, s.mvp || false]
      );
      if (result.rows.length > 0) inserted.push(result.rows[0]);
    }

    res.status(201).json({ success: true, stats: inserted });
  } catch (err) {
    next(err);
  }
};
