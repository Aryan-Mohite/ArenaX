import pool from "../config/db.js";

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
 * Inserts all first-round matches into the DB.
 *
 * @param {number} tournamentId
 * @param {number[]} teamIds
 */
export const generateBracket = async (tournamentId, teamIds) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Shuffle teams for seeding
    const shuffled = [...teamIds].sort(() => Math.random() - 0.5);

    // Pair teams: [0 vs 1, 2 vs 3, ...]
    const matches = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const result = await client.query(
        `INSERT INTO matches (tournament_id, team1_id, team2_id, status)
         VALUES ($1, $2, $3, 'scheduled')
         RETURNING *`,
        [tournamentId, shuffled[i], shuffled[i + 1]]
      );
      matches.push(result.rows[0]);
    }

    // If odd number of teams, last team gets a bye (no opponent this round)
    if (shuffled.length % 2 !== 0) {
      const byeTeam = shuffled[shuffled.length - 1];
      await client.query(
        `INSERT INTO matches (tournament_id, team1_id, team2_id, status, winner_team_id)
         VALUES ($1, $2, NULL, 'bye', $2)`,
        [tournamentId, byeTeam]
      );
    }

    // Update tournament status to ongoing
    await client.query(
      "UPDATE tournaments SET status = 'ongoing' WHERE tournament_id = $1",
      [tournamentId]
    );

    await client.query("COMMIT");
    return matches;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Record a match result and update bracket.
 */
export const recordMatchResult = async (matchId, winnerTeamId, score) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const matchResult = await client.query(
      `UPDATE matches
       SET winner_team_id = $1, score = $2, status = 'completed'
       WHERE match_id = $3
       RETURNING *`,
      [winnerTeamId, score, matchId]
    );

    if (matchResult.rows.length === 0) {
      throw new Error("Match not found");
    }

    await client.query("COMMIT");
    return matchResult.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};
