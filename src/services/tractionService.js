import pool from "../config/db.js";
import { getCoinAnalytics } from "../controllers/adminCoinController.js";

// Investor-facing traction snapshot. AGGREGATES ONLY: no usernames, emails or
// per-user rows ever leave this file. Definitions are deliberately conservative:
//   - "hosted on ArenaX" tournaments exclude imported pro events (source = 'pandascore')
//   - revenue excludes Pro granted through coin redemption (gateway = 'coins')
//   - retention counts a user only if they logged in EXACTLY on day 7 / day 30
//     after signup (stricter than "any time within 7 days")
//   - banned accounts are excluded from every user count
const HOSTED = "t.source IN ('user', 'admin') AND t.status NOT IN ('cancelled', 'pending_review')";
const num = (v) => Number(v) || 0;
const ratio = (a, b) => (num(b) > 0 ? Number((num(a) / num(b)).toFixed(4)) : null);
const growth = (cur, prev) => (num(prev) > 0 ? Number(((num(cur) - num(prev)) / num(prev)).toFixed(3)) : null);

async function one(sql, params = []) {
  const [[row]] = await pool.query(sql, params);
  return row;
}

// Re-uses the admin coin analytics so investors see EXACTLY the admin's numbers.
function runHandler(handler, query) {
  return new Promise((resolve, reject) => {
    const res = { json: resolve, status() { return res; } };
    Promise.resolve(handler({ query }, res, reject)).catch(reject);
  });
}

async function retention(n) {
  const r = await one(
    `SELECT COUNT(*) AS size, COALESCE(SUM(x.retained), 0) AS retained FROM (
        SELECT EXISTS (SELECT 1 FROM events e
                        WHERE e.user_id = u.user_id AND e.event_type = 'login'
                          AND DATE(e.created_at) = DATE_ADD(DATE(u.created_at), INTERVAL ? DAY)) AS retained
          FROM users u
         WHERE u.status = 'active'
           AND u.created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
           AND u.created_at >= DATE_SUB(NOW(), INTERVAL 120 DAY)
     ) x`,
    [n, n + 1]
  );
  return { size: num(r.size), retained: num(r.retained), rate: ratio(r.retained, r.size) };
}

export async function buildTractionSnapshot() {
  const active = (sql) => one(sql);
  const [
    totals, au, signups, tournaments, funnel, orgs, attendance, subs, trendUsers, trendActive, ret7, ret30, coinRes,
  ] = await Promise.all([
    active("SELECT COUNT(*) AS total FROM users WHERE status = 'active'"),
    active(`SELECT
        COUNT(DISTINCT CASE WHEN e.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)  THEN e.user_id END) AS dau,
        COUNT(DISTINCT CASE WHEN e.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)  THEN e.user_id END) AS wau,
        COUNT(DISTINCT e.user_id) AS mau
       FROM events e JOIN users u ON u.user_id = e.user_id AND u.status = 'active'
      WHERE e.event_type = 'login' AND e.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`),
    active(`SELECT
        SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))  AS d7,
        SUM(created_at <  DATE_SUB(NOW(), INTERVAL 7 DAY)  AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)) AS p7,
        SUM(created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS d30,
        SUM(created_at <  DATE_SUB(NOW(), INTERVAL 30 DAY) AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)) AS p30
       FROM users WHERE status = 'active'`),
    active(`SELECT COUNT(*) AS hosted,
        SUM(t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS hosted_30d,
        SUM(t.status = 'completed') AS completed,
        SUM(EXISTS (SELECT 1 FROM tournament_registrations r WHERE r.tournament_id = t.tournament_id)) AS with_teams
       FROM tournaments t WHERE ${HOSTED}`),
    active(`SELECT
        (SELECT COUNT(*) FROM users WHERE status = 'active') AS signups,
        (SELECT COUNT(*) FROM users WHERE status = 'active' AND bio IS NOT NULL AND bio <> '' AND profile_picture IS NOT NULL AND profile_picture <> '') AS profile_complete,
        (SELECT COUNT(DISTINCT tm.user_id) FROM team_members tm JOIN users u ON u.user_id = tm.user_id AND u.status = 'active' WHERE tm.status = 'active') AS on_team,
        (SELECT COUNT(DISTINCT tm.user_id) FROM team_members tm
           JOIN users u ON u.user_id = tm.user_id AND u.status = 'active'
           JOIN tournament_registrations tr ON tr.team_id = tm.team_id
           JOIN tournaments t ON t.tournament_id = tr.tournament_id
          WHERE tm.status = 'active' AND ${HOSTED}) AS entered_tournament`),
    active(`SELECT COUNT(*) AS organizers, SUM(months > 1) AS repeat_orgs FROM (
          SELECT t.created_by, COUNT(DISTINCT DATE_FORMAT(t.created_at, '%Y-%m')) AS months
            FROM tournaments t WHERE t.source = 'user' AND t.created_by IS NOT NULL AND t.status <> 'pending_review'
           GROUP BY t.created_by) s`),
    active(`SELECT
        COUNT(DISTINCT tr.tournament_id) AS tournaments_with_checkin,
        COUNT(*) AS registrations,
        SUM(tr.checked_in_at IS NOT NULL) AS checked_in,
        SUM(tr.status = 'no_show') AS no_show
       FROM tournament_registrations tr
       JOIN tournaments t ON t.tournament_id = tr.tournament_id AND ${HOSTED}
      WHERE tr.tournament_id IN (
              SELECT tournament_id FROM tournament_registrations WHERE checked_in_at IS NOT NULL OR status = 'no_show')`),
    pool.query(`SELECT p.name AS plan, COUNT(*) AS subs,
                       COALESCE(SUM(CASE WHEN p.billing_cycle = 'annual' THEN p.price / 12 ELSE p.price END), 0) AS mrr
                  FROM subscriptions s JOIN plans p ON p.plan_id = s.plan_id
                 WHERE s.status = 'active' AND COALESCE(s.gateway, '') <> 'coins'
                   AND (s.renews_at IS NULL OR s.renews_at >= NOW())
                 GROUP BY p.plan_id, p.name ORDER BY mrr DESC`).then((r) => r[0]),
    pool.query(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS n FROM users
                 WHERE status = 'active' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 59 DAY) GROUP BY day`).then((r) => r[0]),
    pool.query(`SELECT DATE_FORMAT(e.created_at, '%Y-%m-%d') AS day, COUNT(DISTINCT e.user_id) AS n
                  FROM events e JOIN users u ON u.user_id = e.user_id AND u.status = 'active'
                 WHERE e.event_type = 'login' AND e.created_at >= DATE_SUB(CURDATE(), INTERVAL 59 DAY) GROUP BY day`).then((r) => r[0]),
    retention(7),
    retention(30),
    runHandler(getCoinAnalytics, { days: 30 }).catch(() => null),
  ]);
  const [[{ today }]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today");

  // zero-filled 60-day trend
  const su = new Map(trendUsers.map((r) => [r.day, num(r.n)]));
  const ac = new Map(trendActive.map((r) => [r.day, num(r.n)]));
  const trend = [];
  const end = new Date(`${today}T00:00:00Z`);
  for (let i = 59; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86400000).toISOString().slice(0, 10);
    trend.push({ day: d, signups: su.get(d) || 0, active: ac.get(d) || 0 });
  }

  // coins (only if the economy has actually run)
  let coins = null;
  if (coinRes && coinRes.summary && num(coinRes.summary.issued) > 0) {
    const s = coinRes.summary;
    const cpi = num(coinRes.coins_per_inr) || 100;
    coins = {
      window_days: 30,
      issued: num(s.issued),
      spent: num(s.spent),
      earners: num(s.earners),
      active_users: num(s.active_users),
      earner_share: ratio(s.earners, s.active_users),
      redemption_rate: s.redemption_rate ?? null,
      cash_cost_inr: num(s.cash_cost_inr),
      cash_cost_per_active_user_inr: s.cash_cost_per_active_user_inr ?? null,
      outstanding_coins: num(s.outstanding),
      outstanding_value_inr: Number((num(s.outstanding) / cpi).toFixed(2)),
      coins_per_inr: cpi,
      retention: coinRes.retention || null, // engaged vs other, D7/D30 (with sample sizes)
    };
  }

  const mrr = subs.reduce((a, r) => a + num(r.mrr), 0);
  const mau = num(au.mau), dau = num(au.dau);
  const hosted = num(tournaments.hosted);

  return {
    generated_at: new Date().toISOString(),
    headline: {
      total_users: num(totals.total),
      mau, wau: num(au.wau), dau,
      stickiness: ratio(dau, mau),
      new_users_7d: num(signups.d7), new_users_prev_7d: num(signups.p7),
      new_users_30d: num(signups.d30), new_users_prev_30d: num(signups.p30),
      growth_7d: growth(signups.d7, signups.p7),
      growth_30d: growth(signups.d30, signups.p30),
    },
    trend,
    retention: { d7: await ret7, d30: await ret30 },
    funnel: {
      signups: num(funnel.signups), profile_complete: num(funnel.profile_complete),
      on_team: num(funnel.on_team), entered_tournament: num(funnel.entered_tournament),
    },
    tournaments: {
      hosted, hosted_30d: num(tournaments.hosted_30d), completed: num(tournaments.completed),
      with_teams: num(tournaments.with_teams),
      organizers: num(orgs.organizers), returning_organizers: num(orgs.repeat_orgs),
      returning_rate: ratio(orgs.repeat_orgs, orgs.organizers),
      attendance: {
        tournaments_tracked: num(attendance.tournaments_with_checkin),
        registrations: num(attendance.registrations),
        checked_in_rate: ratio(attendance.checked_in, attendance.registrations),
        no_show_rate: ratio(attendance.no_show, attendance.registrations),
      },
    },
    coins,
    revenue: { paying_subscriptions: subs.reduce((a, r) => a + num(r.subs), 0), mrr_inr: Number(mrr.toFixed(2)), by_plan: subs.map((r) => ({ plan: r.plan, subs: num(r.subs), mrr_inr: Number(num(r.mrr).toFixed(2)) })) },
    definitions: [
      "Active users = accounts that are not banned. MAU/WAU/DAU = distinct users with a login event in the last 30/7/1 days.",
      "Day-7 / Day-30 return rate = share of users (signed up in the last 120 days, old enough to measure) who logged in exactly 7 / 30 days after signup. This is stricter than 'any visit within a week'.",
      "Tournaments hosted = tournaments created on ArenaX by organizers or admins. Imported professional events are excluded. Admin-created tournaments are included, so 'with registered teams' is shown too.",
      "Attendance is measured only for tournaments where the organizer ran check-in. Check-in rate and no-show rate = share of registered teams in those tournaments.",
      "Revenue counts paid subscriptions only. Pro time redeemed with Arena Coins is not revenue and is excluded.",
      "Coin figures cover the last 30 days. Cash cost = gift cards and top-ups actually fulfilled.",
    ],
  };
}

let cache = { at: 0, data: null };
export async function getTractionSnapshot({ fresh = false } = {}) {
  if (!fresh && cache.data && Date.now() - cache.at < 5 * 60 * 1000) return cache.data;
  const data = await buildTractionSnapshot();
  cache = { at: Date.now(), data };
  return data;
}
export const _clearTractionCache = () => { cache = { at: 0, data: null }; };
