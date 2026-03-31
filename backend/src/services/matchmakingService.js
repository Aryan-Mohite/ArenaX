import pool from "../config/db.js";

const ELO_WINDOW = 200;       // Max ELO difference for a fair match
const ELO_WINDOW_MAX = 600;   // Expands over time if no match found
const K_FACTOR = 32;          // How much ELO shifts per match result

// ─── ELO CALCULATION ─────────────────────────────────────────────────────────
/**
 * Returns new ELO ratings for both players after a match.
 * @param {number} winnerElo
 * @param {number} loserElo
 * @returns {{ winnerNew: number, loserNew: number }}
 */
export const calculateElo = (winnerElo, loserElo) => {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 - expectedWinner;

  return {
    winnerNew: Math.round(winnerElo + K_FACTOR * (1 - expectedWinner)),
    loserNew: Math.round(loserElo + K_FACTOR * (0 - expectedLoser)),
  };
};

// ─── FIND MATCH ───────────────────────────────────────────────────────────────
/**
 * Find the best-matching player for a given user in a game.
 * Expands the ELO window gradually if no opponent found in the tight window.
 *
 * @param {number} userId
 * @param {number} gameId
 * @returns {object|null} Matched player's user_game_profile row, or null
 */
export const findMatch = async (userId, gameId) => {
  // Get the requesting user's ELO for this game
  const userProfile = await pool.query(
    "SELECT elo_rating FROM user_game_profile WHERE user_id = $1 AND game_id = $2",
    [userId, gameId]
  );

  if (userProfile.rows.length === 0) {
    throw new Error("You do not have a game profile for this game. Set your rank first.");
  }

  const userElo = userProfile.rows[0].elo_rating || 1000;

  // Try increasingly wide ELO windows until a match is found
  const windows = [ELO_WINDOW, ELO_WINDOW * 2, ELO_WINDOW_MAX];

  for (const window of windows) {
    const result = await pool.query(
      `SELECT ugp.user_id, ugp.elo_rating, ugp.rank, ugp.role, u.username, u.profile_picture
       FROM user_game_profile ugp
       JOIN users u ON u.user_id = ugp.user_id
       WHERE ugp.game_id = $1
         AND ugp.user_id != $2
         AND u.status = 'active'
         AND ABS(ugp.elo_rating - $3) <= $4
       ORDER BY ABS(ugp.elo_rating - $3) ASC
       LIMIT 1`,
      [gameId, userId, userElo, window]
    );

    if (result.rows.length > 0) {
      return {
        ...result.rows[0],
        elo_difference: Math.abs(result.rows[0].elo_rating - userElo),
      };
    }
  }

  return null; // No match found within max window
};

// ─── UPDATE ELO AFTER MATCH ───────────────────────────────────────────────────
/**
 * Updates ELO ratings in the DB after a match result.
 * Also increments matches_played and recalculates win_rate.
 *
 * @param {number} winnerId
 * @param {number} loserId
 * @param {number} gameId
 */
export const updateEloAfterMatch = async (winnerId, loserId, gameId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const [winnerRes, loserRes] = await Promise.all([
      client.query(
        "SELECT elo_rating, matches_played, win_rate FROM user_game_profile WHERE user_id = $1 AND game_id = $2",
        [winnerId, gameId]
      ),
      client.query(
        "SELECT elo_rating, matches_played, win_rate FROM user_game_profile WHERE user_id = $1 AND game_id = $2",
        [loserId, gameId]
      ),
    ]);

    if (winnerRes.rows.length === 0 || loserRes.rows.length === 0) {
      throw new Error("One or both players do not have a profile for this game");
    }

    const winner = winnerRes.rows[0];
    const loser = loserRes.rows[0];
    const { winnerNew, loserNew } = calculateElo(winner.elo_rating, loser.elo_rating);

    // Recalculate win rates
    const winnerTotalMatches = winner.matches_played + 1;
    const loserTotalMatches = loser.matches_played + 1;
    const winnerWins = Math.round((winner.win_rate / 100) * winner.matches_played) + 1;
    const loserWins = Math.round((loser.win_rate / 100) * loser.matches_played);

    await Promise.all([
      client.query(
        `UPDATE user_game_profile
         SET elo_rating = $1, matches_played = $2, win_rate = $3
         WHERE user_id = $4 AND game_id = $5`,
        [winnerNew, winnerTotalMatches, ((winnerWins / winnerTotalMatches) * 100).toFixed(2), winnerId, gameId]
      ),
      client.query(
        `UPDATE user_game_profile
         SET elo_rating = $1, matches_played = $2, win_rate = $3
         WHERE user_id = $4 AND game_id = $5`,
        [loserNew, loserTotalMatches, ((loserWins / loserTotalMatches) * 100).toFixed(2), loserId, gameId]
      ),
    ]);

    await client.query("COMMIT");

    return {
      winner: { userId: winnerId, oldElo: winner.elo_rating, newElo: winnerNew },
      loser: { userId: loserId, oldElo: loser.elo_rating, newElo: loserNew },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};
