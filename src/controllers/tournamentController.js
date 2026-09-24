import pool from "../config/db.js";
import { hasFeature } from "../services/featureService.js";

// Free tier (no active 'unlimited_participants'-granting plan) is capped at
// this many teams per tournament, regardless of what the organizer requests.
const FREE_TIER_MAX_TEAMS = 16;

// ─── GET ALL TOURNAMENTS ──────────────────────────────────────────────────────
export const getTournaments = async (req, res, next) => {
  try {
    const { game_id, region, status, limit: _rawLimit = 20, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);

    let query = `
      SELECT t.*, g.game_name, g.icon AS game_icon,
             COUNT(tr.registration_id) AS registered_teams
      FROM tournaments t
      JOIN games g ON g.game_id = t.game_id
      LEFT JOIN tournament_registrations tr ON tr.tournament_id = t.tournament_id
      WHERE 1=1
    `;
    const params = [];

    if (game_id) { params.push(game_id); query += " AND t.game_id = ?"; }
    if (region)  { params.push(region);  query += " AND t.region LIKE ?"; }
    if (status === "pending_review" && !req.user?.isAdmin) {
      // §2: pending-review tournaments are an admin-only view here;
      // organizers see their own regardless of status via /tournaments/mine.
      return res.status(403).json({ success: false, message: "Admin access required to view pending-review tournaments" });
    }
    if (status)  { params.push(status);  query += " AND t.status = ?"; }
    else         { query += " AND t.status != 'pending_review'"; } // keep unverified organizer tournaments out of default public browsing

    params.push(limit, Number(offset));
    query += " GROUP BY t.tournament_id, g.game_name, g.icon ORDER BY t.start_date ASC LIMIT ? OFFSET ?";

    const [rows] = await pool.query(query, params);
    res.json({ success: true, tournaments: rows });
  } catch (err) { next(err); }
};

// ─── GET SINGLE TOURNAMENT ────────────────────────────────────────────────────
export const getTournamentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [tournamentRows] = await pool.query(
      `SELECT t.*, g.game_name, g.icon AS game_icon
       FROM tournaments t
       JOIN games g ON g.game_id = t.game_id
       WHERE t.tournament_id = ?`,
      [id]
    );
    if (tournamentRows.length === 0)
      return res.status(404).json({ success: false, message: "Tournament not found" });

    const [teams] = await pool.query(
      `SELECT te.team_id, te.team_name, te.logo, tr.registered_at, tr.status
       FROM tournament_registrations tr
       JOIN teams te ON te.team_id = tr.team_id
       WHERE tr.tournament_id = ?`,
      [id]
    );

    const [matches] = await pool.query(
      `SELECT m.*, t1.team_name AS team1_name, t2.team_name AS team2_name,
              w.team_name AS winner_name
       FROM matches m
       JOIN teams t1 ON t1.team_id = m.team1_id
       JOIN teams t2 ON t2.team_id = m.team2_id
       LEFT JOIN teams w ON w.team_id = m.winner_team_id
       WHERE m.tournament_id = ?
       ORDER BY m.match_date ASC`,
      [id]
    );

    res.json({
      success: true,
      tournament: { ...tournamentRows[0], registered_teams: teams, matches },
    });
  } catch (err) { next(err); }
};

// ─── CREATE TOURNAMENT ────────────────────────────────────────────────────────
export const createTournament = async (req, res, next) => {
  try {
    const {
      name, game_id, prize_pool, entry_fee, region, format,
      start_date, end_date, registration_deadline,
      image_url, description, organizer_name, location, join_link,
      max_teams,
    } = req.body;

    const userId = req.user?.id || null;

    const [game] = await pool.query("SELECT game_id FROM games WHERE game_id = ?", [game_id]);
    if (game.length === 0)
      return res.status(404).json({ success: false, message: "Game not found" });

    // §2 free-tier cap: force max_teams down to the free-tier ceiling unless
    // the organizer has a plan granting 'unlimited_participants'. This runs
    // server-side regardless of what the client sends — the cap can't be
    // bypassed by simply omitting max_teams (that would previously mean
    // "unlimited").
    let effectiveMaxTeams = max_teams || null;
    const unlimited = userId ? await hasFeature(userId, "unlimited_participants") : false;
    if (!unlimited) {
      effectiveMaxTeams = effectiveMaxTeams
        ? Math.min(effectiveMaxTeams, FREE_TIER_MAX_TEAMS)
        : FREE_TIER_MAX_TEAMS;
    }

    // §2 organizer verification gate: a Pro/Org-tier organizer (branded_page
    // access) who hasn't been through admin approval yet gets published as
    // 'pending_review' instead of 'upcoming' — fraud control before their
    // first tournament shows up in public listings. Free-tier organizers are
    // unaffected (no branded page to abuse yet).
    let initialStatus = "upcoming";
    const isPaidTierOrganizer = userId ? await hasFeature(userId, "branded_page") : false;
    if (isPaidTierOrganizer) {
      const [[verification]] = await pool.query(
        "SELECT status FROM organizer_verifications WHERE user_id = ? AND status = 'approved' LIMIT 1",
        [userId]
      );
      if (!verification) initialStatus = "pending_review";
    }

    const [result] = await pool.query(
      `INSERT INTO tournaments
         (name, game_id, prize_pool, entry_fee, region, format,
          start_date, end_date, registration_deadline, status,
          image_url, description, organizer_name, location, join_link, created_by, max_teams)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        name, game_id, prize_pool || 0, entry_fee || 0, region || null, format,
        start_date, end_date, registration_deadline || null, initialStatus,
        image_url || null, description || null,
        organizer_name || null, location || null, join_link || null,
        userId, effectiveMaxTeams,
      ]
    );

    const [tournament] = await pool.query(
      "SELECT * FROM tournaments WHERE tournament_id = ?",
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      tournament: tournament[0],
      ...(initialStatus === "pending_review" && {
        message: "Tournament created — pending admin verification before it goes public.",
      }),
    });
  } catch (err) { next(err); }
};

// ─── REGISTER TEAM FOR TOURNAMENT ─────────────────────────────────────────────
// FIX (medium): added max_teams cap check. Previously unlimited teams could register.
export const registerForTournament = async (req, res, next) => {
  try {
    const { id: tournament_id } = req.params;
    const { team_id } = req.body;
    const userId = req.user.id;

    const [tRows] = await pool.query(
      "SELECT * FROM tournaments WHERE tournament_id = ?",
      [tournament_id]
    );
    if (tRows.length === 0)
      return res.status(404).json({ success: false, message: "Tournament not found" });

    const t = tRows[0];
    if (t.status !== "upcoming")
      return res.status(400).json({ success: false, message: "Tournament registration is closed" });

    if (t.registration_deadline && new Date() > new Date(t.registration_deadline))
      return res.status(400).json({ success: false, message: "Registration deadline has passed" });

    const [membership] = await pool.query(
      "SELECT * FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active'",
      [team_id, userId]
    );
    if (membership.length === 0)
      return res.status(403).json({ success: false, message: "You are not a member of this team" });

    const [existing] = await pool.query(
      "SELECT * FROM tournament_registrations WHERE tournament_id = ? AND team_id = ?",
      [tournament_id, team_id]
    );
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: "Team is already registered" });

    // FIX: enforce max_teams cap if the tournament has one set
    if (t.max_teams) {
      const [[countRow]] = await pool.query(
        "SELECT COUNT(*) AS current_count FROM tournament_registrations WHERE tournament_id = ?",
        [tournament_id]
      );
      if (Number(countRow.current_count) >= t.max_teams) {
        return res.status(409).json({
          success: false,
          message: `Tournament is full (max ${t.max_teams} teams)`,
        });
      }
    }

    const [result] = await pool.query(
      "INSERT INTO tournament_registrations (tournament_id, team_id, status) VALUES (?, ?, 'pending')",
      [tournament_id, team_id]
    );

    const [registration] = await pool.query(
      "SELECT * FROM tournament_registrations WHERE registration_id = ?",
      [result.insertId]
    );

    res.status(201).json({ success: true, registration: registration[0] });
  } catch (err) { next(err); }
};

// ─── UPDATE TOURNAMENT STATUS ─────────────────────────────────────────────────
export const updateTournamentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const validStatuses = ["upcoming", "ongoing", "completed", "cancelled"];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: "Invalid status value" });

    const [existing] = await pool.query(
      "SELECT tournament_id, created_by, status FROM tournaments WHERE tournament_id = ?",
      [id]
    );
    if (existing.length === 0)
      return res.status(404).json({ success: false, message: "Tournament not found" });
    if (existing[0].created_by !== userId && !req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Only the organizer or an admin can update tournament status" });

    // §2: an organizer cannot self-approve out of pending_review — that
    // would bypass the verification gate entirely. Only admins (via the
    // organizer-verification approval flow) can move a tournament off it.
    if (existing[0].status === "pending_review" && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "This tournament is awaiting admin verification and can't be changed until then.",
      });
    }

    await pool.query("UPDATE tournaments SET status = ? WHERE tournament_id = ?", [status, id]);

    const [updated] = await pool.query(
      "SELECT * FROM tournaments WHERE tournament_id = ?",
      [id]
    );

    res.json({ success: true, tournament: updated[0] });
  } catch (err) { next(err); }
};

// ─── DELETE TOURNAMENT ────────────────────────────────────────────────────────
export const deleteTournament = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [rows] = await pool.query(
      "SELECT tournament_id, created_by FROM tournaments WHERE tournament_id = ?",
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Tournament not found" });

    if (rows[0].created_by !== userId && !req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Only the organizer or an admin can delete this tournament" });

    await pool.query("DELETE FROM tournaments WHERE tournament_id = ?", [id]);

    res.json({ success: true, message: "Tournament deleted successfully" });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════
// §2 ORGANIZER TIERS
// ═══════════════════════════════════════════════════════════════════════════

// Shared ownership check used by every §2 endpoint below.
async function assertOwnsOrAdmin(tournamentId, req) {
  const [rows] = await pool.query(
    "SELECT created_by FROM tournaments WHERE tournament_id = ?",
    [tournamentId]
  );
  if (!rows.length) return { error: 404, message: "Tournament not found" };
  if (rows[0].created_by !== req.user.id && !req.user.isAdmin) {
    return { error: 403, message: "Only the organizer or an admin can do this" };
  }
  return null;
}

// ─── UPDATE BRANDING (Pro/Org tier) ────────────────────────────────────────
// PATCH /api/tournaments/:id/branding  { banner_url, brand_primary_color, brand_accent_color }
// Gated by requireFeature('branded_page') at the route level.
export const updateBranding = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ownErr = await assertOwnsOrAdmin(id, req);
    if (ownErr) return res.status(ownErr.error).json({ success: false, message: ownErr.message });

    const { banner_url, brand_primary_color, brand_accent_color } = req.body;

    await pool.query(
      `UPDATE tournaments
         SET banner_url = ?, brand_primary_color = ?, brand_accent_color = ?
       WHERE tournament_id = ?`,
      [banner_url || null, brand_primary_color || null, brand_accent_color || null, id]
    );

    const [updated] = await pool.query("SELECT * FROM tournaments WHERE tournament_id = ?", [id]);
    res.json({ success: true, tournament: updated[0] });
  } catch (err) { next(err); }
};

// ─── ORGANIZER ANALYTICS (Pro/Org tier) ────────────────────────────────────
// GET /api/tournaments/:id/analytics — gated by requireFeature('analytics').
//
// "Conversion rate" and "no-show rate" are proxies over the registration
// statuses the schema actually has (pending/confirmed/disqualified) — there's
// no dedicated no-show flag, so 'disqualified' is used as the closest stand-in.
// Worth a real no-show status if this becomes a heavily-used metric.
export const getTournamentAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ownErr = await assertOwnsOrAdmin(id, req);
    if (ownErr) return res.status(ownErr.error).json({ success: false, message: ownErr.message });

    const [registrationsOverTime] = await pool.query(
      `SELECT DATE(registered_at) AS date, COUNT(*) AS registrations
         FROM tournament_registrations
        WHERE tournament_id = ?
        GROUP BY DATE(registered_at)
        ORDER BY date ASC`,
      [id]
    );

    const [[breakdown]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'confirmed')   AS confirmed,
         SUM(status = 'pending')     AS pending,
         SUM(status = 'disqualified') AS disqualified
       FROM tournament_registrations
       WHERE tournament_id = ?`,
      [id]
    );

    const total = Number(breakdown.total);
    const confirmed = Number(breakdown.confirmed);
    const disqualified = Number(breakdown.disqualified);

    res.json({
      success: true,
      analytics: {
        registrationsOverTime,
        totalRegistrations: total,
        conversionRate: total > 0 ? Number((confirmed / total).toFixed(3)) : 0,
        noShowRate: total > 0 ? Number((disqualified / total).toFixed(3)) : 0,
      },
    });
  } catch (err) { next(err); }
};

// ─── AUTOMATED ANNOUNCEMENTS (Pro/Org tier) ────────────────────────────────
// POST /api/tournaments/:id/announce  { message }
// Gated by requireFeature('announcements'). Notifies every member of every
// team currently registered for this tournament via the existing
// `notifications` table (polled by the frontend like any other notification).
export const announceToTournament = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ownErr = await assertOwnsOrAdmin(id, req);
    if (ownErr) return res.status(ownErr.error).json({ success: false, message: ownErr.message });

    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Announcement message is required" });
    }

    const [recipients] = await pool.query(
      `SELECT DISTINCT tm.user_id
         FROM tournament_registrations tr
         JOIN team_members tm ON tm.team_id = tr.team_id AND tm.status = 'active'
        WHERE tr.tournament_id = ?`,
      [id]
    );

    if (!recipients.length) {
      return res.json({ success: true, message: "No registered participants to notify yet", notified: 0 });
    }

    const values = recipients.map((r) => [r.user_id, "tournament", message.trim(), id]);
    await pool.query(
      "INSERT INTO notifications (user_id, type, message, related_id) VALUES ?",
      [values]
    );

    res.json({ success: true, message: "Announcement sent", notified: recipients.length });
  } catch (err) { next(err); }
};

// ─── MY TOURNAMENTS (organizer dashboard base) ─────────────────────────────
// GET /api/tournaments/mine — every organizer's own tournaments regardless
// of status (including pending_review), with registration counts. Not
// gated — seeing your own tournaments is basic functionality; the paid
// piece is the cross-tournament summary below.
export const getMyTournaments = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, g.game_name, COUNT(tr.registration_id) AS registered_teams
         FROM tournaments t
         JOIN games g ON g.game_id = t.game_id
         LEFT JOIN tournament_registrations tr ON tr.tournament_id = t.tournament_id
        WHERE t.created_by = ?
        GROUP BY t.tournament_id, g.game_name
        ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, tournaments: rows });
  } catch (err) { next(err); }
};

// ─── MULTI-TOURNAMENT DASHBOARD SUMMARY (Organization tier) ────────────────
// GET /api/tournaments/mine/summary — gated by requireFeature('multi_tournament_dashboard').
// Aggregate view across every tournament this organizer runs.
export const getMyTournamentsSummary = async (req, res, next) => {
  try {
    const [[summary]] = await pool.query(
      `SELECT
         COUNT(DISTINCT t.tournament_id) AS totalTournaments,
         SUM(t.status = 'upcoming')      AS upcomingTournaments,
         SUM(t.status = 'ongoing')       AS ongoingTournaments,
         SUM(t.status = 'completed')     AS completedTournaments,
         COUNT(tr.registration_id)       AS totalRegistrations
       FROM tournaments t
       LEFT JOIN tournament_registrations tr ON tr.tournament_id = t.tournament_id
       WHERE t.created_by = ?`,
      [req.user.id]
    );

    res.json({
      success: true,
      summary: {
        totalTournaments: Number(summary.totalTournaments),
        upcomingTournaments: Number(summary.upcomingTournaments),
        ongoingTournaments: Number(summary.ongoingTournaments),
        completedTournaments: Number(summary.completedTournaments),
        totalRegistrations: Number(summary.totalRegistrations),
      },
    });
  } catch (err) { next(err); }
};
