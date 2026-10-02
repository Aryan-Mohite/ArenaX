import pool from "../config/db.js";
import { hasFeature } from "./featureService.js";

// ── SETTINGS ─────────────────────────────────────────────────────────────────
// Every tunable number lives in `coin_settings` so the economy can be retuned
// from the admin panel without a deploy. DEFAULTS are only a fallback for a
// missing row (e.g. the migration hasn't been run yet).
//
// type: "int" | "float" | "bool" | "list"
export const SETTING_SPECS = Object.freeze({
  coins_per_inr:                  { type: "int",   min: 10, max: 10000, label: "Coins per ₹1 of reward value" },
  earn_login:                     { type: "int",   min: 0,  max: 1000,  label: "Daily login" },
  earn_dailies:                   { type: "int",   min: 0,  max: 1000,  label: "Play a Dailies game" },
  earn_profile_complete:          { type: "int",   min: 0,  max: 1000,  label: "Profile completion (one-time)" },
  earn_first_game:                { type: "int",   min: 0,  max: 1000,  label: "First game in library (one-time)" },
  earn_team_join:                 { type: "int",   min: 0,  max: 1000,  label: "Join a team (one-time)" },
  earn_streak_7:                  { type: "int",   min: 0,  max: 5000,  label: "7-day login streak" },
  earn_streak_30:                 { type: "int",   min: 0,  max: 10000, label: "30-day login streak" },
  pro_multiplier:                 { type: "float", min: 1,  max: 5,     label: "ArenaX Pro multiplier" },
  pro_multiplier_reasons:         { type: "list",  allowed: ["login", "dailies", "streak_7", "streak_30", "profile_complete", "first_game", "team_join"], label: "Rewards the Pro multiplier applies to" },
  pro_bonus_monthly_cap:          { type: "int",   min: 0,  max: 100000, label: "Max extra coins per Pro user per month" },
  team_join_vest_days:            { type: "int",   min: 0,  max: 90,    label: "Days before team-join coins vest" },
  redeem_min_account_age_days:    { type: "int",   min: 0,  max: 365,   label: "Min account age to redeem (days)" },
  max_cash_redemptions_per_month: { type: "int",   min: 0,  max: 100,   label: "Gift card / top-up redemptions per user per month" },
  redemptions_enabled:            { type: "bool",  label: "Redemptions enabled" },
});

const DEFAULTS = Object.freeze({
  coins_per_inr: 100, earn_login: 5, earn_dailies: 10, earn_profile_complete: 25,
  earn_first_game: 25, earn_team_join: 50, earn_streak_7: 50, earn_streak_30: 250,
  pro_multiplier: 2, pro_multiplier_reasons: ["login", "dailies"], pro_bonus_monthly_cap: 600,
  team_join_vest_days: 7, redeem_min_account_age_days: 7, max_cash_redemptions_per_month: 2,
  redemptions_enabled: true,
});

function parseValue(key, raw) {
  const spec = SETTING_SPECS[key];
  if (!spec) return raw;
  if (spec.type === "int")   return Number.parseInt(raw, 10);
  if (spec.type === "float") return Number.parseFloat(raw);
  if (spec.type === "bool")  return raw === "1" || raw === "true";
  if (spec.type === "list")  return String(raw).split(",").map((s) => s.trim()).filter(Boolean);
  return raw;
}

// Returns a validated { value, error } for an admin-supplied update.
export function validateSetting(key, input) {
  const spec = SETTING_SPECS[key];
  if (!spec) return { error: `Unknown setting '${key}'` };

  if (spec.type === "bool") {
    const v = input === true || input === "1" || input === 1 || input === "true";
    return { value: v ? "1" : "0" };
  }
  if (spec.type === "list") {
    const arr = (Array.isArray(input) ? input : String(input).split(","))
      .map((s) => String(s).trim()).filter(Boolean);
    const bad = arr.find((s) => !spec.allowed.includes(s));
    if (bad) return { error: `'${bad}' is not allowed for ${key}` };
    return { value: arr.join(",") };
  }
  const n = spec.type === "int" ? Number.parseInt(input, 10) : Number.parseFloat(input);
  if (!Number.isFinite(n)) return { error: `${key} must be a number` };
  if (n < spec.min || n > spec.max) return { error: `${key} must be between ${spec.min} and ${spec.max}` };
  return { value: String(n) };
}

// Reads every setting in one query. Small table, so no cache  an admin edit
// takes effect on the very next request.
export async function getSettings() {
  const out = { ...DEFAULTS };
  try {
    const [rows] = await pool.query("SELECT setting_key, setting_value FROM coin_settings");
    for (const r of rows) {
      if (!SETTING_SPECS[r.setting_key]) continue;
      const parsed = parseValue(r.setting_key, r.setting_value);
      if (parsed !== undefined && !(typeof parsed === "number" && Number.isNaN(parsed))) {
        out[r.setting_key] = parsed;
      }
    }
  } catch (err) {
    console.error("[coinService] getSettings failed, using defaults:", err.message);
  }
  return out;
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);

function startDateOfStreak(streak) {
  const d = new Date(`${todayStr()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (streak - 1));
  return d.toISOString().slice(0, 10);
}

const isDuplicate = (err) => err && (err.code === "ER_DUP_ENTRY" || err.errno === 1062);

// ── AWARDING ─────────────────────────────────────────────────────────────────
// Core insert. `reason` selects the earn amount (earn_<reason>). Idempotent via
// UNIQUE (user_id, ref_key): a second call with the same refKey is a no-op.
// Returns { awarded, amount, base } where amount includes any Pro multiplier.
export async function awardCoins(userId, reason, refKey, opts = {}) {
  const { pending = false, availableAt = null, settings: given } = opts;
  const settings = given || (await getSettings());

  const base = Number(settings[`earn_${reason}`]) || 0;
  if (base <= 0) return { awarded: false, amount: 0, base: 0 };

  let amount = base;
  if (settings.pro_multiplier > 1 && settings.pro_multiplier_reasons.includes(reason)) {
    if (await hasFeature(userId, "coin_multiplier")) {
      const wantedExtra = Math.round(base * (settings.pro_multiplier - 1));
      const [[usage]] = await pool.query(
        `SELECT COALESCE(SUM(delta - base_amount), 0) AS used
           FROM coin_ledger
          WHERE user_id = ? AND status <> 'reversed' AND delta > 0
            AND base_amount IS NOT NULL AND delta > base_amount
            AND created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`,
        [userId]
      );
      const remaining = Math.max(0, settings.pro_bonus_monthly_cap - Number(usage.used));
      amount = base + Math.min(wantedExtra, remaining);
    }
  }

  try {
    await pool.query(
      `INSERT INTO coin_ledger (user_id, delta, reason, ref_key, base_amount, status, available_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, amount, reason, refKey, base, pending ? "pending" : "available", availableAt]
    );
    return { awarded: true, amount, base };
  } catch (err) {
    if (isDuplicate(err)) return { awarded: false, amount: 0, base: 0 };
    throw err;
  }
}

// Called from updateLoginStreak (login + homepage check-in). Safe to call any
// number of times a day  every key is date-scoped.
export async function awardLoginCoins(userId, currentStreak) {
  const settings = await getSettings();
  let total = 0;

  const login = await awardCoins(userId, "login", `login:${todayStr()}`, { settings });
  total += login.amount;

  // Milestones: one payout per streak, keyed by the date the streak began so a
  // broken-and-restarted streak can earn them again.
  for (const [n, reason] of [[7, "streak_7"], [30, "streak_30"]]) {
    if (currentStreak >= n) {
      const r = await awardCoins(userId, reason, `${reason}:${startDateOfStreak(currentStreak)}`, { settings });
      total += r.amount;
    }
  }
  return total;
}

// Called when a Dailies session completes. One award per day regardless of how
// many games the user plays.
export async function awardDailiesCoins(userId) {
  const r = await awardCoins(userId, "dailies", `dailies:${todayStr()}`);
  return r.amount;
}

// One-time achievements, evaluated lazily and idempotently  the same
// "compute on read, no stored flag" approach referralService.checkActivation
// uses. Call it fire-and-forget after any write that could complete one of
// them; it is also run on every balance read, so a missed hook self-heals.
export async function syncOneTimeCoins(userId) {
  const [[row]] = await pool.query(
    `SELECT
        (u.bio IS NOT NULL AND u.bio != '' AND u.profile_picture IS NOT NULL AND u.profile_picture != '') AS profile_complete,
        EXISTS(SELECT 1 FROM user_game_profile g WHERE g.user_id = u.user_id) AS has_game,
        EXISTS(SELECT 1 FROM team_members tm WHERE tm.user_id = u.user_id AND tm.status = 'active') AS on_team
       FROM users u WHERE u.user_id = ?`,
    [userId]
  );
  if (!row) return;

  const settings = await getSettings();
  if (row.profile_complete) await awardCoins(userId, "profile_complete", "profile_complete", { settings });
  if (row.has_game)         await awardCoins(userId, "first_game", "first_game", { settings });
  if (row.on_team) {
    // Pending until the user has actually stayed on the team, so joining and
    // instantly leaving can't farm the payout.
    await awardCoins(userId, "team_join", "team_join", {
      settings,
      pending: true,
      availableAt: new Date(Date.now() + settings.team_join_vest_days * 86400000),
    });
  }
}

// Vests pending rows that have matured. team_join rows are only released if
// the user is still an active member; otherwise they're reversed.
export async function settlePending(userId) {
  const [due] = await pool.query(
    `SELECT entry_id, reason FROM coin_ledger
      WHERE user_id = ? AND status = 'pending' AND available_at IS NOT NULL AND available_at <= NOW()`,
    [userId]
  );
  for (const e of due) {
    let ok = true;
    if (e.reason === "team_join") {
      const [[m]] = await pool.query(
        "SELECT COUNT(*) AS c FROM team_members WHERE user_id = ? AND status = 'active'",
        [userId]
      );
      ok = Number(m.c) > 0;
    }
    await pool.query(
      "UPDATE coin_ledger SET status = ? WHERE entry_id = ? AND status = 'pending'",
      [ok ? "available" : "reversed", e.entry_id]
    );
  }
}

// Fire-and-forget wrapper for hooks scattered through controllers. Never throws.
export function syncOneTimeCoinsSafe(userId) {
  syncOneTimeCoins(userId).catch((err) =>
    console.error("[coins] syncOneTimeCoins failed:", err.message)
  );
}

// ── BALANCE ──────────────────────────────────────────────────────────────────
export async function getBalance(userId, conn = pool) {
  const [[row]] = await conn.query(
    `SELECT
        COALESCE(SUM(CASE WHEN status = 'available' THEN delta END), 0) AS available,
        COALESCE(SUM(CASE WHEN status = 'pending'   THEN delta END), 0) AS pending
       FROM coin_ledger WHERE user_id = ?`,
    [userId]
  );
  return { available: Number(row.available), pending: Number(row.pending) };
}

// ── REWARD PRICING ───────────────────────────────────────────────────────────
// Cash-backed rewards are priced from the exchange rate; free-to-us rewards
// (Pro days) carry a fixed coin cost.
export function rewardCoinCost(reward, settings) {
  if ((reward.type === "gift_card" || reward.type === "topup") && reward.inr_value != null) {
    return Math.ceil(Number(reward.inr_value) * settings.coins_per_inr);
  }
  return Number(reward.coin_cost) || 0;
}

const isCash = (type) => type === "gift_card" || type === "topup";

export async function listCatalog() {
  const settings = await getSettings();
  const [rows] = await pool.query(
    "SELECT * FROM reward_catalog WHERE is_active = 1 ORDER BY sort_order, reward_id"
  );
  return rows.map((r) => ({
    reward_id: r.reward_id,
    reward_key: r.reward_key,
    name: r.name,
    description: r.description,
    type: r.type,
    inr_value: r.inr_value != null ? Number(r.inr_value) : null,
    pro_days: r.pro_days,
    coin_cost: rewardCoinCost(r, settings),
    in_stock: r.stock === null || r.stock > 0,
  }));
}

// ── REDEMPTION ───────────────────────────────────────────────────────────────
function fail(message, code, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

// Atomic: the users row is locked for the duration so two simultaneous
// redemptions can't both pass the balance check.
export async function redeemReward(userId, rewardId) {
  await settlePending(userId);
  const settings = await getSettings();

  if (!settings.redemptions_enabled) {
    throw fail("Redemptions are temporarily paused.", "REDEMPTIONS_DISABLED", 403);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[user]] = await conn.query(
      "SELECT user_id, email_verified, status, created_at FROM users WHERE user_id = ? FOR UPDATE",
      [userId]
    );
    if (!user || user.status !== "active") throw fail("Account not eligible.", "NOT_ELIGIBLE", 403);
    if (!user.email_verified) throw fail("Verify your email before redeeming rewards.", "EMAIL_NOT_VERIFIED", 403);

    const ageDays = (Date.now() - new Date(user.created_at).getTime()) / 86400000;
    if (ageDays < settings.redeem_min_account_age_days) {
      const wait = Math.ceil(settings.redeem_min_account_age_days - ageDays);
      throw fail(`New accounts can redeem after ${settings.redeem_min_account_age_days} days. Try again in ${wait} day(s).`, "ACCOUNT_TOO_NEW", 403);
    }

    const [[reward]] = await conn.query(
      "SELECT * FROM reward_catalog WHERE reward_id = ? AND is_active = 1 FOR UPDATE",
      [rewardId]
    );
    if (!reward) throw fail("Reward not found.", "REWARD_NOT_FOUND", 404);
    if (reward.stock !== null && reward.stock <= 0) throw fail("Out of stock.", "OUT_OF_STOCK", 409);

    if (isCash(reward.type)) {
      const [[cnt]] = await conn.query(
        `SELECT COUNT(*) AS c FROM redemptions r JOIN reward_catalog c ON c.reward_id = r.reward_id
          WHERE r.user_id = ? AND c.type IN ('gift_card','topup') AND r.status <> 'rejected'
            AND r.created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`,
        [userId]
      );
      if (Number(cnt.c) >= settings.max_cash_redemptions_per_month) {
        throw fail(`You've reached this month's limit of ${settings.max_cash_redemptions_per_month} gift card / top-up redemptions.`, "MONTHLY_LIMIT", 429);
      }
    }

    const cost = rewardCoinCost(reward, settings);
    if (cost <= 0) throw fail("This reward isn't available right now.", "REWARD_UNAVAILABLE", 409);

    const balance = await getBalance(userId, conn);
    if (balance.available < cost) {
      throw fail(`Not enough coins. You need ${cost - balance.available} more.`, "INSUFFICIENT_COINS", 402);
    }

    const autoFulfil = reward.type === "pro_days";
    const [ins] = await conn.query(
      `INSERT INTO redemptions (user_id, reward_id, coins_spent, inr_value, status)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, reward.reward_id, cost, reward.inr_value, autoFulfil ? "fulfilled" : "requested"]
    );
    const redemptionId = ins.insertId;

    await conn.query(
      `INSERT INTO coin_ledger (user_id, delta, reason, ref_key, status, note)
       VALUES (?, ?, 'redemption', ?, 'available', ?)`,
      [userId, -cost, `redeem:${redemptionId}`, reward.name.slice(0, 200)]
    );

    if (reward.stock !== null) {
      await conn.query("UPDATE reward_catalog SET stock = stock - 1 WHERE reward_id = ? AND stock > 0", [reward.reward_id]);
    }

    if (autoFulfil) await grantProDays(conn, userId, reward.pro_days);

    await conn.commit();
    return { redemption_id: redemptionId, status: autoFulfil ? "fulfilled" : "requested", coins_spent: cost };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Coin-granted Pro rides on the existing subscriptions table (gateway = 'coins')
// so hasFeature() needs no changes. Repeat redemptions extend the same row.
async function grantProDays(conn, userId, days) {
  const [[plan]] = await conn.query("SELECT plan_id FROM plans WHERE plan_key = 'gamer_pro' LIMIT 1");
  if (!plan) throw fail("Pro plan is not configured.", "PLAN_MISSING", 500);

  const [[existing]] = await conn.query(
    `SELECT subscription_id, renews_at FROM subscriptions
      WHERE user_id = ? AND plan_id = ? AND gateway = 'coins' AND status = 'active'
      ORDER BY subscription_id DESC LIMIT 1`,
    [userId, plan.plan_id]
  );

  if (existing) {
    await conn.query(
      `UPDATE subscriptions
          SET renews_at = DATE_ADD(GREATEST(COALESCE(renews_at, NOW()), NOW()), INTERVAL ? DAY)
        WHERE subscription_id = ?`,
      [days, existing.subscription_id]
    );
  } else {
    await conn.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, renews_at, gateway)
       VALUES (?, ?, 'active', DATE_ADD(NOW(), INTERVAL ? DAY), 'coins')`,
      [userId, plan.plan_id, days]
    );
  }
}

// Admin rejection: coins come back via a ledger credit (never by editing or
// deleting history), and the stock unit is returned.
export async function rejectRedemption(redemptionId, adminId, note) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[r]] = await conn.query("SELECT * FROM redemptions WHERE redemption_id = ? FOR UPDATE", [redemptionId]);
    if (!r) throw fail("Redemption not found.", "NOT_FOUND", 404);
    if (!["requested", "approved"].includes(r.status)) {
      throw fail(`Can't reject a redemption that is already ${r.status}.`, "BAD_STATE", 409);
    }

    await conn.query(
      "UPDATE redemptions SET status = 'rejected', admin_note = ?, reviewed_by = ? WHERE redemption_id = ?",
      [note || null, adminId, redemptionId]
    );
    await conn.query(
      `INSERT IGNORE INTO coin_ledger (user_id, delta, reason, ref_key, status, note)
       VALUES (?, ?, 'redemption_refund', ?, 'available', 'Redemption rejected')`,
      [r.user_id, r.coins_spent, `refund:${redemptionId}`]
    );
    await conn.query("UPDATE reward_catalog SET stock = stock + 1 WHERE reward_id = ? AND stock IS NOT NULL", [r.reward_id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
