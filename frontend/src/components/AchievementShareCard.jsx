import { useRef, useState } from "react";
import { toPng } from "html-to-image";

const ICONS = {
  streak_7: "🔥", streak_30: "🔥", streak_100: "🔥", streak_200: "🔥", streak_500: "🔥",
  squad_up: "🛡️",
  nexus_1: "📡", nexus_10: "📡", nexus_100: "📡",
  dna_1: "🧬", dna_5: "🧬", dna_10: "🧬", dna_25: "🧬", dna_50: "🧬", dna_100: "🧬",
};

function formatDate(iso) {
  if (!iso) return new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AchievementShareCard({ achievement, username, onClose }) {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const captureImage = async () => {
    if (!cardRef.current) return null;
    // pixelRatio bumps export resolution without needing a bigger on-screen card
    return toPng(cardRef.current, { pixelRatio: 3, cacheBust: true });
  };

  const handleDownload = async () => {
    setBusy(true);
    setError("");
    try {
      const dataUrl = await captureImage();
      const link = document.createElement("a");
      link.download = `arenax-${achievement.achievement_key}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError("Couldn't generate the image. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    setError("");
    try {
      const dataUrl = await captureImage();
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `arenax-${achievement.achievement_key}.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${achievement.name} — ArenaX`,
          text: `I just unlocked "${achievement.name}" on ArenaX!`,
        });
      } else {
        // Fallback for desktop browsers without file-sharing support
        const link = document.createElement("a");
        link.download = `arenax-${achievement.achievement_key}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      if (err?.name !== "AbortError") setError("Couldn't share the image. Try downloading instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(10px)", background: "rgba(2,6,23,0.85)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-surface-border overflow-hidden animate-slide-up flex flex-col"
        style={{
          background: "linear-gradient(145deg,#1a2340,#0f172a)",
          boxShadow: "0 0 0 1px rgba(255,70,85,0.15), 0 32px 80px rgba(0,0,0,0.75)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <p className="font-display font-bold text-white">Share achievement</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col items-center gap-4">
          {/* ── The actual shareable card ── */}
          <div
            ref={cardRef}
            className="w-[300px] h-[375px] rounded-xl flex flex-col items-center justify-center px-6 py-8 text-center relative overflow-hidden"
            style={{
              background: "linear-gradient(160deg,#1a2340 0%,#0d0f20 60%,#130a1a 100%)",
              boxShadow: "0 0 0 1px rgba(255,70,85,0.25)",
            }}
          >
            <div
              className="absolute inset-0"
              style={{ background: "radial-gradient(ellipse at 50% 20%, rgba(255,70,85,0.25) 0%, transparent 65%)" }}
            />
            <p className="relative text-[11px] tracking-[0.2em] text-red-light font-bold uppercase mb-6">
              ArenaX
            </p>
            <span className="relative text-6xl mb-4">{ICONS[achievement.icon] || "🏆"}</span>
            <p className="relative font-display font-bold text-white text-xl leading-tight px-2">
              {achievement.name}
            </p>
            <p className="relative text-xs text-gray-400 mt-2 px-4">{achievement.description}</p>
            <div className="relative mt-6 pt-4 border-t border-white/10 w-full">
              <p className="text-xs text-gray-500">
                {username ? `@${username}` : "ArenaX Player"} · {formatDate(achievement.earned_at)}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">arenax.io</p>
            </div>
          </div>

          {error && <p className="text-red-light text-xs">{error}</p>}

          <div className="flex gap-2 w-full">
            <button onClick={handleDownload} disabled={busy} className="btn-secondary flex-1 text-sm">
              {busy ? "Working..." : "Download"}
            </button>
            <button onClick={handleShare} disabled={busy} className="btn-primary flex-1 text-sm">
              {busy ? "Working..." : "Share"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
