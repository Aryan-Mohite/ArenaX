import crypto from "crypto";
import pool from "../config/db.js";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const QUESTION_TIME_LIMIT_MS = 15_000;
// Small buffer for real-world network latency between the client's "time's up"
// and the server receiving the request. Anything beyond this is a timeout
// regardless of what the client claims it selected.
const LATENCY_GRACE_MS = 1_500;
const DIFFICULTY_CURVE = [
  { difficulty: "easy", count: 2 },
  { difficulty: "medium", count: 2 },
  { difficulty: "hard", count: 1 },
];
const QUESTIONS_PER_QUIZ = DIFFICULTY_CURVE.reduce((sum, d) => sum + d.count, 0); // 5

// ─── DATE HELPERS ──────────────────────────────────────────────────────────────
// All "today" boundaries use UTC so the daily reset is consistent for every
// user regardless of timezone, matching how quiz_date is stored (DATE column).
const todayStr = () => new Date().toISOString().slice(0, 10);

// ─── SEEDED DRAW ───────────────────────────────────────────────────────────────
// Deterministic pseudo-random rank derived from (date, user, game, question).
// Same inputs always produce the same rank, so a resumed session reconstructs
// the identical 5 questions without having to store anything but the date.
function seededRank(seedString) {
  const hash = crypto.createHash("sha256").update(seedString).digest("hex");
  return parseInt(hash.slice(0, 12), 16);
}

async function drawDailyQuestions(gameId, userId, dateStr, conn = pool) {
  const [pool_] = await conn.query(
    `SELECT question_id, difficulty FROM daily_quiz_questions
     WHERE game_id = ? AND status = 'active'`,
    [gameId]
  );

  const byDifficulty = { easy: [], medium: [], hard: [] };
  for (const row of pool_) {
    byDifficulty[row.difficulty]?.push(row.question_id);
  }

  const drawn = [];
  const shortfalls = [];

  for (const { difficulty, count } of DIFFICULTY_CURVE) {
    const candidates = byDifficulty[difficulty] || [];
    if (candidates.length < count) {
      shortfalls.push(`${difficulty} (need ${count}, have ${candidates.length})`);
      continue;
    }
    const ranked = candidates
      .map((qId) => ({ qId, rank: seededRank(`${dateStr}|${userId}|${gameId}|${qId}`) }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, count);
    drawn.push(...ranked.map((r) => r.qId));
  }

  if (shortfalls.length > 0) {
    const err = new Error(
      `Not enough active questions seeded for this game — missing: ${shortfalls.join(", ")}`
    );
    err.code = "INSUFFICIENT_QUESTIONS";
    throw err;
  }

  return drawn; // ordered: [easy, easy, medium, medium, hard]
}

// ─── QUESTION SHAPING ──────────────────────────────────────────────────────────
// Never send correct_option to the client.
function toPublicQuestion(row, index) {
  return {
    question_id: row.question_id,
    index,
    total: QUESTIONS_PER_QUIZ,
    difficulty: row.difficulty,
    question_text: row.question_text,
    media_url: row.media_url,
    options: {
      a: row.option_a,
      b: row.option_b,
      c: row.option_c,
      d: row.option_d,
    },
    time_limit_ms: QUESTION_TIME_LIMIT_MS,
  };
}

async function getQuestionsByIds(questionIds, conn = pool) {
  if (questionIds.length === 0) return [];
  const [rows] = await conn.query(
    `SELECT question_id, difficulty, question_text, media_url,
            option_a, option_b, option_c, option_d, correct_option
     FROM daily_quiz_questions WHERE question_id IN (?)`,
    [questionIds]
  );
  const byId = Object.fromEntries(rows.map((r) => [r.question_id, r]));
  // Preserve the original draw order — MySQL IN() does not guarantee it.
  return questionIds.map((id) => byId[id]);
}

// ─── START / RESUME SESSION ────────────────────────────────────────────────────
// Returns { session_id, status: 'in_progress'|'already_completed', question?, results? }
export const startOrResumeSession = async (userId, gameId) => {
  const dateStr = todayStr();

  const [gameRows] = await pool.query(
    "SELECT game_id FROM games WHERE game_id = ? AND status = 'active'",
    [gameId]
  );
  if (gameRows.length === 0) {
    const err = new Error("Game not found");
    err.code = "GAME_NOT_FOUND";
    throw err;
  }

  const [existing] = await pool.query(
    "SELECT * FROM daily_quiz_sessions WHERE user_id = ? AND game_id = ? AND quiz_date = ?",
    [userId, gameId, dateStr]
  );

  if (existing.length > 0) {
    const session = existing[0];
    if (session.status === "completed") {
      return {
        session_id: session.session_id,
        status: "already_completed",
        results: {
          correct_count: session.correct_count,
          total_time_ms: session.total_time_ms,
        },
      };
    }
    return resumeInProgressSession(session);
  }

  // No session yet today — draw fresh questions and create one.
  const questionIds = await drawDailyQuestions(gameId, userId, dateStr);

  const [insertResult] = await pool.query(
    `INSERT INTO daily_quiz_sessions
       (user_id, game_id, quiz_date, question_ids, current_index, current_question_started_at, status)
     VALUES (?, ?, ?, ?, 0, NOW(), 'in_progress')`,
    [userId, gameId, dateStr, JSON.stringify(questionIds)]
  );

  const questions = await getQuestionsByIds(questionIds);

  return {
    session_id: insertResult.insertId,
    status: "in_progress",
    question: toPublicQuestion(questions[0], 0),
  };
};

// If the user left the tab mid-question and the 15s window already elapsed
// server-side, that question is auto-forfeited (cascading forward) before
// we hand back control, rather than silently granting a fresh timer.
async function resumeInProgressSession(session) {
  const questionIds = JSON.parse(session.question_ids);
  let current = session;

  while (current.status === "in_progress") {
    const elapsed = Date.now() - new Date(current.current_question_started_at).getTime();
    if (elapsed <= QUESTION_TIME_LIMIT_MS + LATENCY_GRACE_MS) break;

    // Timer already expired while the user was away — force a timeout answer.
    current = await recordAnswerAndAdvance(current, questionIds, null, false, QUESTION_TIME_LIMIT_MS);
  }

  if (current.status === "completed") {
    return {
      session_id: current.session_id,
      status: "already_completed",
      results: { correct_count: current.correct_count, total_time_ms: current.total_time_ms },
    };
  }

  const questions = await getQuestionsByIds(questionIds);
  const remaining = Math.max(
    0,
    QUESTION_TIME_LIMIT_MS - (Date.now() - new Date(current.current_question_started_at).getTime())
  );

  return {
    session_id: current.session_id,
    status: "in_progress",
    question: { ...toPublicQuestion(questions[current.current_index], current.current_index), remaining_ms: remaining },
  };
}

// ─── SUBMIT ANSWER ──────────────────────────────────────────────────────────────
// selectedOption: 'a'|'b'|'c'|'d'|null. forfeited=true means the client
// reported a tab-blur — always counted wrong regardless of timing.
export const submitAnswer = async (userId, sessionId, selectedOption, forfeited = false) => {
  const [rows] = await pool.query("SELECT * FROM daily_quiz_sessions WHERE session_id = ?", [sessionId]);
  if (rows.length === 0) {
    const err = new Error("Session not found");
    err.code = "SESSION_NOT_FOUND";
    throw err;
  }
  const session = rows[0];
  if (session.user_id !== userId) {
    const err = new Error("Session does not belong to this user");
    err.code = "FORBIDDEN";
    throw err;
  }
  if (session.status !== "in_progress") {
    const err = new Error("Session already completed");
    err.code = "SESSION_COMPLETE";
    throw err;
  }

  const questionIds = JSON.parse(session.question_ids);

  const updated = await recordAnswerAndAdvance(session, questionIds, selectedOption, forfeited);

  if (updated.status === "completed") {
    const streakResult = await applyDailyStreak(userId, session.game_id, updated.correct_count, updated.total_time_ms);
    return {
      status: "completed",
      results: {
        correct_count: updated.correct_count,
        total_time_ms: updated.total_time_ms,
        total_questions: QUESTIONS_PER_QUIZ,
      },
      streak: streakResult,
    };
  }

  const questions = await getQuestionsByIds(questionIds);
  return {
    status: "in_progress",
    question: toPublicQuestion(questions[updated.current_index], updated.current_index),
  };
};

// Shared by both live answers and resume-time cascading forfeits.
// overrideTimeTakenMs lets the resume path record a full 15000ms timeout
// without recomputing off a stale current_question_started_at twice.
async function recordAnswerAndAdvance(session, questionIds, selectedOption, forfeited, overrideTimeTakenMs = null) {
  const questionIndex = session.current_index;
  const questionId = questionIds[questionIndex];

  const [[question]] = [
    (await pool.query("SELECT correct_option FROM daily_quiz_questions WHERE question_id = ?", [questionId]))[0],
  ];

  const rawElapsed = Date.now() - new Date(session.current_question_started_at).getTime();
  const timeTakenMs = overrideTimeTakenMs ?? Math.min(Math.max(rawElapsed, 0), QUESTION_TIME_LIMIT_MS);
  const withinTimeLimit = rawElapsed <= QUESTION_TIME_LIMIT_MS + LATENCY_GRACE_MS;
  const advanceTimestamp = new Date(); // single consistent "now" for both the DB write and the returned object

  const isCorrect =
    !forfeited && withinTimeLimit && selectedOption != null && selectedOption === question.correct_option;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // INSERT IGNORE guards against a double-submit race for the same question.
    const [insertResult] = await conn.query(
      `INSERT IGNORE INTO daily_quiz_answers
         (session_id, question_id, question_index, selected_option, is_correct, time_taken_ms, forfeited)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [session.session_id, questionId, questionIndex, selectedOption, isCorrect, timeTakenMs, forfeited]
    );

    // Already recorded (race/duplicate submit) — just return current state.
    if (insertResult.affectedRows === 0) {
      await conn.commit();
      const [[fresh]] = await pool.query("SELECT * FROM daily_quiz_sessions WHERE session_id = ?", [session.session_id]);
      return fresh;
    }

    const nextIndex = questionIndex + 1;
    const isLastQuestion = nextIndex >= questionIds.length;

    if (!isLastQuestion) {
      await conn.query(
        `UPDATE daily_quiz_sessions
         SET current_index = ?, current_question_started_at = ?
         WHERE session_id = ?`,
        [nextIndex, advanceTimestamp, session.session_id]
      );
      await conn.commit();
      return { ...session, current_index: nextIndex, current_question_started_at: advanceTimestamp, status: "in_progress" };
    }

    // Last question answered — finalize the session from the answer rows,
    // which is the actual source of truth rather than incrementing counters.
    const [[rawTotals]] = await conn.query(
      `SELECT SUM(is_correct) AS correct_count, SUM(time_taken_ms) AS total_time_ms
       FROM daily_quiz_answers WHERE session_id = ?`,
      [session.session_id]
    );
    // mysql2 returns SUM() as a string — coerce to Number so downstream
    // comparisons (streak best-score checks, JSON output) aren't string-typed.
    const totals = {
      correct_count: Number(rawTotals.correct_count) || 0,
      total_time_ms: Number(rawTotals.total_time_ms) || 0,
    };

    await conn.query(
      `UPDATE daily_quiz_sessions
       SET current_index = ?, status = 'completed', correct_count = ?, total_time_ms = ?, completed_at = NOW()
       WHERE session_id = ?`,
      [nextIndex, totals.correct_count, totals.total_time_ms, session.session_id]
    );
    await conn.commit();

    return {
      ...session,
      current_index: nextIndex,
      status: "completed",
      correct_count: totals.correct_count,
      total_time_ms: totals.total_time_ms,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── DAILY STREAK (per user, per game) ─────────────────────────────────────────
// Same shape as achievementService.updateLoginStreak, but keyed to
// (user_id, game_id) and driven by quiz completion date rather than login.
// A completed session extends the streak regardless of score — consistent
// with how most daily-puzzle products (Wordle etc.) treat "played today".
async function applyDailyStreak(userId, gameId, correctCount, totalTimeMs) {
  const today = todayStr();

  const [rows] = await pool.query(
    "SELECT * FROM daily_quiz_streaks WHERE user_id = ? AND game_id = ?",
    [userId, gameId]
  );

  let currentStreak, longestStreak, extended;
  const isBest =
    rows.length === 0 ||
    correctCount > rows[0].best_correct_count ||
    (correctCount === rows[0].best_correct_count &&
      (rows[0].best_time_ms == null || totalTimeMs < rows[0].best_time_ms));

  if (rows.length === 0) {
    currentStreak = 1;
    longestStreak = 1;
    extended = true;
    await pool.query(
      `INSERT INTO daily_quiz_streaks
         (user_id, game_id, current_streak, longest_streak, last_completed_date, best_correct_count, best_time_ms)
       VALUES (?, ?, 1, 1, ?, ?, ?)`,
      [userId, gameId, today, correctCount, totalTimeMs]
    );
  } else {
    const row = rows[0];
    if (row.last_completed_date && sameDay(row.last_completed_date, today)) {
      // Shouldn't normally happen (UNIQUE session per day blocks a second
      // completion), but stay idempotent just in case.
      currentStreak = row.current_streak;
      longestStreak = row.longest_streak;
      extended = false;
    } else if (row.last_completed_date && isYesterday(row.last_completed_date, today)) {
      currentStreak = row.current_streak + 1;
      longestStreak = Math.max(row.longest_streak, currentStreak);
      extended = true;
    } else {
      currentStreak = 1;
      longestStreak = row.longest_streak;
      extended = true;
    }

    await pool.query(
      `UPDATE daily_quiz_streaks
       SET current_streak = ?, longest_streak = ?, last_completed_date = ?
           ${isBest ? ", best_correct_count = ?, best_time_ms = ?" : ""}
       WHERE user_id = ? AND game_id = ?`,
      isBest
        ? [currentStreak, longestStreak, today, correctCount, totalTimeMs, userId, gameId]
        : [currentStreak, longestStreak, today, userId, gameId]
    );
  }

  return { currentStreak, longestStreak, extended };
}

// ─── LOBBY (pre-quiz stats for a single game) ──────────────────────────────────
export const getLobbyData = async (userId, gameId) => {
  const today = todayStr();

  const [[completedToday]] = await pool.query(
    `SELECT COUNT(*) AS count FROM daily_quiz_sessions
     WHERE game_id = ? AND quiz_date = ? AND status = 'completed'`,
    [gameId, today]
  );

  const [top3] = await pool.query(
    `SELECT u.username, s.correct_count, s.total_time_ms
     FROM daily_quiz_sessions s
     JOIN users u ON u.user_id = s.user_id
     WHERE s.game_id = ? AND s.quiz_date = ? AND s.status = 'completed'
     ORDER BY s.correct_count DESC, s.total_time_ms ASC
     LIMIT 3`,
    [gameId, today]
  );

  const [personalBestRows] = await pool.query(
    "SELECT * FROM daily_quiz_streaks WHERE user_id = ? AND game_id = ?",
    [userId, gameId]
  );

  const [mySessionRows] = await pool.query(
    "SELECT status, correct_count, total_time_ms FROM daily_quiz_sessions WHERE user_id = ? AND game_id = ? AND quiz_date = ?",
    [userId, gameId, today]
  );

  const personalBest = personalBestRows[0] || null;

  return {
    global_completed_today: completedToday.count,
    top3_today: top3,
    personal_best: personalBest
      ? { correct_count: personalBest.best_correct_count, total_time_ms: personalBest.best_time_ms }
      : null,
    streak: personalBest
      ? { current_streak: personalBest.current_streak, longest_streak: personalBest.longest_streak }
      : { current_streak: 0, longest_streak: 0 },
    today_status: mySessionRows[0]
      ? { status: mySessionRows[0].status, correct_count: mySessionRows[0].correct_count, total_time_ms: mySessionRows[0].total_time_ms }
      : { status: "not_started" },
  };
};

// ─── SIDEBAR — "Your Games" ────────────────────────────────────────────────────
// Backed by the existing library (user_game_profile), per Aryan's call —
// no separate favorites table.
export const getSidebarGames = async (userId) => {
  const today = todayStr();

  const [rows] = await pool.query(
    `SELECT
       g.game_id, g.game_name, g.slug, g.icon, g.cover_image, g.genre,
       ds.current_streak, ds.longest_streak,
       sess.status AS today_status
     FROM user_game_profile ugp
     JOIN games g ON g.game_id = ugp.game_id
     LEFT JOIN daily_quiz_streaks ds ON ds.user_id = ugp.user_id AND ds.game_id = ugp.game_id
     LEFT JOIN daily_quiz_sessions sess
       ON sess.user_id = ugp.user_id AND sess.game_id = ugp.game_id AND sess.quiz_date = ?
     WHERE ugp.user_id = ?
     ORDER BY g.game_name ASC`,
    [today, userId]
  );

  return rows.map((r) => ({
    game_id: r.game_id,
    game_name: r.game_name,
    slug: r.slug,
    icon: r.icon,
    cover_image: r.cover_image,
    genre: r.genre,
    current_streak: r.current_streak || 0,
    longest_streak: r.longest_streak || 0,
    today_completed: r.today_status === "completed",
  }));
};

// ─── LEADERBOARD ────────────────────────────────────────────────────────────────
export const getLeaderboard = async (userId, gameId, tab = "daily", limit = 20) => {
  if (tab === "alltime") {
    const [rows] = await pool.query(
      `SELECT u.user_id, u.username, ds.best_correct_count AS correct_count,
              ds.best_time_ms AS total_time_ms, ds.longest_streak
       FROM daily_quiz_streaks ds
       JOIN users u ON u.user_id = ds.user_id
       WHERE ds.game_id = ?
       ORDER BY ds.best_correct_count DESC, ds.best_time_ms ASC
       LIMIT ?`,
      [gameId, Number(limit)]
    );
    return attachSelfRank(rows, userId);
  }

  const today = todayStr();
  const [rows] = await pool.query(
    `SELECT u.user_id, u.username, s.correct_count, s.total_time_ms
     FROM daily_quiz_sessions s
     JOIN users u ON u.user_id = s.user_id
     WHERE s.game_id = ? AND s.quiz_date = ? AND s.status = 'completed'
     ORDER BY s.correct_count DESC, s.total_time_ms ASC
     LIMIT ?`,
    [gameId, today, Number(limit)]
  );
  return attachSelfRank(rows, userId);
};

function attachSelfRank(rows, userId) {
  return rows.map((r, i) => ({ ...r, rank: i + 1, is_self: r.user_id === userId }));
}

// ─── SHARE DATA (percentile etc. for the viral share card — Phase 4 consumes this) ──
export const getShareData = async (userId, sessionId) => {
  const [rows] = await pool.query(
    `SELECT s.*, g.game_name, g.icon AS game_icon
     FROM daily_quiz_sessions s JOIN games g ON g.game_id = s.game_id
     WHERE s.session_id = ?`,
    [sessionId]
  );
  if (rows.length === 0) {
    const err = new Error("Session not found");
    err.code = "SESSION_NOT_FOUND";
    throw err;
  }
  const session = rows[0];
  if (session.user_id !== userId) {
    const err = new Error("Session does not belong to this user");
    err.code = "FORBIDDEN";
    throw err;
  }
  if (session.status !== "completed") {
    const err = new Error("Session not yet completed");
    err.code = "SESSION_INCOMPLETE";
    throw err;
  }

  const [[{ totalToday }]] = await pool.query(
    `SELECT COUNT(*) AS totalToday FROM daily_quiz_sessions
     WHERE game_id = ? AND quiz_date = ? AND status = 'completed'`,
    [session.game_id, session.quiz_date]
  );
  const [[{ betterOrEqual }]] = await pool.query(
    `SELECT COUNT(*) AS betterOrEqual FROM daily_quiz_sessions
     WHERE game_id = ? AND quiz_date = ? AND status = 'completed'
       AND (correct_count > ? OR (correct_count = ? AND total_time_ms <= ?))`,
    [session.game_id, session.quiz_date, session.correct_count, session.correct_count, session.total_time_ms]
  );

  const [streakRows] = await pool.query(
    "SELECT current_streak FROM daily_quiz_streaks WHERE user_id = ? AND game_id = ?",
    [userId, session.game_id]
  );

  const percentile = totalToday > 0 ? Math.max(1, Math.round((betterOrEqual / totalToday) * 100)) : 100;

  return {
    game_name: session.game_name,
    game_icon: session.game_icon,
    correct_count: session.correct_count,
    total_questions: QUESTIONS_PER_QUIZ,
    total_time_ms: session.total_time_ms,
    current_streak: streakRows[0]?.current_streak || 0,
    top_percentile: percentile, // e.g. 3 => "Top 3% Today"
  };
};

// --- date helpers (mirrors achievementService's) -------------------------------
function sameDay(dateA, isoDateB) {
  return new Date(dateA).toISOString().slice(0, 10) === isoDateB;
}
function isYesterday(dateA, isoDateB) {
  const diffDays = Math.round((new Date(isoDateB) - new Date(dateA)) / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

export const _internal = { QUESTION_TIME_LIMIT_MS, QUESTIONS_PER_QUIZ };
