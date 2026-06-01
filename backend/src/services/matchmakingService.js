import pool from "../config/db.js";

const ELO_WINDOW     = 200;
const ELO_WINDOW_MAX = 600;
const K_FACTOR       = 32;

// ─── ELO CALCULATION ─────────────────────────────────────────────────────────
export const calculateElo = (winnerElo, loserElo) => {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  return {
    winnerNew: Math.round(winnerElo + K_FACTOR * (1 - expectedWinner)),
    loserNew:  Math.round(loserElo  + K_FACTOR * (0 - (1 - expectedWinner))),
  };
};

// ─── FIND MATCH ───────────────────────────────────────────────────────────────
export const findMatch = async (userId, gameId) => {
  // $1,$2 → ?
  const [profileRows] = await pool.query(
    "SELECT elo_rating FROM user_game_profile WHERE user_id = ? AND game_id = ?",
    [userId, gameId]
  );

  if (profileRows.length === 0)
    throw new Error("You do not have a game profile for this game. Set your rank first.");

  const userElo = profileRows[0].elo_rating || 1000;
  const windows = [ELO_WINDOW, ELO_WINDOW * 2, ELO_WINDOW_MAX];

  for (const window of windows) {
    const [rows] = await pool.query(
      `SELECT ugp.user_id, ugp.elo_rating, ugp.rank, ugp.role, u.username, u.profile_picture
       FROM user_game_profile ugp
       JOIN users u ON u.user_id = ugp.user_id
       WHERE ugp.game_id = ?
         AND ugp.user_id != ?
         AND u.status = 'active'
         AND ABS(ugp.elo_rating - ?) <= ?
       ORDER BY ABS(ugp.elo_rating - ?) ASC
       LIMIT 1`,
      [gameId, userId, userElo, window, userElo]
    );

    if (rows.length > 0)
      return { ...rows[0], elo_difference: Math.abs(rows[0].elo_rating - userElo) };
  }

  return null;
};

// ─── UPDATE ELO AFTER MATCH ───────────────────────────────────────────────────
export const updateEloAfterMatch = async (winnerId, loserId, gameId) => {
  // pool.connect() → pool.getConnection()
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[winnerRows], [loserRows]] = await Promise.all([
      conn.query(
        "SELECT elo_rating, matches_played, win_rate FROM user_game_profile WHERE user_id = ? AND game_id = ?",
        [winnerId, gameId]
      ),
      conn.query(
        "SELECT elo_rating, matches_played, win_rate FROM user_game_profile WHERE user_id = ? AND game_id = ?",
        [loserId, gameId]
      ),
    ]);

    if (winnerRows.length === 0 || loserRows.length === 0)
      throw new Error("One or both players do not have a profile for this game");

    const winner = winnerRows[0];
    const loser  = loserRows[0];
    const { winnerNew, loserNew } = calculateElo(winner.elo_rating, loser.elo_rating);

    const winnerTotal = winner.matches_played + 1;
    const loserTotal  = loser.matches_played  + 1;
    const winnerWins  = Math.round((winner.win_rate / 100) * winner.matches_played) + 1;
    const loserWins   = Math.round((loser.win_rate  / 100) * loser.matches_played);

    await Promise.all([
      conn.query(
        "UPDATE user_game_profile SET elo_rating=?, matches_played=?, win_rate=? WHERE user_id=? AND game_id=?",
        [winnerNew, winnerTotal, ((winnerWins / winnerTotal) * 100).toFixed(2), winnerId, gameId]
      ),
      conn.query(
        "UPDATE user_game_profile SET elo_rating=?, matches_played=?, win_rate=? WHERE user_id=? AND game_id=?",
        [loserNew, loserTotal, ((loserWins / loserTotal) * 100).toFixed(2), loserId, gameId]
      ),
    ]);

    await conn.commit();

    return {
      winner: { userId: winnerId, oldElo: winner.elo_rating, newElo: winnerNew },
      loser:  { userId: loserId,  oldElo: loser.elo_rating,  newElo: loserNew  },
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
