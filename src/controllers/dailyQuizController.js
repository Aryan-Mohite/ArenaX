import {
  startOrResumeSession,
  submitAnswer,
  getLobbyData,
  getSidebarGames,
  getLeaderboard,
  getShareData,
} from "../services/dailyQuizService.js";
import pool from "../config/db.js";

const ERROR_STATUS = {
  GAME_NOT_FOUND: 404,
  SESSION_NOT_FOUND: 404,
  FORBIDDEN: 403,
  SESSION_COMPLETE: 409,
  SESSION_INCOMPLETE: 409,
  INSUFFICIENT_QUESTIONS: 422,
};

function handleServiceError(err, res, next) {
  const status = ERROR_STATUS[err.code];
  if (status) {
    return res.status(status).json({ success: false, message: err.message });
  }
  next(err);
}

// ─── GET /api/dailies/games — sidebar ("Your Games") ──────────────────────────
export const getMyDailiesGames = async (req, res, next) => {
  try {
    const games = await getSidebarGames(req.user.id);
    res.json({ success: true, games });
  } catch (err) { next(err); }
};

// ─── GET /api/dailies/:game_id/lobby ───────────────────────────────────────────
export const getGameLobby = async (req, res, next) => {
  try {
    const data = await getLobbyData(req.user.id, req.params.game_id);
    res.json({ success: true, ...data });
  } catch (err) { handleServiceError(err, res, next); }
};

// ─── POST /api/dailies/:game_id/start — start or resume today's session ───────
export const startDailyQuiz = async (req, res, next) => {
  try {
    const result = await startOrResumeSession(req.user.id, req.params.game_id);
    res.json({ success: true, ...result });
  } catch (err) { handleServiceError(err, res, next); }
};

// ─── POST /api/dailies/session/:session_id/answer ──────────────────────────────
export const answerQuestion = async (req, res, next) => {
  try {
    const { selected_option } = req.body;
    const result = await submitAnswer(req.user.id, req.params.session_id, selected_option ?? null, false);
    res.json({ success: true, ...result });
  } catch (err) { handleServiceError(err, res, next); }
};

// ─── POST /api/dailies/session/:session_id/blur — anti-tab-switch forfeit ─────
export const forfeitOnBlur = async (req, res, next) => {
  try {
    const result = await submitAnswer(req.user.id, req.params.session_id, null, true);
    res.json({ success: true, ...result });
  } catch (err) { handleServiceError(err, res, next); }
};

// ─── GET /api/dailies/:game_id/leaderboard?tab=daily|alltime ──────────────────
export const getGameLeaderboard = async (req, res, next) => {
  try {
    const { tab = "daily", limit } = req.query;
    const rows = await getLeaderboard(req.user.id, req.params.game_id, tab, limit || 20);
    res.json({ success: true, tab, leaderboard: rows });
  } catch (err) { handleServiceError(err, res, next); }
};

// ─── GET /api/dailies/session/:session_id/share ────────────────────────────────
export const getSessionShareData = async (req, res, next) => {
  try {
    const data = await getShareData(req.user.id, req.params.session_id);
    res.json({ success: true, ...data });
  } catch (err) { handleServiceError(err, res, next); }
};

// ─── ADMIN: POST /api/dailies/admin/questions/bulk ─────────────────────────────
// Body: { game_id, questions: [{ difficulty, question_text, media_url?, option_a..d, correct_option }] }
// Used by scripts/importDailyQuestions.js, and callable directly if preferred.
export const bulkImportQuestions = async (req, res, next) => {
  try {
    const { game_id, questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: "questions must be a non-empty array" });
    }

    const [gameRows] = await pool.query("SELECT game_id FROM games WHERE game_id = ?", [game_id]);
    if (gameRows.length === 0) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    const values = [];
    for (const [i, q] of questions.entries()) {
      const required = ["difficulty", "question_text", "option_a", "option_b", "option_c", "option_d", "correct_option"];
      const missing = required.filter((k) => !q[k]);
      if (missing.length > 0) {
        return res.status(422).json({ success: false, message: `questions[${i}] missing: ${missing.join(", ")}` });
      }
      if (!["easy", "medium", "hard"].includes(q.difficulty)) {
        return res.status(422).json({ success: false, message: `questions[${i}] invalid difficulty` });
      }
      if (!["a", "b", "c", "d"].includes(q.correct_option)) {
        return res.status(422).json({ success: false, message: `questions[${i}] invalid correct_option` });
      }
      values.push([
        game_id, q.difficulty, q.question_text, q.media_url || null,
        q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option,
      ]);
    }

    const [result] = await pool.query(
      `INSERT INTO daily_quiz_questions
         (game_id, difficulty, question_text, media_url, option_a, option_b, option_c, option_d, correct_option)
       VALUES ?`,
      [values]
    );

    res.status(201).json({ success: true, inserted: result.affectedRows });
  } catch (err) { next(err); }
};
