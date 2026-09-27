import pool from "../config/db.js";

// Single source of truth for which event_type strings are valid — the
// roadmap's exact list (signups, tournament registrations, team formations,
// community posts, logins).
export const EVENT_TYPES = Object.freeze({
  SIGNUP: "signup",
  LOGIN: "login",
  TOURNAMENT_REGISTRATION: "tournament_registration",
  TEAM_CREATED: "team_created",
  COMMUNITY_POST: "community_post",
});

// ─── logEvent ────────────────────────────────────────────────────────────────
// Fire-and-forget: callers never `await` this, and it never throws — a
// logging failure must not be able to break the request it's attached to.
// Same "non-critical side effect, errors swallowed" convention already used
// for awardNexusPostAchievement in communityController.js.
export async function logEvent(userId, eventType, metadata = null) {
  try {
    await pool.query(
      "INSERT INTO events (user_id, event_type, metadata) VALUES (?, ?, ?)",
      [userId || null, eventType, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    console.error(`[eventService] failed to log '${eventType}':`, err.message);
  }
}
