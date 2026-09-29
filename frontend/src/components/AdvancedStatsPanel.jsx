import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMySubscription } from "../services/paymentService";
import { getAdvancedStats } from "../services/userService";

// §4 ArenaX Pro perk: deeper stats when viewing another player. Free users
// see a one-line upsell — browsing the profile itself stays free.
export default function AdvancedStatsPanel({ userId }) {
  const [state, setState] = useState({ status: "loading", stats: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sub = await getMySubscription();
        if (!sub.data.subscription?.feature_flags?.advanced_stats) {
          if (alive) setState({ status: "locked", stats: null });
          return;
        }
        const r = await getAdvancedStats(userId);
        if (alive) setState({ status: "ready", stats: r.data.stats });
      } catch {
        if (alive) setState({ status: "error", stats: null });
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (state.status === "loading" || state.status === "error") return null;

  if (state.status === "locked") {
    return (
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">⭐ Advanced player stats</p>
          <p className="text-xs text-gray-500">Elo percentile, recent match history and win/loss — an ArenaX Pro perk.</p>
        </div>
        <Link to="/profile" className="btn-ghost text-xs">Get ArenaX Pro</Link>
      </div>
    );
  }

  const { eloStandings, recentMatches, winLoss } = state.stats;
  const winPct = winLoss.played ? Math.round((winLoss.wins / winLoss.played) * 100) : null;

  return (
    <div className="card mb-6">
      <h3 className="font-display font-bold text-white mb-3">⭐ Advanced stats</h3>
      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <div><div className="text-xl font-bold text-white tabular-nums">{winLoss.played}</div><div className="text-xs text-gray-500 uppercase">Matches</div></div>
        <div><div className="text-xl font-bold text-green-400 tabular-nums">{winLoss.wins}</div><div className="text-xs text-gray-500 uppercase">Wins</div></div>
        <div><div className="text-xl font-bold text-white tabular-nums">{winPct == null ? "—" : `${winPct}%`}</div><div className="text-xs text-gray-500 uppercase">Win rate</div></div>
      </div>

      {eloStandings.length > 0 && (
        <div className="mb-4 space-y-2">
          {eloStandings.map((e) => (
            <div key={e.game_id} className="flex items-center justify-between text-sm">
              <span className="text-gray-300">{e.game_name}</span>
              <span className="text-gray-400">
                Elo {e.elo_rating} · <span className="text-white font-semibold">top {Math.max(1, Math.round((1 - e.percentile) * 100))}%</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {recentMatches.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Recent matches</p>
          {recentMatches.map((m) => (
            <div key={m.match_id} className="flex items-center justify-between text-sm">
              <span className="text-gray-300 truncate">vs {m.opponent_team_name || "TBD"} · <span className="text-gray-500">{m.tournament_name}</span></span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.won ? "bg-green-500/15 text-green-400" : "bg-red/15 text-red"}`}>
                {m.won ? "W" : "L"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-600">No completed matches yet.</p>
      )}
    </div>
  );
}
