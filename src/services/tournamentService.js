import pool from "../config/db.js";
import crypto from "crypto";

/**
 * Calculate prize distribution across placements.
 * Default split: 1st 50%, 2nd 30%, 3rd 20%
 */
export const calculatePrizeDistribution = (prizePool, placements = 3) => {
  const splits = {
    1: [1.0],
    2: [0.6, 0.4],
    3: [0.5, 0.3, 0.2],
    4: [0.45, 0.25, 0.2, 0.1],
  };

  const ratios = splits[Math.min(placements, 4)] || splits[3];

  return ratios.map((ratio, i) => ({
    placement: i + 1,
    prize: parseFloat((prizePool * ratio).toFixed(2)),
  }));
};

/**
 * Generate single-elimination bracket matches for a list of team IDs.
 * FIX M11: Math.random()-based sort produces a statistically biased shuffle.
 * Replaced with Fisher-Yates using crypto.randomInt for a fair, uniform distribution.
 */
export const generateBracket = async (tournamentId, teamIds) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // FIX M11: Fisher-Yates shuffle with crypto.randomInt (uniform, unbiased)
    const shuffled = [...teamIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const matches = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const [result] = await conn.query(
        `INSERT INTO matches (tournament_id, team1_id, team2_id, status)
         VALUES (?, ?, ?, 'scheduled')`,
        [tournamentId, shuffled[i], shuffled[i + 1]]
      );
      const [rows] = await conn.query(
        `SELECT * FROM matches WHERE match_id = ?`,
        [result.insertId]
      );
      matches.push(rows[0]);
    }

    if (shuffled.length % 2 !== 0) {
      const byeTeam = shuffled[shuffled.length - 1];
      await conn.query(
        `INSERT INTO matches (tournament_id, team1_id, team2_id, status, winner_team_id)
         VALUES (?, ?, NULL, 'bye', ?)`,
        [tournamentId, byeTeam, byeTeam]
      );
    }

    await conn.query(
      "UPDATE tournaments SET status = 'ongoing' WHERE tournament_id = ?",
      [tournamentId]
    );

    await conn.commit();
    return matches;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Record a match result and update bracket.
 */
export const recordMatchResult = async (matchId, winnerTeamId, score) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `UPDATE matches
       SET winner_team_id = ?, score = ?, status = 'completed'
       WHERE match_id = ?`,
      [winnerTeamId, score, matchId]
    );

    if (result.affectedRows === 0) {
      throw new Error("Match not found");
    }

    const [rows] = await conn.query(
      `SELECT * FROM matches WHERE match_id = ?`,
      [matchId]
    );

    await conn.commit();
    return rows[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
