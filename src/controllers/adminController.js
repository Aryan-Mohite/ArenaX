import pool from "../config/db.js";
import { invalidateAuthCache } from "../config/db.js";

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
      pool.query("SELECT COUNT(*) AS activeSubs FROM subscriptions WHERE status = 'active'").then(r => r[0]),
      pool.query(`
        SELECT COALESCE(SUM(
          CASE WHEN p.billing_cycle = 'annual' THEN p.price / 12 ELSE p.price END
        ), 0) AS mrr
        FROM subscriptions s
        JOIN plans p ON p.plan_id = s.plan_id
        WHERE s.status = 'active'
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

// ─── COLLEGE CLAIM QUEUE (§3) ───────────────────────────────────────────────
// GET /api/admin/colleges?status=pending — mirrors the §2 organizer
// verification queue pattern.
export const getCollegeClaims = async (req, res, next) => {
  try {
    const status = req.query.status || "pending";
    const [rows] = await pool.query(
      `SELECT c.college_id, c.name, c.slug, c.city, c.state, c.status, c.created_at,
              u.username AS claimed_by_username, u.email AS claimed_by_email
         FROM colleges c
         LEFT JOIN users u ON u.user_id = c.claimed_by
        WHERE c.status = ?
        ORDER BY c.created_at ASC`,
      [status]
    );
    res.json({ success: true, colleges: rows });
  } catch (err) { next(err); }
};

// POST /api/admin/colleges/:id/approve
export const approveCollegeClaim = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      `UPDATE colleges
          SET status = 'approved', approved_at = NOW(), approved_by = ?
        WHERE college_id = ? AND status = 'pending'`,
      [req.user.id, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "No pending college claim with that id" });
    }
    res.json({ success: true, message: "College approved" });
  } catch (err) { next(err); }
};

// POST /api/admin/colleges/:id/reject
export const rejectCollegeClaim = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      "UPDATE colleges SET status = 'rejected' WHERE college_id = ? AND status = 'pending'",
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "No pending college claim with that id" });
    }
    res.json({ success: true, message: "College claim rejected" });
  } catch (err) { next(err); }
};

// ─── COLLEGE ANNUAL LICENSE (§3 → §1 hook) ──────────────────────────────────
// POST /api/admin/colleges/:id/license  { action: 'grant' | 'revoke' }
// Manual toggle, not a checkout flow — per the roadmap, §3's billing tier
// just needs the plan/entitlement to exist so it can be switched on when
// the first real paying college pilot is ready. Reuses `subscriptions.org_id`
// (reserved back in §1) rather than inventing a parallel college-billing table.
export const setCollegeLicense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    if (!["grant", "revoke"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'grant' or 'revoke'" });
    }

    const [[college]] = await pool.query(
      "SELECT college_id, status FROM colleges WHERE college_id = ?",
      [id]
    );
    if (!college) {
      return res.status(404).json({ success: false, message: "College not found" });
    }

    if (action === "revoke") {
      const [result] = await pool.query(
        `UPDATE subscriptions s
           JOIN plans p ON p.plan_id = s.plan_id
            SET s.status = 'canceled', s.canceled_at = NOW()
          WHERE s.org_id = ? AND p.plan_key = 'college_annual' AND s.status = 'active'`,
        [id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "No active license to revoke" });
      }
      return res.json({ success: true, message: "College license revoked" });
    }

    // grant
    const [[existingActive]] = await pool.query(
      `SELECT s.subscription_id FROM subscriptions s
         JOIN plans p ON p.plan_id = s.plan_id
        WHERE s.org_id = ? AND p.plan_key = 'college_annual' AND s.status = 'active'`,
      [id]
    );
    if (existingActive) {
      return res.status(409).json({ success: false, message: "This college already has an active license" });
    }

    const [[plan]] = await pool.query("SELECT plan_id FROM plans WHERE plan_key = 'college_annual'", []);
    await pool.query(
      `INSERT INTO subscriptions (org_id, plan_id, status, renews_at, gateway)
       VALUES (?, ?, 'active', DATE_ADD(NOW(), INTERVAL 365 DAY), 'admin_grant')`,
      [id, plan.plan_id]
    );

    res.json({ success: true, message: "College license granted (1 year)" });
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
