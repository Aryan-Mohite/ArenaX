import pool from "../config/db.js";

// ─── LIST GEAR ────────────────────────────────────────────────────────────────
// GET /api/gear — public. Powers the "Gear" section. Deliberately no pricing
// logic, no cart, no checkout — this links out to Amazon (or whatever
// program), it doesn't sell anything itself.
export const listGear = async (req, res, next) => {
  try {
    const { category } = req.query;
    let query = "SELECT item_id, name, category, image_url, price_display, display_order FROM gear_items WHERE is_active = TRUE";
    const params = [];
    if (category) { params.push(category); query += " AND category = ?"; }
    query += " ORDER BY display_order ASC, item_id ASC";

    const [rows] = await pool.query(query, params);
    res.json({ success: true, gear: rows });
  } catch (err) { next(err); }
};

// ─── REDIRECT (§8's actual point) ────────────────────────────────────────────
// GET /api/gear/:id/redirect — public. Logs a click, then 302s to the real
// affiliate_url. The click log write happens before the redirect (not
// fire-and-forget) because it's the entire reason this endpoint exists
// rather than the frontend linking straight to Amazon — losing the odd
// click to a slow insert would defeat the point; a redirect is cheap
// enough that this doesn't need to be async-after-response the way, say,
// event logging elsewhere in this codebase is.
export const redirectToGear = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[item]] = await pool.query(
      "SELECT item_id, affiliate_url FROM gear_items WHERE item_id = ? AND is_active = TRUE",
      [id]
    );
    if (!item) {
      return res.status(404).json({ success: false, message: "Gear item not found" });
    }

    // No auth on this route (see gearRoutes.js) — the Gear section works
    // for logged-out visitors, and this codebase doesn't have an optional/
    // soft-auth middleware yet (authMiddleware always 401s if there's no
    // token). user_id stays null for every click for now; the roadmap's
    // stated purpose here is aggregate click-count reconciliation against
    // affiliate payouts, not per-user attribution, so that's not a gap.
    await pool.query(
      "INSERT INTO gear_clicks (item_id, user_id) VALUES (?, ?)",
      [id, null]
    );

    res.redirect(302, item.affiliate_url);
  } catch (err) { next(err); }
};
