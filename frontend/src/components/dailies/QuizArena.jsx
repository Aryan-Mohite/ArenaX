import { useState, useEffect, useRef } from "react";

const DIFFICULTY_STYLES = {
  easy:   { label: "EASY",   color: "#4ade80" },
  medium: { label: "MEDIUM", color: "#facc15" },
  hard:   { label: "HARD",   color: "#ff4655" },
};

const OPTION_KEYS = ["a", "b", "c", "d"];
const LOW_TIME_THRESHOLD_MS = 4000;

/**
 * Render key MUST be question.question_id (parent enforces this) so every
 * new question gets a fresh timer/selection state instead of carrying over
 * stale local state from the previous question.
 */
export default function QuizArena({ question, onAnswer, onBlur, submitting }) {
  const initialMs = question.remaining_ms ?? question.time_limit_ms;
  const [remainingMs, setRemainingMs] = useState(initialMs);
  const [selected, setSelected] = useState(null);
  const hasReportedBlur = useRef(false);
  const hasAutoSubmitted = useRef(false);

  // Countdown — purely visual. The server independently enforces the real
  // 15s window, so a paused tab or clock drift here can't grant extra time.
  useEffect(() => {
    if (selected != null) return; // stop ticking once an answer is locked in
    const start = Date.now();
    const startingMs = remainingMs;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const next = Math.max(0, startingMs - elapsed);
      setRemainingMs(next);
      if (next <= 0) {
        clearInterval(interval);
        if (!hasAutoSubmitted.current && !hasReportedBlur.current) {
          hasAutoSubmitted.current = true;
          onAnswer(null);
        }
      }
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Anti-tab-switching: losing focus or hiding the tab instantly forfeits
  // the current question rather than waiting for the timer to run out.
  useEffect(() => {
    const forfeit = () => {
      if (hasReportedBlur.current || hasAutoSubmitted.current || selected != null) return;
      hasReportedBlur.current = true;
      onBlur();
    };
    const onVisibilityChange = () => {
      if (document.hidden) forfeit();
    };
    window.addEventListener("blur", forfeit);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", forfeit);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const handleSelect = (key) => {
    if (selected != null || submitting) return;
    setSelected(key);
    onAnswer(key);
  };

  const pct = Math.max(0, Math.min(100, (remainingMs / question.time_limit_ms) * 100));
  const isLowTime = remainingMs <= LOW_TIME_THRESHOLD_MS;
  const diff = DIFFICULTY_STYLES[question.difficulty] || DIFFICULTY_STYLES.easy;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
      <div
        className="w-full max-w-2xl rounded-lg border overflow-hidden"
        style={{ borderColor: "rgba(255,70,85,0.25)", background: "#0d1220" }}
      >
        {/* Timer HUD */}
        <div className="h-1.5 w-full bg-white/5">
          <div
            className="h-full transition-[width] duration-100 ease-linear"
            style={{
              width: `${pct}%`,
              background: isLowTime ? "#ff4655" : "linear-gradient(90deg, #ff4655, #ff6b77)",
              boxShadow: isLowTime ? "0 0 12px 2px rgba(255,70,85,0.8)" : "none",
            }}
          />
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <span
              className="text-[10px] font-bold tracking-widest px-2 py-1 rounded"
              style={{ color: diff.color, border: `1px solid ${diff.color}55`, background: `${diff.color}15` }}
            >
              [{diff.label}]
            </span>
            <span className="text-xs text-gray-500 font-medium">
              Question {question.index + 1} of {question.total}
            </span>
            <span
              className="text-sm font-mono font-bold tabular-nums"
              style={{ color: isLowTime ? "#ff4655" : "#fff" }}
            >
              {(remainingMs / 1000).toFixed(1)}s
            </span>
          </div>

          {question.media_url && (
            <img src={question.media_url} alt="" className="w-full rounded-md mb-4 border" style={{ borderColor: "rgba(255,255,255,0.08)" }} />
          )}

          <p className="text-lg text-white font-medium mb-6 leading-relaxed">{question.question_text}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OPTION_KEYS.map((key) => {
              const isSelected = selected === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSelect(key)}
                  disabled={selected != null || submitting}
                  className="text-left px-4 py-3 rounded-md border text-sm font-medium transition-all duration-150 disabled:cursor-default"
                  style={{
                    borderColor: isSelected ? "#ff4655" : "rgba(255,255,255,0.1)",
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(255,70,85,0.22), rgba(255,70,85,0.05))"
                      : "rgba(255,255,255,0.02)",
                    color: isSelected ? "#fff" : "#c7c7c7",
                  }}
                  onMouseEnter={(e) => {
                    if (selected == null) e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
                  }}
                  onMouseLeave={(e) => {
                    if (selected == null) e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  }}
                >
                  <span className="text-gray-500 mr-2 uppercase">{key}</span>
                  {question.options[key]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
