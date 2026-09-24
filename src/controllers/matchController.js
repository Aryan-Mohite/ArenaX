import pool from "../config/db.js";
import { recordMatchResult } from "../services/tournamentService.js";
import { updateEloAfterMatch, findMatch } from "../services/matchmakingService.js";

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
  } catch (err) { next(err); }
};

// ─── RECORD MATCH RESULT ──────────────────────────────────────────────────────
// FIX H1: Added team membership ownership check. Previously any authenticated user
// could submit a result for any match they weren't part of.
// Now requires the requesting user to be an active member of one of the match teams,
// OR be an admin.
export const submitMatchResult = async (req, res, next) => {
  try {
    const { match_id, winner_team_id, loser_team_id, score, game_id } = req.body;
    const userId = req.user.id;

    // Verify match exists and get participants
    const [matchRows] = await pool.query(
      "SELECT match_id, team1_id, team2_id, status FROM matches WHERE match_id = ?",
      [match_id]
    );

    if (matchRows.length === 0) {
      return res.status(404).json({ success: false, message: "Match not found" });
    }

    const matchRecord = matchRows[0];

    if (matchRecord.status === "completed") {
      return res.status(409).json({ success: false, message: "Match result has already been recorded" });
    }

    const validTeams = [matchRecord.team1_id, matchRecord.team2_id].map(Number);

    // FIX H1: verify the requesting user is a member of one of the teams (or admin)
    if (!req.user.isAdmin) {
      const [memberCheck] = await pool.query(
        "SELECT 1 FROM team_members WHERE team_id IN (?) AND user_id = ? AND status = 'active' LIMIT 1",
        [validTeams, userId]
      );
      if (memberCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message: "You must be a member of one of the competing teams to submit a result",
        });
      }
    }

    if (!validTeams.includes(Number(winner_team_id))) {
      return res.status(400).json({
        success: false,
        message: "winner_team_id is not a participant in this match",
      });
    }

    if (loser_team_id && !validTeams.includes(Number(loser_team_id))) {
      return res.status(400).json({
        success: false,
        message: "loser_team_id is not a participant in this match",
      });
    }

    const match = await recordMatchResult(match_id, winner_team_id, score);

    if (game_id && winner_team_id && loser_team_id) {
      const [[winnerRows], [loserRows]] = await Promise.all([
        pool.query(
          "SELECT user_id FROM team_members WHERE team_id = ? AND role = 'captain' LIMIT 1",
          [winner_team_id]
        ),
        pool.query(
          "SELECT user_id FROM team_members WHERE team_id = ? AND role = 'captain' LIMIT 1",
          [loser_team_id]
        ),
      ]);

      if (winnerRows.length > 0 && loserRows.length > 0) {
        await updateEloAfterMatch(
          winnerRows[0].user_id,
          loserRows[0].user_id,
          game_id
        );
      }
    }

    res.json({ success: true, match });
  } catch (err) { next(err); }
};

// ─── GET MATCH DETAILS ────────────────────────────────────────────────────────
export const getMatch = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [matchRows] = await pool.query(
      `SELECT m.*,
              t1.team_name AS team1_name, t1.logo AS team1_logo,
              t2.team_name AS team2_name, t2.logo AS team2_logo,
              w.team_name  AS winner_name
       FROM matches m
       JOIN teams t1 ON t1.team_id = m.team1_id
       LEFT JOIN teams t2 ON t2.team_id = m.team2_id
       LEFT JOIN teams w  ON w.team_id  = m.winner_team_id
       WHERE m.match_id = ?`,
      [id]
    );

    if (matchRows.length === 0) {
      return res.status(404).json({ success: false, message: "Match not found" });
    }

    const [statsRows] = await pool.query(
      `SELECT mps.*, u.username, u.profile_picture
       FROM match_player_stats mps
       JOIN users u ON u.user_id = mps.user_id
       WHERE mps.match_id = ?
       ORDER BY mps.kills DESC`,
      [id]
    );

    res.json({
      success: true,
      match: { ...matchRows[0], player_stats: statsRows },
    });
  } catch (err) { next(err); }
};

// ─── SUBMIT PLAYER STATS ──────────────────────────────────────────────────────
export const submitPlayerStats = async (req, res, next) => {
  try {
    const { id: match_id } = req.params;
    const { stats } = req.body;

    if (!Array.isArray(stats) || stats.length === 0) {
      return res.status(400).json({ success: false, message: "stats must be a non-empty array" });
    }

    const inserted = [];
    for (const s of stats) {
      const [result] = await pool.query(
        `INSERT IGNORE INTO match_player_stats
           (match_id, user_id, kills, deaths, assists, damage, mvp)
         VALUES (?,?,?,?,?,?,?)`,
        [match_id, s.user_id, s.kills || 0, s.deaths || 0, s.assists || 0, s.damage || 0, s.mvp || false]
      );
      if (result.affectedRows > 0) {
        const [rows] = await pool.query(
          `SELECT * FROM match_player_stats WHERE match_id = ? AND user_id = ?`,
          [match_id, s.user_id]
        );
        if (rows.length > 0) inserted.push(rows[0]);
      }
    }

    res.status(201).json({ success: true, stats: inserted });
  } catch (err) { next(err); }
};
