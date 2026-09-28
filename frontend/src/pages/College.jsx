import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCollegeBySlug, joinCollege, leaveCollege } from "../services/collegeService";
import { getMe } from "../services/authService";
import { PageLoader, ErrorMessage, StatCard } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import SEO from "../components/SEO";

export default function College() {
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();
  const [college, setCollege] = useState(null);
  const [myCollegeId, setMyCollegeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const load = () =>
    getCollegeBySlug(slug)
      .then((r) => setCollege(r.data.college))
      .catch(() => setError("College not found"))
      .finally(() => setLoading(false));

  useEffect(() => { setLoading(true); load(); }, [slug]);

  useEffect(() => {
    if (!isAuthenticated) { setMyCollegeId(null); return; }
    getMe()
      .then((r) => setMyCollegeId(r.data.user?.college_id ?? null))
      .catch(() => {});
  }, [isAuthenticated]);

  const isMember = college && myCollegeId === college.college_id;

  const toggleMembership = async () => {
    setBusy(true);
    try {
      if (isMember) {
        await leaveCollege();
        setMyCollegeId(null);
        showToast("You left this college");
      } else {
        await joinCollege(college.college_id);
        setMyCollegeId(college.college_id);
        showToast(`Joined ${college.name}`);
      }
      await load();
    } catch (e) {
      showToast(e.response?.data?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: college.name, url });
      else { await navigator.clipboard.writeText(url); showToast("Link copied"); }
    } catch {}
  };

  if (loading) return <PageLoader />;
  if (!college)
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <ErrorMessage message={error} />
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      <SEO
        title={`${college.name} — College Esports`}
        description={`${college.name} on ArenaX: ${college.stats.memberCount} members, ${college.stats.teamCount} teams, ${college.stats.tournamentWins} tournament wins.`}
        path={`/colleges/${college.slug}`}
      />
      {toast && <div className="fixed top-20 right-4 z-50 card text-sm text-white">{toast}</div>}

      <Link to="/colleges" className="text-xs text-gray-500 hover:text-white">← College Leaderboard</Link>

      <div className="card mt-4 mb-6 flex flex-wrap items-center gap-5">
        <div className="w-20 h-20 rounded-xl bg-red/15 border border-red/30 flex items-center justify-center text-red text-3xl font-bold overflow-hidden shrink-0">
          {college.logo_url ? (
            <img src={college.logo_url} alt={college.name} className="w-full h-full object-cover" />
          ) : (
            college.name?.[0]?.toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-3xl text-white flex items-center gap-2 flex-wrap">
            {college.name}
            {college.isLicensed && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
              >
                Official Partner
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {[college.city, college.state].filter(Boolean).join(", ") || "India"}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={share}>Share</button>
          {isAuthenticated ? (
            <button className="btn-primary text-sm" disabled={busy} onClick={toggleMembership}>
              {busy ? "…" : isMember ? "Leave college" : "Join this college"}
            </button>
          ) : (
            <Link to="/login" className="btn-primary text-sm">Log in to join</Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Members" value={college.stats.memberCount} />
        <StatCard label="Teams" value={college.stats.teamCount} />
        <StatCard label="Tournament Wins" value={college.stats.tournamentWins} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link to={`/tournament?college_id=${college.college_id}`} className="card-hover">
          <p className="font-semibold text-white">🏆 Tournaments</p>
          <p className="text-xs text-gray-500 mt-1">Tournaments {college.name}'s teams have entered.</p>
        </Link>
        <Link to={`/teamfinder?college_id=${college.college_id}`} className="card-hover">
          <p className="font-semibold text-white">🔍 Find teammates</p>
          <p className="text-xs text-gray-500 mt-1">Team Finder posts from {college.name} players.</p>
        </Link>
      </div>
    </div>
  );
}
