import { Spinner } from "../UI";

function formatTime(ms) {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function QuizLobby({ game, lobby, loading, starting, onStart, onViewLeaderboard }) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const alreadyDone = lobby?.today_status?.status === "completed";

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
      <div
        className="w-full max-w-2xl rounded-lg border overflow-hidden"
        style={{ borderColor: "rgba(255,70,85,0.25)", background: "#0d1220", boxShadow: "0 0 60px -20px rgba(255,70,85,0.25)" }}
      >
        {/* Banner */}
        <div
          className="h-36 relative flex items-end px-6 pb-4"
          style={{
            backgroundImage: game.cover_image ? `url(${game.cover_image})` : undefined,
            backgroundColor: "#11182c",
            backgroundSize: "cover",
            backgroundPosition: "center",
            clipPath: "polygon(0 0, 100% 0, 100% 88%, 96% 100%, 0 100%)",
          }}
        >
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 100%)" }} />
          <h1 className="relative text-2xl font-display font-bold text-white tracking-wide">{game.game_name}</h1>
        </div>

        <div className="p-6">
          {alreadyDone ? (
            <div className="text-center py-4">
              <p className="text-[#ff6b77] font-semibold mb-1">You've already played today's quiz</p>
              <p className="text-sm text-gray-500 mb-5">
                {lobby.today_status.correct_count}/5 correct · {formatTime(lobby.today_status.total_time_ms)}
              </p>
              <button
                onClick={onViewLeaderboard}
                className="px-6 py-2.5 rounded-md font-semibold text-sm border transition-colors"
                style={{ borderColor: "rgba(255,70,85,0.4)", color: "#fff" }}
              >
                View Leaderboard
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Stat label="Played Today" value={lobby?.global_completed_today ?? 0} />
                <Stat
                  label="Your Best"
                  value={lobby?.personal_best ? `${lobby.personal_best.correct_count}/5` : "—"}
                />
                <Stat label="Streak" value={lobby?.streak?.current_streak ? `🔥 ${lobby.streak.current_streak}d` : "0d"} />
              </div>

              {lobby?.top3_today?.length > 0 && (
                <div className="mb-6">
                  <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase mb-2">Top 3 Today</p>
                  <div className="space-y-1.5">
                    {lobby.top3_today.map((row, i) => (
                      <div key={i} className="flex items-center justify-between text-sm px-3 py-1.5 rounded bg-white/[0.03]">
                        <span className="text-gray-300">
                          <span className="text-[#ff4655] font-bold mr-2">#{i + 1}</span>
                          {row.username}
                        </span>
                        <span className="text-gray-500">
                          {row.correct_count}/5 · {formatTime(row.total_time_ms)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={onStart}
                disabled={starting}
                className="w-full py-3.5 rounded-md font-bold tracking-wide text-white transition-all duration-200 disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #ff4655, #cc2233)",
                  boxShadow: "0 0 24px rgba(255,70,85,0.45)",
                }}
              >
                {starting ? "Starting…" : "START DAILY QUIZ"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-center py-3 rounded-md border" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}
