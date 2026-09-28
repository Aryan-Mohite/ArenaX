import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCollegeLeaderboard, listColleges, claimCollege } from "../services/collegeService";
import { PageLoader, EmptyState } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import SEO from "../components/SEO";

const MEDALS = ["🥇", "🥈", "🥉"];

function CollegeLogo({ college, size = 40 }) {
  return (
    <div
      className="rounded-lg bg-red/15 border border-red/30 flex items-center justify-center text-red font-bold overflow-hidden shrink-0"
      style={{ width: size, height: size }}
    >
      {college.logo_url ? (
        <img src={college.logo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : (
        college.name?.[0]?.toUpperCase()
      )}
    </div>
  );
}

function ClaimModal({ onClose, onDone }) {
  const [form, setForm] = useState({ name: "", city: "", state: "", logo_url: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError("");
    if (form.name.trim().length < 3) return setError("Enter your college's full name");
    setBusy(true);
    try {
      const res = await claimCollege({
        name: form.name.trim(),
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        logo_url: form.logo_url.trim() || undefined,
      });
      onDone(res.data.message);
    } catch (e) {
      const data = e.response?.data;
      setError(
        data?.errors?.length
          ? data.errors.map((x) => x.message).join(" · ")
          : data?.message || "Couldn't submit your claim",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg text-white">Claim your college</h3>
          <button className="btn-ghost text-sm" onClick={onClose}>Close</button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Not listed yet? Submit your campus — an admin reviews every claim, and once approved
          you can invite classmates to compete for it.
        </p>
        <div className="space-y-3">
          <input className="input" placeholder="College name *" value={form.name}
            onChange={(e) => set("name", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="City" value={form.city}
              onChange={(e) => set("city", e.target.value)} />
            <input className="input" placeholder="State" value={form.state}
              onChange={(e) => set("state", e.target.value)} />
          </div>
          <input className="input" type="url" placeholder="Logo URL (optional)" value={form.logo_url}
            onChange={(e) => set("logo_url", e.target.value)} />
          {error && <p className="text-sm text-red">{error}</p>}
          <button className="btn-primary w-full" disabled={busy} onClick={submit}>
            {busy ? "Submitting…" : "Submit claim"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Colleges() {
  const { isAuthenticated } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null); // null = not searching
  const [showClaim, setShowClaim] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    getCollegeLeaderboard(50)
      .then((r) => setLeaderboard(r.data.leaderboard || []))
      .catch(() => setLeaderboard([]))
      .finally(() => setLoading(false));
  }, []);

  // Debounced search across all approved colleges
  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    const t = setTimeout(() => {
      listColleges({ q: q.trim(), limit: 20 })
        .then((r) => setResults(r.data.colleges || []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 4000); };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      <SEO
        title="College Esports Leaderboard"
        description="See which colleges are winning on ArenaX. Join your campus, rep your college in inter-college tournaments, and climb the leaderboard."
        path="/colleges"
      />
      {toast && (
        <div className="fixed top-20 right-4 z-50 card text-sm text-white">{toast}</div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">College Leaderboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ranked by tournament wins, then active members. Share it — rival campuses will notice.
          </p>
        </div>
        {isAuthenticated ? (
          <button className="btn-primary text-sm" onClick={() => setShowClaim(true)}>
            + Claim your college
          </button>
        ) : (
          <Link to="/login" className="btn-secondary text-sm">Log in to claim your college</Link>
        )}
      </div>

      <input
        className="input mb-6"
        placeholder="Search colleges…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {results ? (
        results.length === 0 ? (
          <EmptyState icon="🎓" title="No colleges found" subtitle="Try another name, or claim yours." />
        ) : (
          <div className="space-y-2">
            {results.map((c) => (
              <Link key={c.college_id} to={`/colleges/${c.slug}`} className="card-hover flex items-center gap-3">
                <CollegeLogo college={c} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                <span className="text-xs text-gray-400">{c.member_count} members</span>
              </Link>
            ))}
          </div>
        )
      ) : leaderboard.length === 0 ? (
        <EmptyState
          icon="🏆"
          title="No colleges on the board yet"
          subtitle="Be the first — claim your college and start recruiting."
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy border-b border-surface-border">
              <tr>
                {["#", "College", "Wins", "Teams", "Members"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((c, i) => (
                <tr key={c.college_id} className="border-b border-surface-border/50 hover:bg-surface-card/40 transition-colors">
                  <td className="px-4 py-3 text-gray-400">{MEDALS[i] || i + 1}</td>
                  <td className="px-4 py-3">
                    <Link to={`/colleges/${c.slug}`} className="flex items-center gap-3 hover:text-red transition-colors">
                      <CollegeLogo college={c} size={32} />
                      <span>
                        <span className="text-white font-semibold block">{c.name}</span>
                        <span className="text-xs text-gray-500">
                          {[c.city, c.state].filter(Boolean).join(", ")}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white font-semibold">{Number(c.tournament_wins)}</td>
                  <td className="px-4 py-3 text-gray-300">{Number(c.team_count)}</td>
                  <td className="px-4 py-3 text-gray-300">{Number(c.member_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showClaim && (
        <ClaimModal
          onClose={() => setShowClaim(false)}
          onDone={(msg) => { setShowClaim(false); showToast(msg); }}
        />
      )}
    </div>
  );
}
