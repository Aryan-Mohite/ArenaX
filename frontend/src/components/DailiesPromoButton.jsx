import { useNavigate } from "react-router-dom";
import { useDailiesTransition } from "./dailies/DailiesTransition";

// Lives on the Homepage — Dailies was removed from the main nav, so this is
// now the primary entry point into the daily quiz. Reuses the same
// glitch/wipe transition the old nav link used to trigger.
export default function DailiesPromoButton() {
  const navigate = useNavigate();
  const { triggerTransition } = useDailiesTransition();

  const handleClick = (e) => {
    e.preventDefault();
    triggerTransition(() => navigate("/dailies"));
  };

  return (
    <div className="card flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-4 !py-4 sm:!py-5 text-center sm:text-left">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl sm:text-3xl shrink-0">🧠</span>
        <div className="min-w-0">
          <p className="font-display font-bold text-white text-sm sm:text-base">
            Today's Dailies quiz is live
          </p>
          <p className="text-xs text-gray-400">
            5 questions, one shot a day — test your game knowledge.
          </p>
        </div>
      </div>

      <button
        onClick={handleClick}
        className="btn-primary shadow-red-glow !px-6 !py-2.5 rounded-full whitespace-nowrap w-full sm:w-auto shrink-0"
      >
        Play Dailies
      </button>
    </div>
  );
}
