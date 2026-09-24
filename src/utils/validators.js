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

export const validateVerifyRegisterOtp = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address")
    .normalizeEmail(),
  body("otp")
    .notEmpty().withMessage("OTP is required")
    .isLength({ min: 6, max: 6 }).withMessage("OTP must be exactly 6 digits")
    .isNumeric().withMessage("OTP must contain only digits"),
];

export const validateResendOtp = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address")
    .normalizeEmail(),
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
    .isIn([
      "single_elimination",
      "double_elimination",
      "TDM",
      "_5v5",
      "Battle_Royale",
      "Round_Robin",
      "League",
      "Swiss",
      "Group_Stage",
      "Knockout",
      "Qualifiers",
      "Playoffs",
      "Championship",
    ])
    .withMessage("Invalid tournament format"),
  body("start_date")
    .notEmpty().withMessage("Start date is required")
    .isISO8601({ strict: false }).withMessage("start_date must be a valid date (YYYY-MM-DD)"),
  body("end_date")
    .notEmpty().withMessage("End date is required")
    .isISO8601({ strict: false }).withMessage("end_date must be a valid date"),
  body("registration_deadline")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601({ strict: false }),
  body("prize_pool")
    .optional({ nullable: true, checkFalsy: true })
    .customSanitizer((v) => Number(v))
    .isFloat({ min: 0 }).withMessage("prize_pool must be a positive number"),
  body("entry_fee")
    .optional({ nullable: true, checkFalsy: true })
    .customSanitizer((v) => Number(v))
    .isFloat({ min: 0 }).withMessage("entry_fee must be a positive number"),
  body("region")
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 50 }),
  body("join_link")
    .optional({ nullable: true, checkFalsy: true })
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("join_link must be a valid http/https URL"),
  body("image_url")
    .optional({ nullable: true, checkFalsy: true })
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("image_url must be a valid http/https URL"),
  body("description")
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 2000 }).withMessage("Description must be under 2000 characters"),
  body("organizer_name")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 }),
  body("location")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 200 }),
];

// ─── TEAM FINDER ───────────────────────────────────────────────────────────────
export const validateTeamFinderPost = [
  body("game_id")
    .notEmpty()
    .isInt({ min: 1 }).withMessage("game_id must be a positive integer"),
  body("team_id")
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage("team_id must be a positive integer"),
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
  body("game_id")
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage("game_id must be a positive integer"),
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

export const validateSendTeamMessage = [
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
    .isLength({ min: 1, max: 200 }),
  body("content")
    .trim()
    .notEmpty().withMessage("Content is required")
    .isLength({ max: 10000 }),
  body("image_url")
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      // Accept either a real https:// URL (e.g. "Paste URL" mode) or a
      // base64 data URI produced by the in-app file-upload/compression flow
      // (useImageUpload.js -> pickFile -> compressImage). Without this,
      // every "Upload file" post fails 422 because data: URIs don't pass
      // isURL().
      const isHttpsUrl = /^https:\/\/.+/i.test(value);
      const isDataUri  = /^data:image\/(jpeg|jpg|png|webp|gif|heic|heif|avif|bmp|tiff);base64,/i.test(value);

      if (!isHttpsUrl && !isDataUri) {
        throw new Error("image_url must be a valid https URL or an uploaded image");
      }

      // Guard against oversized payloads landing in the DB/JSON responses.
      // useImageUpload caps raw uploads at 5MB and compresses non-GIFs to
      // 800px webp, but GIFs pass through uncompressed, so still cap here.
      const MAX_DATA_URI_LENGTH = 8 * 1024 * 1024; // ~8MB encoded (~6MB raw)
      if (isDataUri && value.length > MAX_DATA_URI_LENGTH) {
        throw new Error("Image is too large to upload");
      }

      return true;
    }),
];

export const validateComment = [
  body("content")
    .trim()
    .notEmpty().withMessage("Comment cannot be empty")
    .isLength({ max: 2000 }).withMessage("Comment must be under 2000 characters"),
];

// ─── STREAM ────────────────────────────────────────────────────────────────────
export const validateGoLive = [
  body("game_id")
    .notEmpty().withMessage("game_id is required")
    .isInt({ min: 1 }).withMessage("game_id must be a positive integer"),
  body("title")
    .trim()
    .notEmpty().withMessage("Stream title is required")
    .isLength({ min: 1, max: 150 }).withMessage("Title must be under 150 characters"),
  body("platform")
    .optional()
    .isIn(["twitch", "youtube", "kick", "facebook", "platform"])
    .withMessage("Invalid platform"),
  body("stream_url")
    .optional({ nullable: true, checkFalsy: true })
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("stream_url must be a valid http/https URL"),
];

// ─── USER PROFILE UPDATE ───────────────────────────────────────────────────────
export const validateUpdateProfile = [
  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage("Username must be 3–30 characters")
    .matches(/^[a-zA-Z0-9_]+$/).withMessage("Username can only contain letters, numbers, and underscores"),
  body("bio")
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 500 }).withMessage("Bio must be under 500 characters"),
  body("country")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 }).withMessage("Country must be under 100 characters"),
  body("region")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 50 }).withMessage("Region must be under 50 characters"),
  // FIX M2: Added max length cap for URL-type profile pictures.
  // Previously only base64 data URIs were size-checked (in the controller).
  // A very long https:// URL bypassed that check entirely.
  body("profile_picture")
    .optional({ nullable: true, checkFalsy: true })
    .custom((v) => {
      if (!v) return true;
      if (v.startsWith("data:image/")) return true; // base64 — size checked in controller
      try {
        const url = new URL(v);
        if (url.protocol !== "https:") throw new Error();
        if (v.length > 500) throw new Error("URL too long");
        return true;
      } catch {
        throw new Error("profile_picture must be a valid https URL (max 500 chars) or base64 image data");
      }
    }),
];

// ─── PARAM VALIDATORS ──────────────────────────────────────────────────────────
export const validateIdParam = [
  param("id")
    .customSanitizer((v) => Number(v))
    .isInt({ min: 1 }).withMessage("ID must be a positive integer"),
];

// ─── FORGOT PASSWORD ───────────────────────────────────────────────────────────
export const validateForgotPassword = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address")
    .normalizeEmail(),
];

export const validateVerifyResetOtp = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address")
    .normalizeEmail(),
  body("otp")
    .notEmpty().withMessage("OTP is required")
    .isLength({ min: 6, max: 6 }).withMessage("OTP must be exactly 6 digits")
    .isNumeric().withMessage("OTP must contain only digits"),
];

// ─── RESET PASSWORD ────────────────────────────────────────────────────────────
export const validateResetPassword = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address")
    .normalizeEmail(),
  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/).withMessage("Password must contain at least one number"),
];