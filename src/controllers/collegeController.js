import pool from "../config/db.js";

// ─── slugify ────────────────────────────────────────────────────────────────
// Simple, dependency-free slug generator (matches the "no new runtime deps
// unless necessary" convention). Collisions are resolved by the caller
// appending -2, -3, etc.
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

async function uniqueSlug(conn, name) {
  const base = slugify(name) || "college";
  let slug = base;
  let suffix = 2;
  // Small, bounded loop — college claims are low-volume, so a handful of
  // existence checks here is not a hot path.
  while (true) {
    const [rows] = await conn.query("SELECT college_id FROM colleges WHERE slug = ?", [slug]);
    if (rows.length === 0) return slug;
    slug = `${base}-${suffix++}`;
  }
}

// ─── CLAIM COLLEGE ──────────────────────────────────────────────────────────
// POST /api/colleges/claim  { name, city?, state?, logo_url? }
// The "claim your college" onboarding flow — any authenticated user can
// submit a claim; it goes live only once an admin approves it
// (GET/POST /api/admin/colleges...), mirroring the §2 organizer-verification
// pattern. The claimer is also set as a member of the college immediately —
// no reason to make the ambassador re-join their own claim once approved.
export const claimCollege = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { name, city, state, logo_url } = req.body;
    const userId = req.user.id;

    await conn.beginTransaction();

    const [existing] = await conn.query(
      "SELECT college_id, status FROM colleges WHERE name = ? LIMIT 1",
      [name]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message:
          existing[0].status === "approved"
            ? "This college is already on ArenaX — join it instead of claiming it again."
            : "This college has already been claimed and is awaiting review.",
      });
    }

    const slug = await uniqueSlug(conn, name);

    const [result] = await conn.query(
      `INSERT INTO colleges (name, slug, city, state, logo_url, status, claimed_by)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [name, slug, city || null, state || null, logo_url || null, userId]
    );

    await conn.commit();

    const [college] = await pool.query("SELECT * FROM colleges WHERE college_id = ?", [result.insertId]);
    res.status(201).json({
      success: true,
      message: "Claim submitted — an admin will review it shortly.",
      college: college[0],
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ─── LIST COLLEGES ──────────────────────────────────────────────────────────
// GET /api/colleges?q=&limit=&offset=  — public, approved colleges only.
// Powers the "join your college" search during onboarding.
export const listColleges = async (req, res, next) => {
  try {
    const { q, limit: _rawLimit = 20, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);

    let query = `
      SELECT c.college_id, c.name, c.slug, c.city, c.state, c.logo_url,
             (SELECT COUNT(*) FROM users u WHERE u.college_id = c.college_id) AS member_count
      FROM colleges c
      WHERE c.status = 'approved'
    `;
    const params = [];
    if (q) { params.push(`%${q}%`); query += " AND c.name LIKE ?"; }

    params.push(limit, Number(offset));
    query += " ORDER BY member_count DESC LIMIT ? OFFSET ?";

    const [rows] = await pool.query(query, params);
    res.json({ success: true, colleges: rows });
  } catch (err) { next(err); }
};

// ─── GET COLLEGE BY SLUG ────────────────────────────────────────────────────
// GET /api/colleges/:slug — public college profile: identity + aggregate
// stats. This is the page students share and rival colleges land on.
export const getCollegeBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const [rows] = await pool.query(
      "SELECT * FROM colleges WHERE slug = ? AND status = 'approved'",
      [slug]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "College not found" });
    }
    const college = rows[0];

    const [
      [{ memberCount }],
      [{ teamCount }],
      [{ tournamentWins }],
      [{ isLicensed }],
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS memberCount FROM users WHERE college_id = ?", [college.college_id]).then(r => r[0]),
      pool.query("SELECT COUNT(*) AS teamCount FROM teams WHERE college_id = ?", [college.college_id]).then(r => r[0]),
      pool.query(
        `SELECT COUNT(*) AS tournamentWins
           FROM matches m
           JOIN teams t ON t.team_id = m.winner_team_id
          WHERE t.college_id = ?`,
        [college.college_id]
      ).then(r => r[0]),
      pool.query(
        `SELECT COUNT(*) AS isLicensed FROM subscriptions s
           JOIN plans p ON p.plan_id = s.plan_id
          WHERE s.org_id = ? AND p.plan_key = 'college_annual'
            AND s.status = 'active' AND (s.renews_at IS NULL OR s.renews_at >= NOW())`,
        [college.college_id]
      ).then(r => r[0]),
    ]);

    res.json({
      success: true,
      college: {
        ...college,
        stats: {
          memberCount: Number(memberCount),
          teamCount: Number(teamCount),
          tournamentWins: Number(tournamentWins),
        },
        isLicensed: Number(isLicensed) > 0,
      },
    });
  } catch (err) { next(err); }
};

// ─── PUBLIC COLLEGE LEADERBOARD ─────────────────────────────────────────────
// GET /api/colleges/leaderboard?limit= — the growth-loop page from the
// roadmap: ranks colleges by tournament wins (primary) and active member
// count (tiebreaker), computed live from matches/users — no stored
// leaderboard table to keep in sync.
export const getCollegeLeaderboard = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 25, 100);

    const [rows] = await pool.query(
      `SELECT c.college_id, c.name, c.slug, c.city, c.state, c.logo_url,
              COUNT(DISTINCT u.user_id)                                   AS member_count,
              COUNT(DISTINCT t.team_id)                                   AS team_count,
              COUNT(DISTINCT CASE WHEN m.winner_team_id = t.team_id THEN m.match_id END) AS tournament_wins
         FROM colleges c
         LEFT JOIN users u ON u.college_id = c.college_id
         LEFT JOIN teams t ON t.college_id = c.college_id
         LEFT JOIN matches m ON m.winner_team_id = t.team_id
        WHERE c.status = 'approved'
        GROUP BY c.college_id, c.name, c.slug, c.city, c.state, c.logo_url
        ORDER BY tournament_wins DESC, member_count DESC
        LIMIT ?`,
      [limit]
    );

    res.json({ success: true, leaderboard: rows });
  } catch (err) { next(err); }
};

// ─── JOIN COLLEGE ───────────────────────────────────────────────────────────
// POST /api/colleges/:id/join — sets the caller's own college_id. Any
// approved college can be joined by anyone; this is identity, not a
// membership application, so there's nothing to approve.
export const joinCollege = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      "SELECT college_id, name FROM colleges WHERE college_id = ? AND status = 'approved'",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "College not found" });
    }

    await pool.query("UPDATE users SET college_id = ? WHERE user_id = ?", [id, req.user.id]);
    res.json({ success: true, message: `Joined ${rows[0].name}`, college_id: Number(id) });
  } catch (err) { next(err); }
};

// ─── LEAVE COLLEGE ──────────────────────────────────────────────────────────
// POST /api/colleges/leave
export const leaveCollege = async (req, res, next) => {
  try {
    await pool.query("UPDATE users SET college_id = NULL WHERE user_id = ?", [req.user.id]);
    res.json({ success: true, message: "Left your college" });
  } catch (err) { next(err); }
};
