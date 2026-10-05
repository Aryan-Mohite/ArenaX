// Operations around Arena Coins that sit next to the core economy in
// coinService.js: redemption disputes, nightly maintenance (vesting sweep,
// optional expiry, anomaly check), risk flags for the redemption queue, and the
// accounting CSV. Kept separate so coinService stays about earning/spending.
import { signalSummaryFor, purgeOldSignals } from "./signalService.js";
import pool from "../config/db.js";
import { getSettings, getBalance, settlePending, fail } from "./coinService.js";
import { sendDisputeResolvedEmail } from "../utils/mailer.js";

// ── REDEMPTION DISPUTES ──────────────────────────────────────────────────────
// Only gift cards and top-ups are manually delivered, so only they can go wrong
// (Pro days and boosts are applied instantly). A user may report a delivered
// reward that doesn't work, or a request that still hasn't arrived after 3 days.
const DISPUTABLE_TYPES = ["gift_card", "topup"];
const WAIT_HOURS = 72;

export async function openRedemptionDispute(userId, redemptionId, reason) {
  const text = String(reason || "").trim();
  if (text.length < 10 || text.length > 1000) {
    throw fail("Please describe the problem in 10 to 1000 characters.", "BAD_REASON", 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[r]] = await conn.query(
      `SELECT r.redemption_id, r.status, TIMESTAMPDIFF(HOUR, r.created_at, NOW()) AS age_hours, c.type
         FROM redemptions r JOIN reward_catalog c ON c.reward_id = r.reward_id
        WHERE r.redemption_id = ? AND r.user_id = ? FOR UPDATE`,
      [redemptionId, userId]
    );
    if (!r) throw fail("Redemption not found.", "NOT_FOUND", 404);
    if (!DISPUTABLE_TYPES.includes(r.type)) {
      throw fail("This reward is applied instantly, so there's nothing to dispute. Contact support if something looks wrong.", "NOT_DISPUTABLE", 400);
    }
    const waiting = r.status === "requested" || r.status === "approved";
    if (!(r.status === "fulfilled" || (waiting && Number(r.age_hours) >= WAIT_HOURS))) {
      throw fail(
        waiting
          ? "Requests are usually reviewed within a few days. You can report a problem if it hasn't arrived after 3 days."
          : "This redemption can't be disputed.",
        "NOT_DISPUTABLE", 409
      );
    }
    const [[open]] = await conn.query(
      "SELECT dispute_id FROM redemption_disputes WHERE redemption_id = ? AND status = 'open'",
      [redemptionId]
    );
    if (open) throw fail("You already have an open report for this reward.", "ALREADY_OPEN", 409);

    const [ins] = await conn.query(
      "INSERT INTO redemption_disputes (redemption_id, user_id, reason) VALUES (?, ?, ?)",
      [redemptionId, userId, text]
    );
    await conn.commit();
    return { dispute_id: ins.insertId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listRedemptionDisputes(status = "open") {
  const ok = ["open", "replaced", "refunded", "denied"].includes(status) ? status : "open";
  const [rows] = await pool.query(
    `SELECT d.dispute_id, d.redemption_id, d.user_id, d.reason, d.status, d.admin_note, d.created_at, d.resolved_at,
            r.status AS redemption_status, r.coins_spent, r.inr_value, r.fulfillment,
            c.name AS reward_name, u.username, u.email
       FROM redemption_disputes d
       JOIN redemptions r    ON r.redemption_id = d.redemption_id
       JOIN reward_catalog c ON c.reward_id = r.reward_id
       JOIN users u          ON u.user_id = d.user_id
      WHERE d.status = ?
      ORDER BY d.dispute_id ASC LIMIT 200`,
    [ok]
  );
  return rows;
}

// action: 'replace' (admin supplies a new code), 'refund' (coins back, request
// closed as 'refunded'), or 'deny'. Locked so two admins can't resolve the same
// report twice, and refunds are keyed so coins can never come back twice.
export async function resolveRedemptionDispute(disputeId, adminId, action, note, newFulfillment) {
  if (!["replace", "refund", "deny"].includes(action)) throw fail("Unknown action.", "BAD_ACTION", 400);
  const adminNote = String(note || "").trim().slice(0, 255);
  if (adminNote.length < 3) throw fail("A short note is required.", "NOTE_REQUIRED", 400);
  const code = String(newFulfillment || "").trim();
  if (action === "replace" && !code) throw fail("Enter the replacement code.", "CODE_REQUIRED", 400);

  const conn = await pool.getConnection();
  let mail = null;
  try {
    await conn.beginTransaction();
    const [[d]] = await conn.query(
      `SELECT d.dispute_id, d.status AS dispute_status, d.user_id, d.redemption_id,
              r.status AS r_status, r.coins_spent, c.name AS reward_name, u.email
         FROM redemption_disputes d
         JOIN redemptions r    ON r.redemption_id = d.redemption_id
         JOIN reward_catalog c ON c.reward_id = r.reward_id
         JOIN users u          ON u.user_id = d.user_id
        WHERE d.dispute_id = ? FOR UPDATE`,
      [disputeId]
    );
    if (!d) throw fail("Dispute not found.", "NOT_FOUND", 404);
    if (d.dispute_status !== "open") throw fail("This report was already resolved.", "BAD_STATE", 409);

    let outcome;
    if (action === "replace") {
      await conn.query(
        "UPDATE redemptions SET fulfillment = ?, status = 'fulfilled', reviewed_by = ?, admin_note = ? WHERE redemption_id = ?",
        [code, adminId, adminNote, d.redemption_id]
      );
      outcome = "replaced";
    } else if (action === "refund") {
      if (["rejected", "refunded"].includes(d.r_status)) throw fail("Those coins were already returned.", "ALREADY_REFUNDED", 409);
      await conn.query(
        `INSERT IGNORE INTO coin_ledger (user_id, delta, reason, ref_key, status, note)
         VALUES (?, ?, 'redemption_refund', ?, 'available', 'Dispute refund')`,
        [d.user_id, d.coins_spent, `dispute_refund:${d.redemption_id}`]
      );
      await conn.query(
        "UPDATE redemptions SET status = 'refunded', reviewed_by = ?, admin_note = ? WHERE redemption_id = ?",
        [adminId, adminNote, d.redemption_id]
      );
      outcome = "refunded";
    } else {
      outcome = "denied";
    }
    await conn.query(
      "UPDATE redemption_disputes SET status = ?, admin_note = ?, resolved_by = ?, resolved_at = NOW() WHERE dispute_id = ?",
      [outcome, adminNote, adminId, disputeId]
    );
    await conn.commit();
    mail = { to: d.email, rewardName: d.reward_name, action, note: adminNote };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  // Fire-and-forget: a missing SMTP config must never fail the admin action.
  sendDisputeResolvedEmail(mail.to, mail).catch((e) => console.error("[coins] dispute email failed:", e.message));
  return { status: action === "replace" ? "replaced" : action === "refund" ? "refunded" : "denied" };
}

// ── NIGHTLY MAINTENANCE ──────────────────────────────────────────────────────
// Vests (or reverses) every pending coin that is due, so it happens even for
// users who never open the app, and expires old coins when an admin enables it.
export async function settleAllDuePending(limit = 1000) {
  const [rows] = await pool.query(
    `SELECT DISTINCT user_id FROM coin_ledger
      WHERE status = 'pending' AND available_at IS NOT NULL AND available_at <= NOW() LIMIT ?`,
    [limit]
  );
  for (const r of rows) await settlePending(r.user_id);
  return rows.length;
}

// Coin expiry (off unless coin_expiry_days > 0). First-in-first-out: coins you
// spent are assumed to be your oldest, so only what is left of the coins earned
// before the cutoff expires. Refunded coins count as new (conservative).
// Idempotent per day (ref_key expiry:YYYY-MM-DD); the user row is locked so an
// expiry can't race a redemption into a negative balance.
export async function expireOldCoins() {
  const settings = await getSettings();
  const days = Number(settings.coin_expiry_days) || 0;
  if (days <= 0) return { expired_users: 0, expired_coins: 0 };

  const [candidates] = await pool.query(
    `SELECT DISTINCT user_id FROM coin_ledger
      WHERE delta > 0 AND status = 'available' AND reason <> 'redemption_refund'
        AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [days]
  );
  const day = new Date().toISOString().slice(0, 10);
  let expiredUsers = 0;
  let expiredCoins = 0;

  for (const { user_id: userId } of candidates) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("SELECT user_id FROM users WHERE user_id = ? FOR UPDATE", [userId]);
      const [[old]] = await conn.query(
        `SELECT COALESCE(SUM(delta), 0) AS earned FROM coin_ledger
          WHERE user_id = ? AND delta > 0 AND status = 'available' AND reason <> 'redemption_refund'
            AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [userId, days]
      );
      const [[neg]] = await conn.query(
        "SELECT COALESCE(SUM(delta), 0) AS spent FROM coin_ledger WHERE user_id = ? AND status = 'available' AND delta < 0",
        [userId]
      );
      const { available } = await getBalance(userId, conn);
      const amount = Math.min(Math.max(0, Number(old.earned) + Number(neg.spent)), available);
      if (amount > 0) {
        const [ins] = await conn.query(
          `INSERT IGNORE INTO coin_ledger (user_id, delta, reason, ref_key, status, note)
           VALUES (?, ?, 'expiry', ?, 'available', ?)`,
          [userId, -amount, `expiry:${day}`, `Expired after ${days} days`]
        );
        if (ins.affectedRows > 0) { expiredUsers += 1; expiredCoins += amount; }
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      console.error("[coins] expiry failed for user", userId, err.message);
    } finally {
      conn.release();
    }
  }
  return { expired_users: expiredUsers, expired_coins: expiredCoins };
}

// ── ANOMALY CHECK ────────────────────────────────────────────────────────────
// Things that should never happen. Nothing here is fixed automatically; it is a
// tripwire for the nightly job and the admin stats panel.
export async function findCoinAnomalies() {
  const [negative] = await pool.query(
    "SELECT user_id, SUM(delta) AS balance FROM coin_ledger WHERE status = 'available' GROUP BY user_id HAVING balance < 0 LIMIT 20"
  );
  const [missingDebit] = await pool.query(
    `SELECT r.redemption_id FROM redemptions r
      WHERE NOT EXISTS (SELECT 1 FROM coin_ledger l WHERE l.user_id = r.user_id AND l.ref_key = CONCAT('redeem:', r.redemption_id))
      LIMIT 20`
  );
  const [missingRefund] = await pool.query(
    `SELECT r.redemption_id FROM redemptions r
      WHERE (r.status = 'rejected' AND NOT EXISTS (SELECT 1 FROM coin_ledger l WHERE l.user_id = r.user_id AND l.ref_key = CONCAT('refund:', r.redemption_id)))
         OR (r.status = 'refunded' AND NOT EXISTS (SELECT 1 FROM coin_ledger l WHERE l.user_id = r.user_id AND l.ref_key = CONCAT('dispute_refund:', r.redemption_id)))
      LIMIT 20`
  );
  const [[overdue]] = await pool.query(
    "SELECT COUNT(*) AS n FROM coin_ledger WHERE status = 'pending' AND available_at IS NOT NULL AND available_at < DATE_SUB(NOW(), INTERVAL 2 DAY)"
  );
  const [emptyCodes] = await pool.query(
    `SELECT r.redemption_id FROM redemptions r JOIN reward_catalog c ON c.reward_id = r.reward_id
      WHERE r.status = 'fulfilled' AND c.type IN ('gift_card','topup') AND (r.fulfillment IS NULL OR r.fulfillment = '') LIMIT 20`
  );
  const result = {
    negative_balances: negative.map((n) => ({ user_id: n.user_id, balance: Number(n.balance) })),
    missing_debits: missingDebit.map((r) => r.redemption_id),
    missing_refunds: missingRefund.map((r) => r.redemption_id),
    overdue_pending: Number(overdue.n),
    empty_codes: emptyCodes.map((r) => r.redemption_id),
  };
  result.total =
    result.negative_balances.length + result.missing_debits.length + result.missing_refunds.length +
    result.overdue_pending + result.empty_codes.length;
  return result;
}

export async function runCoinMaintenance() {
  const settled = await settleAllDuePending();
  try {
    const keep = Number((await getSettings()).signal_retention_days) || 90;
    await purgeOldSignals(keep);
  } catch (e) { console.error("[signals] purge failed:", e.message); }
  const expiry = await expireOldCoins();
  const anomalies = await findCoinAnomalies();
  if (anomalies.total > 0) console.error("[coins] ANOMALIES FOUND:", JSON.stringify(anomalies));
  return { settled_users: settled, ...expiry, anomalies_total: anomalies.total };
}

// ── RISK FLAGS (redemption queue) ────────────────────────────────────────────
// Cheap heuristics that tell an admin which requests deserve a closer look
// before a gift card is sent. They never block anything by themselves.
export async function riskFlagsFor(rows, settings) {
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (ids.length === 0) return new Map();

  const [earned] = await pool.query(
    `SELECT user_id, COALESCE(SUM(delta), 0) AS coins FROM coin_ledger
      WHERE user_id IN (?) AND delta > 0 AND status <> 'reversed'
        AND reason NOT IN ('redemption_refund', 'admin_adjust', 'referral')
        AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY user_id`, [ids]
  );
  const [referrals] = await pool.query(
    `SELECT user_id, COUNT(*) AS n FROM coin_ledger
      WHERE user_id IN (?) AND reason = 'referral' AND status <> 'reversed' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY user_id`, [ids]
  );
  const [cash] = await pool.query(
    `SELECT r.user_id, COUNT(*) AS n FROM redemptions r JOIN reward_catalog c ON c.reward_id = r.reward_id
      WHERE r.user_id IN (?) AND c.type IN ('gift_card','topup') AND r.status NOT IN ('rejected','refunded')
        AND r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY r.user_id`, [ids]
  );
  const [grants] = await pool.query(
    `SELECT user_id, COALESCE(SUM(delta), 0) AS coins FROM coin_ledger
      WHERE user_id IN (?) AND reason = 'admin_adjust' AND delta > 0 AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY user_id`, [ids]
  );
  const by = (list, key) => new Map(list.map((x) => [x.user_id, Number(x[key])]));
  const earnedBy = by(earned, "coins"), refBy = by(referrals, "n"), cashBy = by(cash, "n"), grantBy = by(grants, "coins");

  // What a very active honest player could earn in 7 days, doubled for slack.
  const s = settings;
  const allowance = 2 * ((Number(s.earn_login) + Number(s.earn_dailies)) * 7 +
    Number(s.earn_streak_7) + Number(s.earn_profile_complete) + Number(s.earn_first_game) + Number(s.earn_team_join));

  const signals = await signalSummaryFor(ids);
  const out = new Map();
  for (const r of rows) {
    const flags = [];
    const ageDays = r.user_since ? (Date.now() - new Date(r.user_since).getTime()) / 86400000 : null;
    const e7 = earnedBy.get(r.user_id) || 0;
    if (ageDays !== null && ageDays < 14) flags.push("new_account");
    if (e7 > allowance) flags.push("high_earn_rate");
    if ((refBy.get(r.user_id) || 0) >= 5) flags.push("referral_heavy");
    if ((cashBy.get(r.user_id) || 0) >= 2) flags.push("repeat_redeemer");
    if ((grantBy.get(r.user_id) || 0) > 0) flags.push("admin_grants");
    const sig = signals.get(r.user_id) || { shared_device: 0, ip_signups: 0 };
    if (sig.shared_device > 0) flags.push("shared_device");
    if (sig.ip_signups >= 3) flags.push("shared_signup_ip");
    out.set(r.user_id, { flags, earned_7d: e7, linked_devices: sig.shared_device, ip_signups: sig.ip_signups });
  }
  return out;
}

// ── ACCOUNTING CSV ───────────────────────────────────────────────────────────
// Gift card codes are deliberately NOT exported (they are secrets); the sheet
// only says whether a code was delivered. Cells that start with = + - @ are
// prefixed with an apostrophe so a malicious username can't run as a formula in
// Excel / Sheets.
const csvCell = (v) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function buildRedemptionsCsv({ status, from, to } = {}) {
  const where = [];
  const params = [];
  if (["requested", "approved", "fulfilled", "rejected", "refunded"].includes(status)) { where.push("r.status = ?"); params.push(status); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(from || "")) { where.push("r.created_at >= ?"); params.push(`${from} 00:00:00`); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to || "")) { where.push("r.created_at < DATE_ADD(?, INTERVAL 1 DAY)"); params.push(to); }

  const [rows] = await pool.query(
    `SELECT r.redemption_id, r.created_at, u.username, u.email, c.name AS reward, c.type,
            r.coins_spent, r.inr_value, r.status, r.admin_note,
            (r.fulfillment IS NOT NULL AND r.fulfillment <> '') AS code_delivered
       FROM redemptions r
       JOIN reward_catalog c ON c.reward_id = r.reward_id
       JOIN users u ON u.user_id = r.user_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY r.redemption_id ASC LIMIT 20000`,
    params
  );
  const header = ["redemption_id", "date", "username", "email", "reward", "type", "coins_spent", "inr_value", "status", "code_delivered", "admin_note"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      r.redemption_id, new Date(r.created_at).toISOString().slice(0, 19).replace("T", " "), r.username, r.email,
      r.reward, r.type, r.coins_spent, r.inr_value ?? "", r.status, Number(r.code_delivered) ? "yes" : "no", r.admin_note || "",
    ].map(csvCell).join(","));
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n"; // BOM so Excel reads UTF-8 correctly
}
