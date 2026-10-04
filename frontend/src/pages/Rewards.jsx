import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { getMyCoins, getCoinLedger, redeemReward, getMyRedemptions, disputeRedemption } from "../services/coinService";
import { PageLoader, ErrorMessage } from "../components/UI";
import SEO from "../components/SEO";

const RUPEE = "\u20b9";

const REASON_LABELS = {
  login: "Daily login",
  dailies: "Dailies game",
  profile_complete: "Profile completed",
  first_game: "First game added",
  team_join: "Joined a team",
  streak_7: "7-day streak bonus",
  streak_30: "30-day streak bonus",
  redemption: "Redeemed reward",
  redemption_refund: "Redemption refunded",
  admin_adjust: "Adjustment",
  ban_reversal: "Balance removed",
};

const DISPUTE_LABEL = {
  open: "Report sent: under review",
  replaced: "Report resolved: a new code was issued",
  refunded: "Report resolved: your coins were refunded",
  denied: "Report reviewed: no problem found",
};

// Gift cards and top-ups are the only manually delivered rewards, so only they
// can be reported: once delivered, or when a request is still waiting after 3 days.
const canReport = (r) =>
  (r.type === "gift_card" || r.type === "topup") &&
  r.dispute_status !== "open" &&
  (r.status === "fulfilled" || ((r.status === "requested" || r.status === "approved") && Number(r.age_hours) >= 72));

const STATUS_STYLE = {
  requested: { bg: "rgba(234,179,8,0.15)", fg: "#eab308", label: "Pending review" },
  approved:  { bg: "rgba(59,130,246,0.15)", fg: "#3b82f6", label: "Approved" },
  fulfilled: { bg: "rgba(34,197,94,0.15)", fg: "#22c55e", label: "Delivered" },
  rejected:  { bg: "rgba(239,68,68,0.15)", fg: "#ef4444", label: "Rejected \u2014 coins refunded" },
  refunded:  { bg: "rgba(59,130,246,0.15)", fg: "#3b82f6", label: "Refunded" },
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const fmtCoins = (n) => Number(n).toLocaleString("en-IN");

function RewardCard({ reward, balance, canRedeem, busy, onRedeem }) {
  const short = reward.coin_cost - balance;
  const affordable = short <= 0;
  const pct = Math.min(100, Math.round((balance / reward.coin_cost) * 100));
  const disabled = busy || !reward.in_stock || !affordable || !canRedeem;

  return (
    <div className="card flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-display font-bold text-white">{reward.name}</h3>
        {(reward.type === "pro_days" || reward.type === "tf_boost") && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,70,85,0.15)", color: "#ff4655" }}>
            INSTANT
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3 flex-1">{reward.description}</p>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-white font-semibold">{fmtCoins(reward.coin_cost)} coins</span>
          <span className="text-gray-500">{affordable ? "Ready to redeem" : `${fmtCoins(short)} to go`}</span>
        </div>
        <div className="h-1.5 rounded-full bg-navy overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: affordable ? "#22c55e" : "#ff4655" }} />
        </div>
      </div>

      <button className="btn-primary text-sm" disabled={disabled} onClick={() => onRedeem(reward)}>
        {!reward.in_stock ? "Out of stock" : busy ? "Redeeming\u2026" : "Redeem"}
      </button>
    </div>
  );
}

export default function Rewards() {
  const [data, setData] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("activity");
  const [reportFor, setReportFor] = useState(null);
  const [reportText, setReportText] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(() => {
    return Promise.all([getMyCoins(), getCoinLedger({ limit: 30 }), getMyRedemptions()])
      .then(([c, l, r]) => {
        setData(c.data);
        setLedger(l.data.entries || []);
        setRedemptions(r.data.redemptions || []);
      })
      .catch(() => setError("Couldn't load your coins"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRedeem = async (reward) => {
    const instant = reward.type === "pro_days" || reward.type === "tf_boost";
    const msg =
      instant
        ? `Spend ${fmtCoins(reward.coin_cost)} coins on ${reward.name}? By redeeming you agree to the Rewards Terms.`
        : `Spend ${fmtCoins(reward.coin_cost)} coins on ${reward.name}? An admin will review and send your code. By redeeming you agree to the Rewards Terms.`;
    if (!window.confirm(msg)) return;

    setBusyId(reward.reward_id);
    try {
      const res = await redeemReward(reward.reward_id);
      showToast(res.data.status === "fulfilled" ? (reward.type === "tf_boost" ? "Team Finder boost activated!" : "ArenaX Pro activated!") : "Request sent \u2014 we'll deliver it soon");
      await load();
      setTab("rewards");
    } catch (e) {
      showToast(e.response?.data?.message || "Couldn't redeem right now", false);
    } finally {
      setBusyId(null);
    }
  };

  const submitReport = async (e) => {
    e.preventDefault();
    setReportBusy(true);
    try {
      const res = await disputeRedemption(reportFor, reportText);
      showToast(res.data.message || "Report sent");
      setReportFor(null);
      setReportText("");
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || "Couldn't send your report", false);
    } finally {
      setReportBusy(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <div className="max-w-4xl mx-auto px-4 py-10"><ErrorMessage message={error} /></div>;

  const canRedeem = data.redemptions_enabled;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      <SEO title="Rewards" path="/rewards" />
      {toast && (
        <div
          className="fixed top-20 right-4 z-50 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl animate-fade-in text-white"
          style={{ background: toast.ok ? "#16a34a" : "#dc2626" }}
        >
          {toast.msg}
        </div>
      )}

      <h1 className="font-display font-bold text-3xl text-white mb-1">Arena Coins</h1>
      <p className="text-sm text-gray-500 mb-6">
        Earn coins for playing, then trade them for rewards. Coins can't be bought or transferred.{" "}
        <Link to="/rewards-terms" className="underline hover:text-white">Rewards Terms</Link>
      </p>

      {/* Balance */}
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Your balance</p>
          <p className="font-display font-bold text-4xl text-white">
            {fmtCoins(data.balance)} <span className="text-lg text-gray-500">coins</span>
          </p>
          {data.pending > 0 && (
            <p className="text-xs text-yellow-500 mt-1">+{fmtCoins(data.pending)} pending (vests after a week on your team)</p>
          )}
        </div>
        {data.is_pro ? (
          <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "rgba(255,70,85,0.15)", color: "#ff4655" }}>
            ArenaX Pro &middot; {data.pro_multiplier}x on daily rewards
          </span>
        ) : data.pro_multiplier > 1 ? (
          <Link to="/profile?tab=arenaxpro" className="btn-secondary text-sm">
            Go Pro for {data.pro_multiplier}x daily coins
          </Link>
        ) : null}
      </div>

      {!canRedeem && (
        <div className="card mb-6 text-sm text-yellow-500">Redemptions are paused for now. You'll keep earning coins in the meantime.</div>
      )}

      {/* Ways to earn */}
      <h2 className="font-display font-bold text-lg text-white mb-3">Ways to earn</h2>
      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        {data.earn.filter((e) => e.amount > 0).map((e) => (
          <div key={e.key} className="card flex items-center justify-between gap-3">
            <span className="text-sm text-gray-300">
              {e.label}
              {e.key === "referral" && <> <Link to="/referrals" className="underline text-xs hover:text-white">Invite friends</Link></>}
            </span>
            <span className="text-sm font-semibold text-white whitespace-nowrap">
              +{e.amount}
              {e.boosted && !data.is_pro && <span className="text-xs text-gray-500"> ({e.pro_amount} with Pro)</span>}
              {e.boosted && data.is_pro && <span className="text-xs" style={{ color: "#ff4655" }}> (+{e.pro_amount} Pro)</span>}
            </span>
          </div>
        ))}
      </div>

      {/* Catalog */}
      <h2 className="font-display font-bold text-lg text-white mb-1">Rewards</h2>
      <p className="text-xs text-gray-500 mb-3">
        Gift cards and top-ups are reviewed by our team and need a verified email and an account older than a week.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
        {data.catalog.map((r) => (
          <RewardCard
            key={r.reward_id}
            reward={r}
            balance={data.balance}
            canRedeem={canRedeem}
            busy={busyId === r.reward_id}
            onRedeem={onRedeem}
          />
        ))}
        {data.catalog.length === 0 && <div className="card text-sm text-gray-500">No rewards available yet.</div>}
      </div>

      {/* History */}
      <div className="flex gap-1 bg-navy rounded-lg p-1 w-fit mb-4">
        {[["activity", "Coin activity"], ["rewards", "My rewards"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${tab === id ? "bg-red text-white" : "text-gray-400 hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "activity" ? (
        ledger.length === 0 ? (
          <div className="card text-sm text-gray-500 text-center py-8">No coins yet &mdash; claim today's check-in on the homepage to get started.</div>
        ) : (
          <div className="space-y-2">
            {ledger.map((e) => (
              <div key={e.entry_id} className="card flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{REASON_LABELS[e.reason] || e.reason}</p>
                  <p className="text-xs text-gray-500">
                    {fmtDate(e.created_at)}
                    {e.status === "pending" && " \u00b7 pending"}
                    {e.status === "reversed" && " \u00b7 reversed"}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${e.status === "reversed" ? "text-gray-600 line-through" : e.delta > 0 ? "text-green-400" : "text-gray-300"}`}>
                  {e.delta > 0 ? "+" : ""}{fmtCoins(e.delta)}
                </span>
              </div>
            ))}
          </div>
        )
      ) : redemptions.length === 0 ? (
        <div className="card text-sm text-gray-500 text-center py-8">You haven't redeemed anything yet.</div>
      ) : (
        <div className="space-y-3">
          {redemptions.map((r) => {
            const st = STATUS_STYLE[r.status] || STATUS_STYLE.requested;
            return (
              <div key={r.redemption_id} className="card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{r.name}</p>
                    <p className="text-xs text-gray-500">{fmtDate(r.created_at)} &middot; {fmtCoins(r.coins_spent)} coins</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                </div>
                {r.fulfillment && (
                  <div className="mt-3 p-3 rounded-lg bg-navy">
                    <p className="text-xs text-gray-500 mb-1">Your code</p>
                    <p className="font-mono text-white break-all select-all">{r.fulfillment}</p>
                  </div>
                )}
                {r.status === "rejected" && r.admin_note && <p className="text-xs text-gray-500 mt-2">Note: {r.admin_note}</p>}
                {r.dispute_status && (
                  <p className="text-xs mt-2" style={{ color: r.dispute_status === "open" ? "#eab308" : "#9ca3af" }}>
                    {DISPUTE_LABEL[r.dispute_status]}
                  </p>
                )}
                {canReport(r) && reportFor !== r.redemption_id && (
                  <button className="btn-ghost text-xs mt-2" onClick={() => { setReportFor(r.redemption_id); setReportText(""); }}>
                    Report a problem
                  </button>
                )}
                {reportFor === r.redemption_id && (
                  <form onSubmit={submitReport} className="mt-3 space-y-2">
                    <textarea
                      className="input w-full text-sm"
                      rows={3}
                      maxLength={1000}
                      required
                      placeholder="What went wrong? (for example: the code says it was already used)"
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button className="btn-primary text-sm" disabled={reportBusy || reportText.trim().length < 10}>
                        {reportBusy ? "Sending..." : "Send report"}
                      </button>
                      <button type="button" className="btn-ghost text-sm" onClick={() => setReportFor(null)}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-gray-500 mt-6">
        Looking for a new headset or mouse? <Link to="/gear" className="underline hover:text-white">Browse Gear</Link>
      </p>
      <p className="text-[11px] text-gray-600 mt-2">
        Rewards are subject to availability. Prices are in coins; gift card values are in {RUPEE}.
      </p>
    </div>
  );
}
