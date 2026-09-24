import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getMyDna, saveMyDna, getCandidates, swipeUser, getMyMatches, rateTeammate } from "../services/gamerDnaService";
import { getKarmaBadge, getKarmaSummary } from "../utils/karma";
import { PageLoader, EmptyState, ErrorMessage, PageHeader } from "../components/UI";
import ChatDrawer from "../components/ChatDrawer";
import SEO from "../components/SEO";

// ─── DNA trait option catalogs (must mirror backend ENUMs) ────────────────────
const PLAY_STYLES = [
  { value: "casual",      label: "Casual",      blurb: "Here to unwind, no pressure" },
  { value: "balanced",    label: "Balanced",    blurb: "Fun first, but I try to win" },
  { value: "competitive", label: "Competitive", blurb: "Ranked grind, tryhard mode" },
];
const COMMS_PREFS = [
  { value: "voice",  label: "Voice comms",  blurb: "I like to call out on mic" },
  { value: "text",   label: "Text chat",    blurb: "Pings and chat are enough" },
  { value: "silent", label: "Silent lobby", blurb: "I'd rather just play quietly" },
];
const SESSION_GOALS = [
  { value: "unwind",    label: "Unwind",    blurb: "Stress-free, low stakes" },
  { value: "improve",   label: "Improve",   blurb: "Working on mechanics/strategy" },
  { value: "win",       label: "Win",       blurb: "Here for the W" },
  { value: "socialize", label: "Socialize", blurb: "Mostly here for the people" },
];

const traitLabel = (catalog, value) => catalog.find((o) => o.value === value)?.label || value;

// ─── DNA onboarding quiz ────────────────────────────────────────────────────
function DnaQuiz({ onSaved }) {
  const [form, setForm] = useState({ play_style: "", comms_pref: "", session_goal: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = form.play_style && form.comms_pref && form.session_goal;

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await saveMyDna(form);
      onSaved(res.data.dna);
    } catch {
      setError("Could not save your Gamer DNA — try again");
    } finally {
      setSaving(false);
    }
  };

  const Question = ({ title, field, options }) => (
    <div className="mb-8">
      <p className="text-sm font-semibold text-white mb-3">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setForm((f) => ({ ...f, [field]: opt.value }))}
            className={`card-hover text-left transition-all ${
              form[field] === opt.value ? "ring-2 ring-red" : ""
            }`}
          >
            <p className="font-semibold text-white text-sm">{opt.label}</p>
            <p className="text-xs text-gray-500 mt-1">{opt.blurb}</p>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <p className="text-3xl mb-2">🧬</p>
        <h2 className="section-title">Set your Gamer DNA</h2>
        <p className="section-subtitle">
          Three quick questions so we can match you with teammates who actually vibe with how you play.
        </p>
      </div>

      <Question title="How do you play?" field="play_style" options={PLAY_STYLES} />
      <Question title="How do you like to communicate?" field="comms_pref" options={COMMS_PREFS} />
      <Question title="What are you here for today?" field="session_goal" options={SESSION_GOALS} />

      <ErrorMessage message={error} />

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || saving}
        className="btn-primary w-full justify-center mt-2 disabled:opacity-40"
      >
        {saving ? "Saving…" : "Start matching"}
      </button>
    </div>
  );
}

// ─── Single swipe card ──────────────────────────────────────────────────────
function SwipeCard({ candidate, onLike, onPass, exiting }) {
  return (
    <div
      className={`card w-full max-w-sm mx-auto transition-all duration-300 ${
        exiting === "like" ? "translate-x-[120%] rotate-12 opacity-0" : ""
      } ${exiting === "pass" ? "-translate-x-[120%] -rotate-12 opacity-0" : ""}`}
    >
      <div className="flex flex-col items-center text-center pt-2 pb-4">
        <div
          className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center text-3xl font-bold shrink-0 mb-4"
          style={{ background: "rgba(255,70,85,0.12)", border: "2px solid rgba(255,70,85,0.3)", color: "#ff6b77" }}
        >
          {candidate.profile_picture ? (
            <img src={candidate.profile_picture} alt={candidate.username} className="w-full h-full object-cover" />
          ) : (
            candidate.username?.[0]?.toUpperCase()
          )}
        </div>
        <p className="font-display font-bold text-white text-xl">{candidate.username}</p>
        {candidate.region && <p className="text-xs text-gray-500 mt-0.5">{candidate.region}</p>}
        {(() => {
          const badge = getKarmaBadge(candidate.karma_positive, candidate.karma_negative);
          const summary = getKarmaSummary(candidate.karma_positive, candidate.karma_negative);
          if (!summary) return null;
          return (
            <p className="text-xs mt-1" style={{ color: badge ? "#4ade80" : "var(--text-secondary, #9ca3af)" }}>
              {badge ? `${badge.icon} ${badge.label} · ` : ""}{summary}
            </p>
          );
        })()}
        {candidate.bio && <p className="text-sm text-gray-400 mt-3 line-clamp-2">{candidate.bio}</p>}
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-4">
        <span className="badge-red">{traitLabel(PLAY_STYLES, candidate.play_style)}</span>
        <span className="badge-blue">{traitLabel(COMMS_PREFS, candidate.comms_pref)}</span>
        <span className="badge-gray">{traitLabel(SESSION_GOALS, candidate.session_goal)}</span>
        {candidate.match_score > 0 && (
          <span className="badge-green">{candidate.match_score}/3 traits match</span>
        )}
      </div>

      {(candidate.game_rank || candidate.game_role) && (
        <div className="flex justify-center gap-4 text-xs text-gray-500 mb-5 pb-4 border-b" style={{ borderColor: "var(--border-color)" }}>
          {candidate.game_rank && <span>Rank: <span className="text-gray-300">{candidate.game_rank}</span></span>}
          {candidate.game_role && <span>Role: <span className="text-gray-300">{candidate.game_role}</span></span>}
          {candidate.elo_rating && <span>ELO: <span className="text-gray-300">{candidate.elo_rating}</span></span>}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onPass} className="btn-secondary flex-1 justify-center text-lg">
          ✕ Pass
        </button>
        <button onClick={onLike} className="btn-primary flex-1 justify-center text-lg">
          ♥ Like
        </button>
      </div>
    </div>
  );
}

// ─── Match celebration toast ────────────────────────────────────────────────
function MatchToast({ match, onOpenChat, onDismiss }) {
  if (!match) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in" onClick={onDismiss}>
      <div className="card max-w-sm w-full mx-4 text-center animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <p className="text-4xl mb-3">🎉</p>
        <h3 className="section-title">It's a match!</h3>
        <p className="section-subtitle mb-6">You and {match.username || "your new squadmate"} both liked each other.</p>
        <div className="flex gap-3">
          <button onClick={onDismiss} className="btn-secondary flex-1 justify-center">Keep swiping</button>
          <button onClick={onOpenChat} className="btn-primary flex-1 justify-center">Say hi</button>
        </div>
      </div>
    </div>
  );
}

// ─── Matches list ────────────────────────────────────────────────────────────
function MatchCard({ match, onOpenChat, onRated }) {
  const [rating, setRating] = useState(match.my_rating); // null | 'positive' | 'negative'
  const [busy, setBusy] = useState(false);

  const handleRate = async (e, score) => {
    e.stopPropagation();
    if (busy || rating === score) return;
    setBusy(true);
    const prev = rating;
    setRating(score); // optimistic
    try {
      await rateTeammate(match.match_id, score);
      onRated?.(match.match_id, score);
    } catch {
      setRating(prev);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-hover text-left">
      <button onClick={() => onOpenChat(match)} className="w-full flex items-center gap-3 text-left">
        <div
          className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: "rgba(255,70,85,0.12)", border: "1.5px solid rgba(255,70,85,0.3)", color: "#ff6b77" }}
        >
          {match.profile_picture ? (
            <img src={match.profile_picture} alt={match.username} className="w-full h-full object-cover" />
          ) : (
            match.username?.[0]?.toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white text-sm truncate">{match.username}</p>
          <p className="text-xs text-gray-500">{match.region || "Matched"}</p>
        </div>
      </button>

      <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: "var(--border-color)" }}>
        <span className="text-xs text-gray-500">{rating ? "Thanks for the feedback" : "Played together?"}</span>
        <div className="flex gap-1.5">
          <button
            onClick={(e) => handleRate(e, "positive")}
            disabled={busy}
            title="Good teammate"
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all"
            style={{
              background: rating === "positive" ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.05)",
              border: rating === "positive" ? "1px solid #4ade80" : "1px solid var(--border-color)",
            }}
          >
            👍
          </button>
          <button
            onClick={(e) => handleRate(e, "negative")}
            disabled={busy}
            title="Not a great fit"
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all"
            style={{
              background: rating === "negative" ? "rgba(156,163,175,0.2)" : "rgba(255,255,255,0.05)",
              border: rating === "negative" ? "1px solid #9ca3af" : "1px solid var(--border-color)",
            }}
          >
            👎
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchesPanel({ matches, onOpenChat, onRated }) {
  if (matches.length === 0) {
    return <EmptyState icon="🤝" title="No matches yet" subtitle="Like a few candidates to start finding squadmates." />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {matches.map((m) => (
        <MatchCard key={m.match_id} match={m} onOpenChat={onOpenChat} onRated={onRated} />
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function SquadMatch() {
  const { isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [dna, setDna] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [exiting, setExiting] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("swipe"); // 'swipe' | 'matches'
  const [matches, setMatches] = useState([]);
  const [celebrateMatch, setCelebrateMatch] = useState(null);
  const [activeChat, setActiveChat] = useState(null); // { match_id, username }

  const loadCandidates = useCallback(async () => {
    try {
      const res = await getCandidates();
      setCandidates(res.data.candidates || []);
    } catch {
      setError("Could not load candidates");
    }
  }, []);

  const loadMatches = useCallback(async () => {
    try {
      const res = await getMyMatches();
      setMatches(res.data.matches || []);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const res = await getMyDna();
        setDna(res.data.dna);
        if (res.data.dna) await loadCandidates();
      } catch {
        setError("Could not load your Gamer DNA");
      } finally {
        setLoading(false);
      }
      loadMatches();
    })();
  }, [isAuthenticated, loadCandidates, loadMatches]);

  const handleSwipe = async (candidate, action) => {
    setExiting(action);
    try {
      const res = await swipeUser(candidate.user_id, action);
      if (res.data.matched) {
        setCelebrateMatch({ ...res.data.match, username: candidate.username });
        loadMatches();
      }
    } catch { /* candidate is removed from the stack regardless */ }
    setTimeout(() => {
      setCandidates((prev) => prev.filter((c) => c.user_id !== candidate.user_id));
      setExiting(null);
    }, 250);
  };

  const openChatForMatch = (match) => {
    setCelebrateMatch(null);
    setActiveChat({ match_id: match.match_id, username: match.username });
  };

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon="🔒"
        title="Log in to find squadmates"
        subtitle="Squad Match uses your Gamer DNA to pair you with teammates who play the way you do."
      />
    );
  }

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <SEO
        title="Squad Match"
        description="Find teammates who match your playstyle, comms preference, and session goals on ArenaX."
        path="/squadmatch"
      />

      {!dna ? (
        <DnaQuiz onSaved={(saved) => { setDna(saved); loadCandidates(); }} />
      ) : (
        <>
          <PageHeader
            title="Squad Match"
            subtitle="Swipe to find teammates who match your Gamer DNA"
          />

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setTab("swipe")}
              className={tab === "swipe" ? "btn-primary" : "btn-secondary"}
            >
              Discover
            </button>
            <button
              onClick={() => setTab("matches")}
              className={tab === "matches" ? "btn-primary" : "btn-secondary"}
            >
              Matches {matches.length > 0 && `(${matches.length})`}
            </button>
          </div>

          <ErrorMessage message={error} />

          {tab === "swipe" && (
            candidates.length === 0 ? (
              <EmptyState
                icon="🎮"
                title="No new candidates right now"
                subtitle="Check back later, or invite friends so there are more players in the pool."
              />
            ) : (
              <SwipeCard
                candidate={candidates[0]}
                exiting={exiting}
                onLike={() => handleSwipe(candidates[0], "like")}
                onPass={() => handleSwipe(candidates[0], "pass")}
              />
            )
          )}

          {tab === "matches" && (
            <MatchesPanel matches={matches} onOpenChat={openChatForMatch} onRated={() => loadMatches()} />
          )}
        </>
      )}

      <MatchToast
        match={celebrateMatch}
        onDismiss={() => setCelebrateMatch(null)}
        onOpenChat={() => openChatForMatch({ match_id: celebrateMatch.match_id, username: celebrateMatch.username })}
      />

      <ChatDrawer
        open={!!activeChat}
        onClose={() => setActiveChat(null)}
        chatType="swipe"
        chatId={activeChat?.match_id}
        title={activeChat?.username || "Squadmate"}
        subtitle="Matched via Squad Match"
      />
    </div>
  );
}
