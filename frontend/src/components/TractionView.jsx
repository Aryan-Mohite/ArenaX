// Read-only traction dashboard. Used by the public investor page (/investors/:token)
// and by the admin preview, so both always show exactly the same thing.
// Props: snapshot (from /api/traction/:token or /api/admin/traction).

const nf = (n) => (n == null ? "–" : Number(n).toLocaleString("en-IN"));
const pct = (r, digits = 0) => (r == null ? "–" : `${(r * 100).toFixed(digits)}%`);
const inr = (n) => (n == null ? "–" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);

function Stat({ label, value, sub, tone }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`font-display font-bold text-3xl mt-1 ${tone || "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <section className="mb-10">
      <h2 className="font-display font-bold text-xl text-white mb-1">{title}</h2>
      {note && <p className="text-sm text-gray-500 mb-4">{note}</p>}
      {!note && <div className="mb-4" />}
      {children}
    </section>
  );
}

function growthLabel(g) {
  if (g == null) return "no earlier period to compare";
  const sign = g > 0 ? "+" : "";
  return `${sign}${(g * 100).toFixed(0)}% vs previous period`;
}

// Two-line SVG chart (new signups and daily active users). No chart library.
function TrendChart({ trend }) {
  const W = 640, H = 170, P = { l: 34, r: 8, t: 10, b: 22 };
  const max = Math.max(1, ...trend.map((d) => Math.max(d.signups, d.active)));
  const x = (i) => P.l + (i * (W - P.l - P.r)) / Math.max(1, trend.length - 1);
  const y = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
  const path = (key) => trend.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const ticks = [0, Math.round(max / 2), max];
  const labelIdx = [0, Math.floor(trend.length / 2), trend.length - 1];
  return (
    <div className="card">
      <div className="flex gap-4 text-xs text-gray-400 mb-2">
        <span><span className="inline-block w-3 h-0.5 align-middle mr-1" style={{ background: "#ff4655" }} />Daily active users</span>
        <span><span className="inline-block w-3 h-0.5 align-middle mr-1" style={{ background: "#4cc9f0" }} />New signups</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Daily active users and new signups, last 60 days">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6b7280">{t}</text>
          </g>
        ))}
        <path d={path("active")} fill="none" stroke="#ff4655" strokeWidth="2" />
        <path d={path("signups")} fill="none" stroke="#4cc9f0" strokeWidth="2" />
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === trend.length - 1 ? "end" : "middle"} fontSize="10" fill="#6b7280">
            {trend[i]?.day.slice(5)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function FunnelBars({ funnel }) {
  const steps = [
    ["Signed up", funnel.signups],
    ["Completed profile", funnel.profile_complete],
    ["Joined a team", funnel.on_team],
    ["Entered a tournament", funnel.entered_tournament],
  ];
  const base = Math.max(1, funnel.signups);
  return (
    <div className="card space-y-3">
      {steps.map(([label, n], i) => (
        <div key={label}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-300">{label}</span>
            <span className="text-white">{nf(n)} <span className="text-gray-500">({pct(n / base)})</span></span>
          </div>
          <div className="h-2 rounded bg-white/5 overflow-hidden">
            <div className="h-2 rounded" style={{ width: `${Math.min(100, (n / base) * 100)}%`, background: i === 0 ? "#6b7280" : "#ff4655" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RetentionCard({ title, r }) {
  return (
    <Stat
      label={title}
      value={pct(r.rate, 1)}
      sub={r.size ? `${nf(r.retained)} of ${nf(r.size)} users came back` : "not enough history yet"}
    />
  );
}

export default function TractionView({ snapshot: s }) {
  if (!s) return null;
  const h = s.headline;
  const small = h.mau < 100;
  const t = s.tournaments;
  const a = t.attendance;
  const c = s.coins;

  return (
    <div>
      {small && (
        <div className="card border border-yellow-500/30 text-sm text-yellow-200 mb-8">
          Early-stage numbers. The sample is small ({nf(h.mau)} monthly active users), so percentages can move a lot from one week to the next.
          We show the raw counts next to every rate so you can judge for yourself.
        </div>
      )}

      <Section title="Users" note={`${nf(h.total_users)} registered users. Activity is measured by logins.`}>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <Stat label="Monthly active" value={nf(h.mau)} sub="logged in, last 30 days" />
          <Stat label="Weekly active" value={nf(h.wau)} sub="last 7 days" />
          <Stat label="Daily active" value={nf(h.dau)} sub="last 24 hours" />
          <Stat label="Stickiness" value={pct(h.stickiness)} sub="daily ÷ monthly active" />
          <Stat label="New users, 30 days" value={nf(h.new_users_30d)} sub={growthLabel(h.growth_30d)} />
          <Stat label="New users, 7 days" value={nf(h.new_users_7d)} sub={growthLabel(h.growth_7d)} />
        </div>
        <TrendChart trend={s.trend} />
      </Section>

      <Section title="Do people come back?" note="Share of users who logged in exactly 7 (or 30) days after signing up. A strict measure.">
        <div className="grid grid-cols-2 gap-3">
          <RetentionCard title="Day-7 return" r={s.retention.d7} />
          <RetentionCard title="Day-30 return" r={s.retention.d30} />
        </div>
      </Section>

      <Section title="From signup to competing" note="How far new users go.">
        <FunnelBars funnel={s.funnel} />
      </Section>

      <Section title="Tournaments and organizers" note="Tournaments hosted on ArenaX. Imported professional events are not counted.">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Hosted" value={nf(t.hosted)} sub={`${nf(t.hosted_30d)} created in 30 days`} />
          <Stat label="With teams signed up" value={nf(t.with_teams)} sub="at least one registered team" />
          <Stat label="Completed" value={nf(t.completed)} />
          <Stat label="Organizers" value={nf(t.organizers)} sub={t.organizers ? `${pct(t.returning_rate)} ran events in 2+ months` : "players who host events"} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          {a.tournaments_tracked > 0 ? (
            <>
              <Stat label="Team check-in rate" value={pct(a.checked_in_rate)} sub={`of ${nf(a.registrations)} registered teams, ${nf(a.tournaments_tracked)} tournaments with check-in`} />
              <Stat label="No-show rate" value={pct(a.no_show_rate)} sub="teams marked absent at finalize" />
            </>
          ) : (
            <div className="card col-span-2 text-sm text-gray-500">Attendance tracking is live; no tournament has completed check-in yet, so there is no data to show.</div>
          )}
        </div>
      </Section>

      <Section title="Arena Coins (loyalty economy)" note="Players earn coins for real activity and redeem them for rewards. Last 30 days.">
        {!c ? (
          <div className="card text-sm text-gray-500">Not launched yet, so there are no coin metrics to show.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Stat label="Players earning coins" value={pct(c.earner_share)} sub={`${nf(c.earners)} of ${nf(c.active_users)} active users`} />
              <Stat label="Redemption rate" value={pct(c.redemption_rate)} sub="earners who redeemed" />
              <Stat label="Cash cost per active user" value={inr(c.cash_cost_per_active_user_inr)} sub={`${inr(c.cash_cost_inr)} of gift cards and top-ups fulfilled`} />
              <Stat label="Coins issued" value={nf(c.issued)} sub={`${nf(c.spent)} spent`} />
              <Stat label="Outstanding liability" value={inr(c.outstanding_value_inr)} sub={`${nf(c.outstanding_coins)} unspent coins at ${c.coins_per_inr} coins = ₹1`} />
            </div>
            {c.retention?.d7 && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                {["d7", "d30"].map((k) => {
                  const r = c.retention[k];
                  if (!r) return null;
                  return (
                    <div key={k} className="card text-sm">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Day-{k.slice(1)} return: engaged with coins vs others</p>
                      <p className="text-gray-300">Engaged: <span className="text-white font-semibold">{pct(r.engaged.rate, 1)}</span> <span className="text-gray-500">({nf(r.engaged.retained)} of {nf(r.engaged.size)})</span></p>
                      <p className="text-gray-300">Others: <span className="text-white font-semibold">{pct(r.other.rate, 1)}</span> <span className="text-gray-500">({nf(r.other.retained)} of {nf(r.other.size)})</span></p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="Revenue" note="Paid subscriptions only. Pro time earned with coins is not counted.">
        {s.revenue.paying_subscriptions === 0 ? (
          <div className="card text-sm text-gray-500">No paying subscriptions yet. Payments are built and live; we are pre-revenue.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Monthly recurring revenue" value={inr(s.revenue.mrr_inr)} />
            <Stat label="Paying subscriptions" value={nf(s.revenue.paying_subscriptions)} sub={s.revenue.by_plan.map((p) => `${p.plan}: ${p.subs}`).join(" · ")} />
          </div>
        )}
      </Section>

      <Section title="How these numbers are defined">
        <ul className="card text-sm text-gray-400 space-y-2 list-disc pl-6">
          {s.definitions.map((d) => <li key={d}>{d}</li>)}
        </ul>
      </Section>
    </div>
  );
}
