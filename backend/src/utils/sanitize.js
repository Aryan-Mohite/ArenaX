/**
 * sanitize.js
 *
 * FIX H9: Lightweight HTML sanitization for user-generated content stored in the DB.
 * Without this, stored XSS is possible if content is ever rendered as HTML on the frontend.
 *
 * Uses the sanitize-html library (install: npm install sanitize-html).
 *
 * STRATEGY:
 *   - Rich fields (post title, post content, bio): strip all HTML tags entirely.
 *     We store plain text; the frontend controls formatting.
 *   - This is safer and simpler than allowlist-based sanitization for a platform
 *     that doesn't support rich-text editing.
 */

import sanitizeHtml from "sanitize-html";

/**
 * Strip all HTML tags from a string.
 * Returns null/undefined as-is (so COALESCE in SQL still works).
 */
export const stripHtml = (input) => {
  if (input == null) return input;
  if (typeof input !== "string") return input;
  return sanitizeHtml(input, {
    allowedTags:       [],   // no tags allowed — plain text only
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  }).trim();
};

/**
 * Sanitize an object's string fields in-place.
 * Pass an array of field names to sanitize.
 *
 * Example:
 *   sanitizeFields(req.body, ['title', 'content', 'bio'])
 */
export const sanitizeFields = (obj, fields) => {
  for (const field of fields) {
    if (typeof obj[field] === "string") {
      obj[field] = stripHtml(obj[field]);
    }
  }
  return obj;
};
