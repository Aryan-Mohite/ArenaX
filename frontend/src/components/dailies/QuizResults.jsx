import { useState, useEffect } from "react";
import { getGameLeaderboard, getSessionShareData } from "../../services/dailyQuizService";
import { Spinner } from "../UI";
import DailiesShareCard from "./DailiesShareCard";

function formatTime(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function QuizResults({ game, sessionId, results, streak, onPlayAnotherGame }) {
  const [tab, setTab] = useState("daily");
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLbLoading(true);
    getGameLeaderboard(game.game_id, tab)
      .then((res) => {
        if (!cancelled) setLeaderboard(res.data.leaderboard || []);
      })
      .catch(() => {
        if (!cancelled) setLeaderboard([]);
      })
      .finally(() => {
        if (!cancelled) setLbLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [game.game_id, tab]);

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-10 overflow-y-auto">
      {/* Results card */}
      <div
        className="w-full max-w-2xl rounded-lg border p-6 mb-6"
        style={{ borderColor: "rgba(255,70,85,0.25)", background: "#0d1220", boxShadow: "0 0 60px -20px rgba(255,70,85,0.25)" }}
      >
        <p className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-1">{game.game_name} · Results</p>
        <div className="flex items-end gap-6 mb-4">
          <div>
            <div className="text-4xl font-display font-bold text-white">
              {results.correct_count}
              <span className="text-xl text-gray-500">/{results.total_questions}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">Correct</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{formatTime(results.total_time_ms)}</div>
            <div className="text-xs text-gray-500 mt-1">Total Time</div>
          </div>
        </div>

        {streak?.extended && (
          <div
            className="rounded-md px-4 py-2.5 text-sm font-semibold mb-4"
            style={{ background: "rgba(255,70,85,0.12)", color: "#ff6b77", border: "1px solid rgba(255,70,85,0.3)" }}
          >
            🔥 Streak Extended: {streak.currentStreak} Day{streak.currentStreak === 1 ? "" : "s"}!
          </div>
        )}

        <div className="flex gap-3">
          {sessionId && (
            <button
              onClick={() => setShareOpen(true)}
              className="flex-1 py-2.5 rounded-md font-bold text-sm text-white transition-all"
              style={{ background: "linear-gradient(135deg, #ff4655, #cc2233)", boxShadow: "0 0 18px rgba(255,70,85,0.4)" }}
            >
              SHARE RANK
            </button>
          )}
          <button
            onClick={onPlayAnotherGame}
            className="flex-1 py-2.5 rounded-md font-bold text-sm border"
            style={{ borderColor: "rgba(255,255,255,0.15)", color: "#c7c7c7" }}
          >
            Play Another Game
          </button>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="w-full max-w-2xl rounded-lg border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.08)", background: "#0d1220" }}>
        <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {["daily", "alltime"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-3 text-sm font-semibold transition-colors"
              style={{
                color: tab === t ? "#fff" : "#666",
                borderBottom: tab === t ? "2px solid #ff4655" : "2px solid transparent",
              }}
            >
              {t === "daily" ? "Daily Leaderboard" : "All-Time Top"}
            </button>
          ))}
        </div>

        <div className="p-2">
          {lbLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8">No entries yet.</p>
          ) : (
            leaderboard.map((row) => (
              <div
                key={row.user_id}
                className="flex items-center justify-between px-3 py-2.5 rounded-md text-sm"
                style={{
                  background: row.is_self ? "linear-gradient(90deg, rgba(255,70,85,0.16), rgba(255,70,85,0.02))" : "transparent",
                  boxShadow: row.is_self ? "inset 0 0 0 1px rgba(255,70,85,0.35)" : "none",
                }}
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right font-bold" style={{ color: row.rank <= 3 ? "#ff4655" : "#666" }}>
                    #{row.rank}
                  </span>
                  <span style={{ color: row.is_self ? "#fff" : "#c7c7c7" }}>{row.username}</span>
                </span>
                <span className="text-gray-500">
                  {row.correct_count}/5 · {formatTime(row.total_time_ms)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {shareOpen && (
        <ShareCardLoader game={game} sessionId={sessionId} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}

// Fetches the percentile/streak data, then hands off to the actual
// capturable/downloadable card once it's ready.
function ShareCardLoader({ game, sessionId, onClose }) {
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getSessionShareData(sessionId)
      .then((res) => setShareData(res.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70" onClick={onClose}>
        <Spinner />
      </div>
    );
  }

  if (failed || !shareData) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
        <p className="text-sm text-gray-400" onClick={(e) => e.stopPropagation()}>
          Couldn't load your share card. <button onClick={onClose} className="underline">Close</button>
        </p>
      </div>
    );
  }

  return <DailiesShareCard game={game} shareData={shareData} onClose={onClose} />;
}
