import { useEffect, useState } from "react";
import { getMyAchievements } from "../services/achievementService";
import AchievementShareCard from "./AchievementShareCard";

// Maps the `icon` key seeded in the achievements table to an emoji.
// No new asset/library needed — matches the emoji-in-tab-label style
// already used elsewhere in Profile.jsx ("🎮 Game IDs", "🛡️ Teams").
const ICONS = {
  streak_7: "🔥", streak_30: "🔥", streak_100: "🔥", streak_200: "🔥", streak_500: "🔥",
  squad_up: "🛡️",
  nexus_1: "📡", nexus_10: "📡", nexus_100: "📡",
  dna_1: "🧬", dna_5: "🧬", dna_10: "🧬", dna_25: "🧬", dna_50: "🧬", dna_100: "🧬",
};

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function AchievedCard({ achievement, onShare }) {
  return (
    <div className="card-hover flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <span className="text-3xl">{ICONS[achievement.icon] || "🏆"}</span>
        <span className="badge bg-red/15 text-red-light">Unlocked</span>
      </div>
      <p className="font-display font-bold text-white leading-tight">{achievement.name}</p>
      <p className="text-xs text-gray-400">{achievement.description}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-gray-500">Earned {formatDate(achievement.earned_at)}</span>
        <button
          onClick={() => onShare(achievement)}
          className="btn-ghost text-xs !px-3 !py-1.5"
        >
          Share
        </button>
      </div>
    </div>
  );
}

function LockedCard({ achievement }) {
  return (
    <div className="card flex flex-col gap-2 opacity-50">
      <div className="flex items-start justify-between">
        <span className="text-3xl grayscale">{ICONS[achievement.icon] || "🏆"}</span>
        <span className="badge bg-surface-border text-gray-400">Locked</span>
      </div>
      <p className="font-display font-bold text-gray-300 leading-tight">{achievement.name}</p>
      <p className="text-xs text-gray-500">{achievement.description}</p>
      {typeof achievement.progress === "number" && achievement.threshold > 0 && (
        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-surface-border overflow-hidden">
            <div
              className="h-full bg-red"
              style={{ width: `${Math.min(100, (achievement.progress / achievement.threshold) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            {achievement.progress}/{achievement.threshold}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AchievementsTab({ username }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subTab, setSubTab] = useState("achieved");
  const [shareTarget, setShareTarget] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    getMyAchievements()
      .then((res) => setData(res.data))
      .catch(() => setError("Could not load achievements."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400 text-sm animate-fade-in">Loading achievements...</p>;
  if (error) return <p className="text-red-light text-sm animate-fade-in">{error}</p>;
  if (!data) return null;

  const { achieved, locked, streak } = data;

  return (
    <div className="animate-fade-in space-y-5">
      {shareTarget && (
        <AchievementShareCard
          achievement={shareTarget}
          username={username}
          onClose={() => setShareTarget(null)}
        />
      )}

      {/* Streak summary */}
      <div className="card flex items-center gap-4">
        <span className="text-3xl">🔥</span>
        <div>
          <p className="font-display font-bold text-white">
            {streak.current_streak}-day login streak
          </p>
          <p className="text-xs text-gray-400">Longest streak: {streak.longest_streak} days</p>
        </div>
      </div>

      {/* Achieved / Locked sub-tabs */}
      <div className="flex gap-1 bg-surface-card rounded-lg p-1 w-fit">
        {[
          { id: "achieved", label: `Achieved (${achieved.length})` },
          { id: "locked", label: `Locked (${locked.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={
              "px-4 py-2 rounded-md text-sm font-medium transition-all " +
              (subTab === t.id ? "bg-red text-white" : "text-gray-400 hover:text-white")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "achieved" && (
        achieved.length === 0 ? (
          <p className="text-gray-400 text-sm">No achievements unlocked yet — get out there!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {achieved.map((a) => (
              <AchievedCard key={a.achievement_id} achievement={a} onShare={setShareTarget} />
            ))}
          </div>
        )
      )}

      {subTab === "locked" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {locked.map((a) => (
            <LockedCard key={a.achievement_id} achievement={a} />
          ))}
        </div>
      )}
    </div>
  );
}
