import pool from "../config/db.js";
import { invalidateAuthCache } from "../config/db.js";
import { freezeUserCoins } from "../services/coinService.js";

// ─── GET ALL USERS ────────────────────────────────────────────────────────────
export const getAllUsers = async (req, res, next) => {
  try {
    const { status, q, limit: _rawLimit = 50, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);

    let query = `
      SELECT user_id, username, email, status, created_at, last_login,
             country, profile_picture
      FROM users WHERE 1=1
    `;
    const params = [];

    if (status) { params.push(status); query += " AND status = ?"; }
    if (q) {
      params.push(`%${q}%`, `%${q}%`);
      // ILIKE → LIKE (MySQL with utf8mb4_unicode_ci is case-insensitive by default)
      query += " AND (username LIKE ? OR email LIKE ?)";
    }

    params.push(limit, Number(offset));
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";

    const [rows] = await pool.query(query, params);
    res.json({ success: true, users: rows, count: rows.length });
  } catch (err) { next(err); }
};

// ─── BAN USER ─────────────────────────────────────────────────────────────────
export const banUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = "Banned by admin" } = req.body;

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

    const [target] = await pool.query(
      "SELECT user_id, username, email, status FROM users WHERE user_id = ?",
      [id]
    );
    if (target.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });
    if (adminEmails.includes(target[0].email.toLowerCase()))
      return res.status(403).json({ success: false, message: "Cannot ban another admin" });
    if (target[0].status === "banned")
      return res.status(400).json({ success: false, message: "User is already banned" });

    await pool.query("UPDATE users SET status = 'banned' WHERE user_id = ?", [id]);

    // FIX LAG-3: evict from auth cache immediately so the banned user
    // cannot make further authenticated requests within the 60-second cache window.
    invalidateAuthCache(Number(id));

    // Arena Coins: cancel open redemptions and zero the balance. The ban itself
    // has already succeeded, so a failure here is logged, not surfaced.
    try {
      await freezeUserCoins(Number(id), req.user.id);
    } catch (coinErr) {
      console.error("[coins] freezeUserCoins failed for user", id, coinErr.message);
    }

    res.json({ success: true, message: `User @${target[0].username} has been banned`, reason });
  } catch (err) { next(err); }
};

// ─── UNBAN USER ───────────────────────────────────────────────────────────────
export const unbanUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [target] = await pool.query(
      "SELECT user_id, username, status FROM users WHERE user_id = ?",
      [id]
    );
    if (target.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });
    if (target[0].status !== "banned")
      return res.status(400).json({ success: false, message: "User is not currently banned" });

    await pool.query("UPDATE users SET status = 'active' WHERE user_id = ?", [id]);

    res.json({ success: true, message: `User @${target[0].username} has been unbanned` });
  } catch (err) { next(err); }
};

// ─── PLATFORM STATS ───────────────────────────────────────────────────────────
export const getPlatformStats = async (req, res, next) => {
  try {
    const [
      [totalUsers],
      [activeUsers],
      [bannedUsers],
      [newUsersToday],
      [totalTournaments],
      [activeTournaments],
      [totalTeams],
      [totalPosts],
      [postsToday],
      [liveStreams],
      [totalTeamFinderPosts],
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS count FROM users"),
      pool.query("SELECT COUNT(*) AS count FROM users WHERE status = 'active'"),
      pool.query("SELECT COUNT(*) AS count FROM users WHERE status = 'banned'"),
      // INTERVAL '24 hours' → INTERVAL 24 HOUR
      pool.query("SELECT COUNT(*) AS count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)"),
      pool.query("SELECT COUNT(*) AS count FROM tournaments"),
      pool.query("SELECT COUNT(*) AS count FROM tournaments WHERE status IN ('upcoming', 'ongoing')"),
      pool.query("SELECT COUNT(*) AS count FROM teams"),
      pool.query("SELECT COUNT(*) AS count FROM community_posts"),
      pool.query("SELECT COUNT(*) AS count FROM community_posts WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)"),
      pool.query("SELECT COUNT(*) AS count FROM streams WHERE status = 'live'"),
      pool.query("SELECT COUNT(*) AS count FROM team_finder_posts WHERE status = 'open'"),
    ]);

    res.json({
      success: true,
      stats: {
        users: {
          total:    parseInt(totalUsers[0].count),
          active:   parseInt(activeUsers[0].count),
          banned:   parseInt(bannedUsers[0].count),
          newToday: parseInt(newUsersToday[0].count),
        },
        tournaments: {
          total:  parseInt(totalTournaments[0].count),
          active: parseInt(activeTournaments[0].count),
        },
        teams:               parseInt(totalTeams[0].count),
        posts: {
          total: parseInt(totalPosts[0].count),
          today: parseInt(postsToday[0].count),
        },
        liveStreams:          parseInt(liveStreams[0].count),
        openTeamFinderPosts:  parseInt(totalTeamFinderPosts[0].count),
      },
    });
  } catch (err) { next(err); }
};

// ─── FORCE UPDATE USERNAME ────────────────────────────────────────────────────
export const forceUpdateUsername = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { username } = req.body;

    if (!username || username.trim().length < 3 || username.trim().length > 30) {
      return res.status(400).json({ success: false, message: "Username must be 3–30 characters" });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ success: false, message: "Username can only contain letters, numbers, and underscores" });
    }

    const [taken] = await pool.query(
      "SELECT user_id FROM users WHERE username = ? AND user_id != ?",
      [username.trim(), id]
    );
    if (taken.length > 0)
      return res.status(409).json({ success: false, message: "Username already taken" });

    const [result] = await pool.query(
      "UPDATE users SET username = ? WHERE user_id = ?",
      [username.trim(), id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    // Fetch the updated row (RETURNING not available in MySQL)
    const [updated] = await pool.query(
      "SELECT user_id, username FROM users WHERE user_id = ?",
      [id]
    );

    res.json({
      success: true,
      message: `Username updated to @${updated[0].username}`,
      user: updated[0],
    });
  } catch (err) { next(err); }
};

// âââ GET BILLING STATS âââââââââââââââââââââââââââââââââ
// GET /api/admin/billing â Â§1's minimal admin billing view: who's subscribed, MRR,
// failed payments, churn. Admin-only (mounted under the same requireAdmin
// gate as every other route in this file).
export const getBillingStats = async (req, res, next) => {
  try {
    const [
      [{ activeSubs }],
      [{ mrr }],
      [{ failedPayments }],
      [{ canceledThisMonth }],
      recentPayments,
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS activeSubs FROM subscriptions WHERE status = 'active' AND COALESCE(gateway, '') <> 'coins'").then(r => r[0]),
      pool.query(`
        SELECT COALESCE(SUM(
          CASE WHEN p.billing_cycle = 'annual' THEN p.price / 12 ELSE p.price END
        ), 0) AS mrr
        FROM subscriptions s
        JOIN plans p ON p.plan_id = s.plan_id
        WHERE s.status = 'active' AND COALESCE(s.gateway, '') <> 'coins'
      `).then(r => r[0]),
      pool.query("SELECT COUNT(*) AS failedPayments FROM payments WHERE status = 'failed' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)").then(r => r[0]),
      pool.query("SELECT COUNT(*) AS canceledThisMonth FROM subscriptions WHERE status = 'canceled' AND canceled_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)").then(r => r[0]),
      pool.query(`
        SELECT p.payment_id, p.amount, p.currency, p.status, p.gateway, p.created_at,
               u.username, pl.name AS plan_name
        FROM payments p
        JOIN users u ON u.user_id = p.user_id
        JOIN plans pl ON pl.plan_id = p.plan_id
        ORDER BY p.created_at DESC
        LIMIT 20
      `).then(r => r[0]),
    ]);

    res.json({
      success: true,
      billing: {
        activeSubscriptions: Number(activeSubs),
        mrr: Number(mrr),
        failedPayments30d: Number(failedPayments),
        canceled30d: Number(canceledThisMonth),
        recentPayments,
      },
    });
  } catch (err) { next(err); }
};

// âââ ORGANIZER VERIFICATION QUEUE (Â§2) âââââââââââââââââââââââ
// GET /api/admin/organizer-verifications?status=pending
export const getOrganizerVerifications = async (req, res, next) => {
  try {
    const status = req.query.status || "pending";
    const [rows] = await pool.query(
      `SELECT ov.verification_id, ov.user_id, ov.status, ov.note, ov.requested_at, ov.reviewed_at,
              u.username, u.email
         FROM organizer_verifications ov
         JOIN users u ON u.user_id = ov.user_id
        WHERE ov.status = ?
        ORDER BY ov.requested_at ASC`,
      [status]
    );
    res.json({ success: true, verifications: rows });
  } catch (err) { next(err); }
};

// POST /api/admin/organizer-verifications/:id/approve
export const approveOrganizerVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      `UPDATE organizer_verifications
          SET status = 'approved', reviewed_at = NOW(), reviewed_by = ?
        WHERE verification_id = ? AND status = 'pending'`,
      [req.user.id, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "No pending verification request with that id" });
    }
    res.json({ success: true, message: "Organizer approved" });
  } catch (err) { next(err); }
};

// POST /api/admin/organizer-verifications/:id/reject  { note }
export const rejectOrganizerVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const [result] = await pool.query(
      `UPDATE organizer_verifications
          SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ?, note = ?
        WHERE verification_id = ? AND status = 'pending'`,
      [req.user.id, note || null, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "No pending verification request with that id" });
    }
    res.json({ success: true, message: "Organizer verification rejected" });
  } catch (err) { next(err); }
};

// ─── REPORTS QUEUE (§9) ──────────────────────────────────────────────────────
// GET /api/admin/reports?status=pending&type=user|tournament
// Now covers both player-side reports (reported_user) and organizer-side
// abuse reports (reported_tournament_id) — the split from §9's schema
// change. `type` filters between them; omit it to see both.
export const getReports = async (req, res, next) => {
  try {
    const status = req.query.status || "pending";
    const { type } = req.query; // 'user' | 'tournament' | undefined (both)

    let query = `
      SELECT r.report_id, r.reason, r.category, r.status, r.created_at,
             r.resolution_note, r.resolved_at,
             reporter.user_id AS reporter_id, reporter.username AS reporter_username,
             r.reported_user,
             ru.username AS reported_username,
             r.reported_tournament_id,
             t.name AS reported_tournament_name
        FROM reports r
        JOIN users reporter   ON reporter.user_id = r.reported_by
        LEFT JOIN users ru        ON ru.user_id = r.reported_user
        LEFT JOIN tournaments t   ON t.tournament_id = r.reported_tournament_id
       WHERE r.status = ?
    `;
    const params = [status];
    if (type === "user") query += " AND r.reported_user IS NOT NULL";
    if (type === "tournament") query += " AND r.reported_tournament_id IS NOT NULL";
    query += " ORDER BY r.created_at ASC";

    const [rows] = await pool.query(query, params);
    res.json({ success: true, reports: rows });
  } catch (err) { next(err); }
};

// POST /api/admin/reports/:id/resolve  { status: 'resolved' | 'dismissed', note? }
export const resolveReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    if (!["resolved", "dismissed"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'resolved' or 'dismissed'" });
    }

    const [result] = await pool.query(
      `UPDATE reports
          SET status = ?, resolution_note = ?, resolved_by = ?, resolved_at = NOW()
        WHERE report_id = ? AND status = 'pending'`,
      [status, note || null, req.user.id, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "No pending report with that id" });
    }
    res.json({ success: true, message: `Report ${status}` });
  } catch (err) { next(err); }
};

// ─── PAYMENT DISPUTES (§9) ───────────────────────────────────────────────────
// GET /api/admin/disputes?status=open
export const getDisputes = async (req, res, next) => {
  try {
    const status = req.query.status || "open";
    const [rows] = await pool.query(
      `SELECT d.dispute_id, d.reason, d.status, d.admin_note, d.created_at, d.resolved_at,
              u.user_id, u.username,
              p.payment_id, p.amount, p.currency, p.gateway, p.gateway_payment_id, p.status AS payment_status
         FROM payment_disputes d
         JOIN users u ON u.user_id = d.user_id
         JOIN payments p ON p.payment_id = d.payment_id
        WHERE d.status = ?
        ORDER BY d.created_at ASC`,
      [status]
    );
    res.json({ success: true, disputes: rows });
  } catch (err) { next(err); }
};

// POST /api/admin/disputes/:id/resolve  { status: 'refunded' | 'denied', note? }
// On 'refunded': flips the underlying payment to 'refunded' too (payments.status
// already has that value in its enum from §1) and cancels the subscription it
// opened, if still active — a refunded payment shouldn't leave a live
// subscription behind. This does NOT call Razorpay's refund API; that's a
// manual step outside ArenaX for now, exactly as the roadmap allows.
export const resolveDispute = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    if (!["refunded", "denied"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'refunded' or 'denied'" });
    }

    await conn.beginTransaction();

    const [[dispute]] = await conn.query(
      "SELECT * FROM payment_disputes WHERE dispute_id = ? AND status = 'open' FOR UPDATE",
      [id]
    );
    if (!dispute) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "No open dispute with that id" });
    }

    await conn.query(
      "UPDATE payment_disputes SET status = ?, admin_note = ?, resolved_by = ?, resolved_at = NOW() WHERE dispute_id = ?",
      [status, note || null, req.user.id, id]
    );

    if (status === "refunded") {
      const [[payment]] = await conn.query("SELECT * FROM payments WHERE payment_id = ?", [dispute.payment_id]);
      await conn.query("UPDATE payments SET status = 'refunded' WHERE payment_id = ?", [dispute.payment_id]);
      if (payment?.subscription_id) {
        await conn.query(
          "UPDATE subscriptions SET status = 'canceled', canceled_at = NOW() WHERE subscription_id = ? AND status = 'active'",
          [payment.subscription_id]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: `Dispute ${status}` });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ─── ANALYTICS: DAU / WAU / MAU (§6) ────────────────────────────────────────
// GET /api/admin/analytics/overview
// (Restored — this and the four endpoints below were dropped when §6 and §9
// were merged independently, since both touched this file.)
export const getAnalyticsOverview = async (req, res, next) => {
  try {
    const [
      [{ dau }],
      [{ wau }],
      [{ mau }],
      [{ totalUsers }],
    ] = await Promise.all([
      pool.query("SELECT COUNT(DISTINCT user_id) AS dau FROM events WHERE event_type = 'login' AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)").then(r => r[0]),
      pool.query("SELECT COUNT(DISTINCT user_id) AS wau FROM events WHERE event_type = 'login' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)").then(r => r[0]),
      pool.query("SELECT COUNT(DISTINCT user_id) AS mau FROM events WHERE event_type = 'login' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)").then(r => r[0]),
      pool.query("SELECT COUNT(*) AS totalUsers FROM users WHERE status = 'active'").then(r => r[0]),
    ]);

    res.json({
      success: true,
      overview: { dau: Number(dau), wau: Number(wau), mau: Number(mau), totalUsers: Number(totalUsers) },
    });
  } catch (err) { next(err); }
};

// ─── ANALYTICS: RETENTION COHORTS (§6) ──────────────────────────────────────
// GET /api/admin/analytics/retention?window=7|30
export const getRetentionCohorts = async (req, res, next) => {
  try {
    const window = Number(req.query.window) === 30 ? 30 : 7;
    const cohortsToShow = window === 30 ? 6 : 8;
    const lookbackDays = window * (cohortsToShow + 1);

    const [rows] = await pool.query(
      `SELECT
          DATE(u.created_at) AS cohort_date,
          COUNT(DISTINCT u.user_id) AS cohort_size,
          COUNT(DISTINCT e.user_id) AS retained
         FROM users u
         LEFT JOIN events e
           ON e.user_id = u.user_id
          AND e.event_type = 'login'
          AND DATE(e.created_at) = DATE_ADD(DATE(u.created_at), INTERVAL ? DAY)
        WHERE u.created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND u.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(u.created_at)
        ORDER BY cohort_date DESC`,
      [window, window, lookbackDays]
    );

    const cohorts = rows.map(r => ({
      cohortDate: r.cohort_date,
      cohortSize: Number(r.cohort_size),
      retained: Number(r.retained),
      retentionRate: r.cohort_size > 0 ? Number((r.retained / r.cohort_size).toFixed(3)) : 0,
    }));

    res.json({ success: true, window: `D${window}`, cohorts });
  } catch (err) { next(err); }
};

// ─── ANALYTICS: SIGNUP → PROFILE-COMPLETE → FIRST-TOURNAMENT FUNNEL (§6) ────
// GET /api/admin/analytics/funnel
export const getFunnel = async (req, res, next) => {
  try {
    const [
      [{ totalSignups }],
      [{ profileComplete }],
      [{ firstTournament }],
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS totalSignups FROM users").then(r => r[0]),
      pool.query(
        "SELECT COUNT(*) AS profileComplete FROM users WHERE bio IS NOT NULL AND bio != '' AND profile_picture IS NOT NULL AND profile_picture != ''"
      ).then(r => r[0]),
      pool.query(
        `SELECT COUNT(DISTINCT tm.user_id) AS firstTournament
           FROM team_members tm
           JOIN tournament_registrations tr ON tr.team_id = tm.team_id
          WHERE tm.status = 'active'`
      ).then(r => r[0]),
    ]);

    res.json({
      success: true,
      funnel: { signups: Number(totalSignups), profileComplete: Number(profileComplete), firstTournament: Number(firstTournament) },
    });
  } catch (err) { next(err); }
};

// ─── ANALYTICS: ORGANIZER RETENTION (§6) ────────────────────────────────────
// GET /api/admin/analytics/organizer-retention
export const getOrganizerRetention = async (req, res, next) => {
  try {
    const [[row]] = await pool.query(
      `SELECT
          COUNT(*) AS totalOrganizers,
          SUM(months_active > 1) AS returningOrganizers
         FROM (
           SELECT created_by, COUNT(DISTINCT DATE_FORMAT(created_at, '%Y-%m')) AS months_active
             FROM tournaments
            WHERE created_by IS NOT NULL
            GROUP BY created_by
         ) sub`
    );

    const totalOrganizers = Number(row.totalOrganizers);
    const returningOrganizers = Number(row.returningOrganizers) || 0;

    res.json({
      success: true,
      organizerRetention: {
        totalOrganizers,
        returningOrganizers,
        retentionRate: totalOrganizers > 0 ? Number((returningOrganizers / totalOrganizers).toFixed(3)) : 0,
      },
    });
  } catch (err) { next(err); }
};

// ─── ANALYTICS: DAILY TREND (§6) ─────────────────────────────────────────────
// GET /api/admin/analytics/trend?days=30
export const getAnalyticsTrend = async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 90);

    const [rolledUp] = await pool.query(
      `SELECT rollup_date, signups, logins, tournament_registrations, teams_created, community_posts
         FROM analytics_daily_rollup
        WHERE rollup_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ORDER BY rollup_date ASC`,
      [days]
    );

    const todayStr = new Date().toISOString().slice(0, 10);
    const alreadyHasToday = rolledUp.some(r => r.rollup_date.toISOString?.().slice(0, 10) === todayStr || String(r.rollup_date) === todayStr);

    let todayRow = null;
    if (!alreadyHasToday) {
      const [
        [{ signups }],
        [{ logins }],
        [{ tournament_registrations }],
        [{ teams_created }],
        [{ community_posts }],
      ] = await Promise.all([
        pool.query("SELECT COUNT(*) AS signups FROM users WHERE DATE(created_at) = CURDATE()").then(r => r[0]),
        pool.query("SELECT COUNT(DISTINCT user_id) AS logins FROM events WHERE event_type = 'login' AND DATE(created_at) = CURDATE()").then(r => r[0]),
        pool.query("SELECT COUNT(*) AS tournament_registrations FROM events WHERE event_type = 'tournament_registration' AND DATE(created_at) = CURDATE()").then(r => r[0]),
        pool.query("SELECT COUNT(*) AS teams_created FROM events WHERE event_type = 'team_created' AND DATE(created_at) = CURDATE()").then(r => r[0]),
        pool.query("SELECT COUNT(*) AS community_posts FROM events WHERE event_type = 'community_post' AND DATE(created_at) = CURDATE()").then(r => r[0]),
      ]);
      todayRow = { rollup_date: todayStr, signups: Number(signups), logins: Number(logins), tournament_registrations: Number(tournament_registrations), teams_created: Number(teams_created), community_posts: Number(community_posts) };
    }

    res.json({ success: true, trend: [...rolledUp, ...(todayRow ? [todayRow] : [])] });
  } catch (err) { next(err); }
};

// ─── SPONSOR APPLICATION QUEUE (§5) ─────────────────────────────────────────
// GET /api/admin/sponsors?status=pending
export const getSponsorApplications = async (req, res, next) => {
  try {
    const status = req.query.status || "pending";
    const [rows] = await pool.query(
      `SELECT sp.sponsor_id, sp.company_name, sp.website, sp.contact_email, sp.logo_url, sp.status, sp.created_at,
              u.user_id, u.username, u.email
         FROM sponsor_profiles sp
         JOIN users u ON u.user_id = sp.user_id
        WHERE sp.status = ?
        ORDER BY sp.created_at ASC`,
      [status]
    );
    res.json({ success: true, sponsors: rows });
  } catch (err) { next(err); }
};

// POST /api/admin/sponsors/:id/approve — flips users.account_type to 'sponsor' too
export const approveSponsorApplication = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    await conn.beginTransaction();

    const [[sponsor]] = await conn.query(
      "SELECT user_id FROM sponsor_profiles WHERE sponsor_id = ? AND status = 'pending' FOR UPDATE",
      [id]
    );
    if (!sponsor) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "No pending sponsor application with that id" });
    }

    await conn.query(
      "UPDATE sponsor_profiles SET status = 'approved', approved_at = NOW(), approved_by = ? WHERE sponsor_id = ?",
      [req.user.id, id]
    );
    await conn.query("UPDATE users SET account_type = 'sponsor' WHERE user_id = ?", [sponsor.user_id]);

    await conn.commit();
    res.json({ success: true, message: "Sponsor approved" });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// POST /api/admin/sponsors/:id/reject
export const rejectSponsorApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      "UPDATE sponsor_profiles SET status = 'rejected' WHERE sponsor_id = ? AND status = 'pending'",
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "No pending sponsor application with that id" });
    }
    res.json({ success: true, message: "Sponsor application rejected" });
  } catch (err) { next(err); }
};

// ─── FEATURED PLACEMENTS (§5) ────────────────────────────────────────────────
// GET /api/admin/placements — every placement, active or not, for the admin
// panel's management view (getFeaturedTournaments, the public-facing one in
// tournamentController.js, only shows active ones).
export const getPlacements = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT fp.*, t.name AS tournament_name, sp.company_name AS sponsor_name
         FROM featured_placements fp
         JOIN tournaments t ON t.tournament_id = fp.tournament_id
         JOIN sponsor_profiles sp ON sp.sponsor_id = fp.sponsor_id
        ORDER BY fp.created_at DESC`
    );
    res.json({ success: true, placements: rows });
  } catch (err) { next(err); }
};

// POST /api/admin/placements  { tournament_id, sponsor_id, slot_type?, starts_at?, ends_at? }
// Manual assignment — no bidding marketplace, per the roadmap.
export const createPlacement = async (req, res, next) => {
  try {
    const { tournament_id, sponsor_id, slot_type, starts_at, ends_at } = req.body;

    const [[tournament]] = await pool.query("SELECT tournament_id FROM tournaments WHERE tournament_id = ?", [tournament_id]);
    if (!tournament) {
      return res.status(404).json({ success: false, message: "Tournament not found" });
    }
    const [[sponsor]] = await pool.query("SELECT sponsor_id FROM sponsor_profiles WHERE sponsor_id = ? AND status = 'approved'", [sponsor_id]);
    if (!sponsor) {
      return res.status(404).json({ success: false, message: "No approved sponsor with that id" });
    }

    const [result] = await pool.query(
      `INSERT INTO featured_placements (tournament_id, sponsor_id, slot_type, starts_at, ends_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tournament_id, sponsor_id, slot_type || "featured_tournament", starts_at || null, ends_at || null, req.user.id]
    );
    res.status(201).json({ success: true, placement_id: result.insertId });
  } catch (err) { next(err); }
};

// PATCH /api/admin/placements/:id  { is_active }  — deactivate (or reactivate) a slot
export const updatePlacement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const [result] = await pool.query(
      "UPDATE featured_placements SET is_active = ? WHERE placement_id = ?",
      [!!is_active, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Placement not found" });
    }
    res.json({ success: true, message: `Placement ${is_active ? "activated" : "deactivated"}` });
  } catch (err) { next(err); }
};

// ─── SPONSOR INSIGHTS (§5 → §6 hook) ────────────────────────────────────────
// GET /api/admin/sponsor-insights?game_id=
// The aggregate, anonymized stats pipeline the roadmap describes — this is
// the actual product a sponsor eventually pays for ("Valorant tournament
// participation rose X% this quarter"), built
// entirely on §6's `events` table. Admin-only for now: there's no
// sponsor-facing portal yet, just the data plumbing, exactly as the
// roadmap frames it ("start logging now even though the sponsor-facing
// product comes later"). Counts only — no user-level data ever leaves
// this query.
export const getSponsorInsights = async (req, res, next) => {
  try {
    const { game_id } = req.query;

    const registrationFilter = game_id
      ? `AND e.metadata->>'$.tournament_id' IN (SELECT tournament_id FROM tournaments WHERE game_id = ?)`
      : "";
    const params = game_id ? [game_id] : [];

    const [
      [{ thisQuarter }],
      [{ lastQuarter }],
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS thisQuarter FROM events e
          WHERE e.event_type = 'tournament_registration'
            AND e.created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
            ${registrationFilter}`,
        params
      ).then(r => r[0]),
      pool.query(
        `SELECT COUNT(*) AS lastQuarter FROM events e
          WHERE e.event_type = 'tournament_registration'
            AND e.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            AND e.created_at <  DATE_SUB(NOW(), INTERVAL 3 MONTH)
            ${registrationFilter}`,
        params
      ).then(r => r[0]),
    ]);

    const qoqChange = lastQuarter > 0 ? Number((((thisQuarter - lastQuarter) / lastQuarter) * 100).toFixed(1)) : null;

    res.json({
      success: true,
      insights: {
        game_id: game_id ? Number(game_id) : null,
        tournamentParticipation: {
          thisQuarter: Number(thisQuarter),
          lastQuarter: Number(lastQuarter),
          qoqChangePercent: qoqChange,
        },
      },
    });
  } catch (err) { next(err); }
};

// ─── GEAR / AFFILIATE COMMERCE (§8) ──────────────────────────────────────────
// GET /api/admin/gear — every item, active or not (the public listGear in
// gearController.js only shows active ones).
export const getAllGear = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.*,
              (SELECT COUNT(*) FROM gear_clicks gc WHERE gc.item_id = g.item_id) AS total_clicks
         FROM gear_items g
        ORDER BY g.display_order ASC, g.item_id ASC`
    );
    res.json({ success: true, gear: rows });
  } catch (err) { next(err); }
};

// POST /api/admin/gear  { name, category?, image_url?, price_display?, affiliate_url, display_order? }
export const createGear = async (req, res, next) => {
  try {
    const { name, category, image_url, price_display, affiliate_url, display_order } = req.body;
    const [result] = await pool.query(
      `INSERT INTO gear_items (name, category, image_url, price_display, affiliate_url, display_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, category || null, image_url || null, price_display || null, affiliate_url, display_order || 0, req.user.id]
    );
    res.status(201).json({ success: true, item_id: result.insertId });
  } catch (err) { next(err); }
};

// PATCH /api/admin/gear/:id  — any subset of the same fields, plus is_active
export const updateGear = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, image_url, price_display, affiliate_url, display_order, is_active } = req.body;

    const [result] = await pool.query(
      `UPDATE gear_items SET
         name           = COALESCE(?, name),
         category       = COALESCE(?, category),
         image_url      = COALESCE(?, image_url),
         price_display  = COALESCE(?, price_display),
         affiliate_url  = COALESCE(?, affiliate_url),
         display_order  = COALESCE(?, display_order),
         is_active      = COALESCE(?, is_active)
       WHERE item_id = ?`,
      [name || null, category || null, image_url || null, price_display || null,
       affiliate_url || null, display_order ?? null, typeof is_active === "boolean" ? is_active : null, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Gear item not found" });
    }
    res.json({ success: true, message: "Gear item updated" });
  } catch (err) { next(err); }
};

// DELETE /api/admin/gear/:id
export const deleteGear = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query("DELETE FROM gear_items WHERE item_id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Gear item not found" });
    }
    res.json({ success: true, message: "Gear item deleted" });
  } catch (err) { next(err); }
};

// GET /api/admin/gear/:id/clicks?days=30 — daily click counts for one item,
// the reconciliation view against whatever the affiliate program itself
// reports as paid-out commission.
export const getGearClicks = async (req, res, next) => {
  try {
    const { id } = req.params;
    const days = Math.min(Number(req.query.days) || 30, 365);

    const [[item]] = await pool.query("SELECT item_id, name FROM gear_items WHERE item_id = ?", [id]);
    if (!item) {
      return res.status(404).json({ success: false, message: "Gear item not found" });
    }

    const [rows] = await pool.query(
      `SELECT DATE(clicked_at) AS click_date, COUNT(*) AS clicks
         FROM gear_clicks
        WHERE item_id = ? AND clicked_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(clicked_at)
        ORDER BY click_date ASC`,
      [id, days]
    );

    res.json({ success: true, item, dailyClicks: rows, totalClicks: rows.reduce((sum, r) => sum + Number(r.clicks), 0) });
  } catch (err) { next(err); }
};
