import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getCheckinStatus, claimCheckin } from "../services/achievementService";

// Lives on the Homepage only (per design). Server truth (`last_login_date`
// in user_streaks) is what actually decides visibility — once claimed today,
// getCheckinStatus() returns alreadyCheckedIn: true until the date rolls
// over server-side, so a fresh page load after midnight naturally shows it
// again with no client-side timers needed.
export default function DailyCheckinButton() {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const [justEarned, setJustEarned] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;
    getCheckinStatus()
      .then((res) => setStatus(res.data))
      .catch(() => setStatus(null));
  }, [isAuthenticated]);

  if (!isAuthenticated || !status) return null;
  // Already claimed today on a prior visit (fresh page load), and not something
  // we just claimed this session — nothing to show. Reappears automatically
  // once the server-side date rolls over past midnight.
  if (status.alreadyCheckedIn && !justClaimed) return null;

  const handleClaim = async () => {
    setClaiming(true);
    setError("");
    try {
      const res = await claimCheckin();
      setStatus({
        alreadyCheckedIn: true,
        currentStreak: res.data.currentStreak,
        longestStreak: res.data.longestStreak,
      });
      setJustClaimed(true);
      setJustEarned(res.data.newlyEarnedAchievements || []);
    } catch {
      setError("Couldn't claim right now — try again.");
    } finally {
      setClaiming(false);
    }
  };

  if (justClaimed) {
    return (
      <div className="card flex flex-col sm:flex-row items-center justify-between gap-4 !py-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <span className="text-3xl">✅</span>
          <div>
            <p className="font-display font-bold text-white">
              Streak claimed — Day {status.currentStreak}!
            </p>
            <p className="text-xs text-gray-400">
              {justEarned.length > 0
                ? `Unlocked: ${justEarned.map((a) => a.name).join(", ")}`
                : "Come back tomorrow to keep it going."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card flex flex-col sm:flex-row items-center justify-between gap-4 !py-5">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🔥</span>
        <div>
          <p className="font-display font-bold text-white">
            Claim today's login streak
          </p>
          <p className="text-xs text-gray-400">
            Current streak: {status.currentStreak} day{status.currentStreak === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <button
        onClick={handleClaim}
        disabled={claiming}
        className="btn-primary shadow-red-glow !px-6 !py-2.5 rounded-full whitespace-nowrap"
      >
        {claiming ? "Claiming..." : `Claim Day ${status.currentStreak + 1}`}
      </button>

      {error && <p className="text-red-light text-xs">{error}</p>}
    </div>
  );
}
