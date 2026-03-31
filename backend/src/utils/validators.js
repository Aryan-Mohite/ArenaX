import { body, param, query } from "express-validator";

// ─── AUTH ──────────────────────────────────────────────────────────────────────
export const validateRegister = [
  body("username")
    .trim()
    .notEmpty().withMessage("Username is required")
    .isLength({ min: 3, max: 30 }).withMessage("Username must be 3–30 characters")
    .matches(/^[a-zA-Z0-9_]+$/).withMessage("Username can only contain letters, numbers, and underscores"),
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address")
    .normalizeEmail(),
  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/).withMessage("Password must contain at least one number"),
];

export const validateLogin = [
  body("email").trim().notEmpty().isEmail().normalizeEmail(),
  body("password").notEmpty(),
];

// ─── TOURNAMENTS ───────────────────────────────────────────────────────────────
export const validateCreateTournament = [
  body("name")
    .trim()
    .notEmpty().withMessage("Tournament name is required")
    .isLength({ min: 3, max: 150 }).withMessage("Name must be 3–150 characters"),
  body("game_id")
    .notEmpty().withMessage("game_id is required")
    .isInt({ min: 1 }).withMessage("game_id must be a positive integer"),
  body("format")
    .optional()
    .isIn(["single_elimination", "double_elimination", "round_robin", "swiss"])
    .withMessage("Invalid tournament format"),
  body("start_date")
    .notEmpty().withMessage("Start date is required")
    .isISO8601().withMessage("start_date must be a valid date (YYYY-MM-DD)"),
  body("end_date")
    .notEmpty().withMessage("End date is required")
    .isISO8601().withMessage("end_date must be a valid date"),
  body("registration_deadline")
    .optional()
    .isISO8601(),
  body("prize_pool")
    .optional()
    .isFloat({ min: 0 }).withMessage("prize_pool must be a positive number"),
  body("entry_fee")
    .optional()
    .isFloat({ min: 0 }).withMessage("entry_fee must be a positive number"),
  body("region")
    .optional()
    .isLength({ max: 50 }),
];

// ─── TEAM FINDER ───────────────────────────────────────────────────────────────
export const validateTeamFinderPost = [
  body("game_id")
    .notEmpty()
    .isInt({ min: 1 }).withMessage("game_id must be a positive integer"),
  body("rank_required")
    .optional()
    .isLength({ max: 50 }),
  body("role_required")
    .optional()
    .isLength({ max: 50 }),
  body("region")
    .optional()
    .isLength({ max: 50 }),
  body("description")
    .optional()
    .isLength({ max: 1000 }).withMessage("Description must be under 1000 characters"),
];

// ─── TEAMS ─────────────────────────────────────────────────────────────────────
export const validateCreateTeam = [
  body("team_name")
    .trim()
    .notEmpty().withMessage("Team name is required")
    .isLength({ min: 2, max: 100 }).withMessage("Team name must be 2–100 characters"),
  body("region")
    .optional()
    .isLength({ max: 50 }),
  body("description")
    .optional()
    .isLength({ max: 500 }),
];

// ─── MESSAGES ──────────────────────────────────────────────────────────────────
export const validateSendMessage = [
  body("receiver_id")
    .notEmpty()
    .isInt({ min: 1 }).withMessage("receiver_id must be a positive integer"),
  body("content")
    .trim()
    .notEmpty().withMessage("Message content cannot be empty")
    .isLength({ max: 2000 }).withMessage("Message must be under 2000 characters"),
];

// ─── COMMUNITY POSTS ───────────────────────────────────────────────────────────
export const validateCommunityPost = [
  body("title")
    .trim()
    .notEmpty().withMessage("Title is required")
    .isLength({ min: 3, max: 200 }),
  body("content")
    .trim()
    .notEmpty().withMessage("Content is required")
    .isLength({ max: 10000 }),
];

// ─── PARAM VALIDATORS ──────────────────────────────────────────────────────────
export const validateIdParam = [
  param("id")
    .isInt({ min: 1 }).withMessage("ID must be a positive integer"),
];
