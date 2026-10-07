import crypto from "crypto";
import pool from "../config/db.js";
import { getTractionSnapshot } from "../services/tractionService.js";

const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

// ─── ADMIN ──────────────────────────────────────────────────────────────────
// GET /api/admin/investor-links
export const listInvestorLinks = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT l.link_id, l.label, l.created_at, l.expires_at, l.revoked_at, l.view_count, l.last_viewed_at,
              u.username AS created_by,
              CASE WHEN l.revoked_at IS NOT NULL THEN 'revoked' WHEN l.expires_at <= NOW() THEN 'expired' ELSE 'active' END AS state
         FROM investor_links l LEFT JOIN users u ON u.user_id = l.created_by
        ORDER BY l.link_id DESC LIMIT 50`
    );
    res.json({ success: true, links: rows });
  } catch (err) { next(err); }
};

// POST /api/admin/investor-links { label, expires_in_days }
// The raw token is returned ONCE here and never stored.
export const createInvestorLink = async (req, res, next) => {
  try {
    const label = String(req.body?.label || "").trim().slice(0, 120);
    if (!label) return res.status(400).json({ success: false, message: "Give the link a label (e.g. who it is for)" });
    const days = Math.min(365, Math.max(1, parseInt(req.body?.expires_in_days, 10) || 30));
    const token = crypto.randomBytes(24).toString("base64url");
    await pool.query(
      "INSERT INTO investor_links (token_hash, label, created_by, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))",
      [hashToken(token), label, req.user.id, days]
    );
    res.status(201).json({ success: true, token, path: `/investors/${token}`, expires_in_days: days });
  } catch (err) { next(err); }
};

// DELETE /api/admin/investor-links/:id  (revoke; keeps the row for the view history)
export const revokeInvestorLink = async (req, res, next) => {
  try {
    const [r] = await pool.query("UPDATE investor_links SET revoked_at = NOW() WHERE link_id = ? AND revoked_at IS NULL", [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ success: false, message: "Link not found or already revoked" });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// GET /api/admin/traction?fresh=1  (admin preview of exactly what investors see)
export const previewTraction = async (req, res, next) => {
  try {
    res.json({ success: true, snapshot: await getTractionSnapshot({ fresh: req.query.fresh === "1" }) });
  } catch (err) { next(err); }
};

// ─── PUBLIC ─────────────────────────────────────────────────────────────────
// GET /api/traction/:token   (no login). Any bad/expired/revoked token gets the same 404.
export const getPublicTraction = async (req, res, next) => {
  try {
    res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
    const token = req.params.token;
    const notFound = () => res.status(404).json({ success: false, message: "This link is invalid or has expired." });
    if (!TOKEN_RE.test(token || "")) return notFound();

    const [rows] = await pool.query(
      "SELECT link_id, label FROM investor_links WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()",
      [hashToken(token)]
    );
    if (!rows.length) return notFound();

    pool.query("UPDATE investor_links SET view_count = view_count + 1, last_viewed_at = NOW() WHERE link_id = ?", [rows[0].link_id])
      .catch((e) => console.error("[traction] view count failed:", e.message));

    res.json({ success: true, snapshot: await getTractionSnapshot() });
  } catch (err) { next(err); }
};
