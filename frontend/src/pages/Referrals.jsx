import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyReferralCode, getMyReferrals } from "../services/referralService";
import { PageLoader, EmptyState, ErrorMessage, StatCard } from "../components/UI";
import SEO from "../components/SEO";

// The three things a referred user must do before the referrer is paid
// (mirrors referralService.checkActivation on the backend).
const STEPS = [
  { key: "profileComplete", label: "Profile complete (bio + photo)" },
  { key: "gameSelected", label: "Game added" },
  { key: "joinedTournamentOrCommunity", label: "Joined a tournament or posted in the Nexus" },
];

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// What an activated invite is worth to the referrer right now.
function RewardLine({ inv }) {
  if (inv.coin_status === "pending") {
    return (
      <p className="text-xs text-yellow-500">
        Activated · +{inv.coins_amount} coins on hold{inv.coin_available_at ? ` until ${fmtDate(inv.coin_available_at)}` : ""}
      </p>
    );
  }
  if (inv.coin_status === "available") {
    return <p className="text-xs text-green-400">Activated · +{inv.coins_amount} coins earned</p>;
  }
  if (inv.coin_status === "reversed") {
    return <p className="text-xs text-gray-500">Activated · coins reversed (this account didn't stay in good standing)</p>;
  }
  if (inv.xp_amount > 0) {
    return <p className="text-xs text-green-400">Activated · +{inv.xp_amount} XP (earned before Arena Coins)</p>;
  }
  return <p className="text-xs text-green-400">Activated</p>;
}

function InviteRow({ inv }) {
  const done = inv.status === "credited";
  return (
    <div className="card flex flex-wrap items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-navy overflow-hidden flex items-center justify-center text-gray-400 shrink-0">
        {inv.profile_picture ? (
          <img src={inv.profile_picture} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          inv.username?.[0]?.toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate">{inv.username}</p>
        {done ? (
          <RewardLine inv={inv} />
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
            {STEPS.map((s) => (
              <span key={s.key} className={`text-xs ${inv.progress?.[s.key] ? "text-green-400" : "text-gray-600"}`}>
                {inv.progress?.[s.key] ? "✓" : "○"} {s.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full"
        style={
          done
            ? { background: "rgba(34,197,94,0.15)", color: "#22c55e" }
            : { background: "rgba(234,179,8,0.15)", color: "#eab308" }
        }
      >
        {done ? "Activated" : "Pending"}
      </span>
    </div>
  );
}

export default function Referrals() {
  const [code, setCode] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    Promise.all([getMyReferralCode(), getMyReferrals()])
      .then(([c, r]) => {
        setCode(c.data.referral_code);
        setData(r.data);
      })
      .catch(() => setError("Couldn't load your referral dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };
  const link = code ? `${window.location.origin}/register?ref=${code}` : "";
  const message = "Join me on ArenaX: compete in tournaments and find teammates.";

  const copy = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); showToast(msg); }
    catch { showToast("Couldn't copy -- select and copy manually"); }
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join me on ArenaX", text: message, url: link });
      } else {
        await copy(link, "Invite link copied");
      }
    } catch {}
  };

  if (loading) return <PageLoader />;
  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10"><ErrorMessage message={error} /></div>
    );
  }

  const s = data?.summary || { invitedCount: 0, activatedCount: 0, pendingCount: 0, coinsEarned: 0, coinsOnHold: 0 };
  const p = data?.program;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      <SEO title="Referrals" path="/referrals" />
      {toast && <div className="fixed top-20 right-4 z-50 card text-sm text-white">{toast}</div>}

      <h1 className="font-display font-bold text-3xl text-white mb-1">Invite &amp; Earn</h1>
      <p className="text-sm text-gray-500 mb-6">
        Earn Arena Coins when a friend you invite actually gets going. You're rewarded for active
        players, not raw signups.
      </p>

      {/* Share widget */}
      <div className="card mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Your referral code</p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="font-mono font-bold text-2xl text-white tracking-widest">{code || "--"}</span>
          <button className="btn-secondary text-sm" disabled={!code}
            onClick={() => copy(code, "Code copied")}>Copy code</button>
        </div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Invite link</p>
        <div className="flex flex-wrap gap-2">
          <input className="input flex-1 min-w-[200px] text-sm" readOnly value={link}
            onFocus={(e) => e.target.select()} />
          <button className="btn-primary text-sm" disabled={!code} onClick={share}>Share</button>
          {code && (
            <a className="btn-secondary text-sm" href={whatsapp} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* How it works: numbers are live from the server, so they follow admin changes */}
      {p && (
        <div className="card mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">How it works</p>
          {p.paused ? (
            <p className="text-sm text-yellow-500">Referral rewards are paused right now. Invites still work and will be counted.</p>
          ) : (
            <ol className="text-sm text-gray-300 space-y-1.5 list-decimal pl-5">
              <li>Send your link or code to a friend.</li>
              <li>They sign up and finish getting started: profile photo and bio, a game added, and a team tournament entry or a Nexus post.</li>
              <li>
                You earn <span className="text-white font-semibold">{p.coinsPerReferral} Arena Coins</span>
                {p.holdDays > 0 ? `, held for ${p.holdDays} day${p.holdDays === 1 ? "" : "s"} so we can check the account is genuine.` : "."}
              </li>
            </ol>
          )}
          {!p.paused && (
            <p className="text-xs text-gray-500 mt-3">
              Up to {p.monthlyCap} rewarded friends per month ({p.creditedThisMonth} used this month).
              {p.capReached && " You've reached this month's limit, so friends who get active now are paid next month."}{" "}
              <Link to="/rewards" className="underline hover:text-white">See what coins can buy</Link>
            </p>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Invited" value={s.invitedCount} />
        <StatCard label="Activated" value={s.activatedCount} />
        <StatCard label="Coins earned" value={s.coinsEarned} />
        <StatCard label="Coins on hold" value={s.coinsOnHold} />
      </div>

      {/* Invitees */}
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Your invites</h2>
      {data?.invited?.length ? (
        <div className="space-y-3">
          {data.invited.map((inv) => <InviteRow key={inv.reward_id} inv={inv} />)}
        </div>
      ) : (
        <EmptyState
          icon="🤝"
          title="No invites yet"
          subtitle="Share your link and you'll see each friend's progress here."
        />
      )}
    </div>
  );
}
