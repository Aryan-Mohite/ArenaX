import { useRef, useState, useEffect } from "react";
import { toPng } from "html-to-image";
import QRCode from "qrcode";

function formatTime(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function DailiesShareCard({ game, shareData, onClose }) {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState(null);

  // Generate the QR (arenax.io/dailies shortlink) once, up front — it has to
  // be a real <img src> already loaded before html-to-image snapshots the DOM.
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL("https://arenax.io/dailies", {
      width: 160,
      margin: 1,
      color: { dark: "#ffffff", light: "#00000000" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const captureImage = async () => {
    if (!cardRef.current) return null;
    // pixelRatio bumps export resolution without needing a bigger on-screen card
    return toPng(cardRef.current, { pixelRatio: 3, cacheBust: true, backgroundColor: "#05070d" });
  };

  const fileName = `arenax-dailies-${game.slug || game.game_id}.png`;

  const handleDownload = async () => {
    setBusy(true);
    setError("");
    try {
      const dataUrl = await captureImage();
      const link = document.createElement("a");
      link.download = fileName;
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
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${game.game_name} Dailies — ArenaX`,
          text: `${shareData.correct_count}/${shareData.total_questions} on today's ${game.game_name} Dailies quiz — Top ${shareData.top_percentile}%!`,
        });
      } else {
        const link = document.createElement("a");
        link.download = fileName;
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
      style={{ backdropFilter: "blur(10px)", background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border overflow-hidden flex flex-col"
        style={{ borderColor: "rgba(255,70,85,0.3)", background: "#070b14", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="font-display font-bold text-white text-sm">Share Rank</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col items-center gap-4">
          {/* ── The actual capturable card ── */}
          <div
            ref={cardRef}
            className="w-[300px] h-[420px] flex flex-col items-center px-6 py-7 text-center relative overflow-hidden"
            style={{
              background: "linear-gradient(165deg, #0a0e1a 0%, #05070d 70%)",
              boxShadow: "0 0 0 1px rgba(255,70,85,0.3)",
              clipPath: "polygon(0 0, 100% 0, 100% 96%, 96% 100%, 0 100%)",
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,70,85,0.28) 0%, transparent 60%)" }}
            />

            {/* Branding */}
            <p className="relative text-[11px] tracking-[0.25em] font-bold uppercase mb-1" style={{ color: "#ff6b77" }}>
              ArenaX · Dailies
            </p>
            <div className="relative flex items-center gap-2 mb-6">
              {game.icon && (
                <img
                  src={game.icon}
                  alt=""
                  crossOrigin="anonymous"
                  className="w-6 h-6 rounded object-cover"
                  style={{ border: "1px solid rgba(255,255,255,0.15)" }}
                />
              )}
              <p className="text-white font-semibold text-sm">{game.game_name}</p>
            </div>

            {/* Score badge */}
            <div
              className="relative w-24 h-24 flex items-center justify-center mb-4 font-display font-bold text-3xl text-white"
              style={{
                background: "linear-gradient(135deg, #ff4655, #991018)",
                clipPath: "polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)",
                boxShadow: "0 0 30px rgba(255,70,85,0.55)",
              }}
            >
              {shareData.correct_count}/{shareData.total_questions}
            </div>

            <p className="relative text-sm text-gray-300 mb-1">{formatTime(shareData.total_time_ms)}</p>
            <p className="relative text-xs font-bold uppercase tracking-wide mb-5" style={{ color: "#ff6b77" }}>
              Top {shareData.top_percentile}% Today
            </p>

            {shareData.current_streak > 0 && (
              <p className="relative text-sm text-white mb-4">🔥 {shareData.current_streak} Day Streak</p>
            )}

            {/* QR + shortlink */}
            <div className="relative mt-auto pt-4 border-t w-full flex items-center justify-center gap-3" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              {qrDataUrl && <img src={qrDataUrl} alt="" className="w-12 h-12" />}
              <div className="text-left">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Play today's quiz</p>
                <p className="text-xs text-gray-300 font-mono">arenax.io/dailies</p>
              </div>
            </div>
          </div>

          {error && <p className="text-xs" style={{ color: "#ff6b77" }}>{error}</p>}

          <div className="flex gap-2 w-full">
            <button
              onClick={handleDownload}
              disabled={busy || !qrDataUrl}
              className="flex-1 py-2.5 rounded-md font-semibold text-sm border disabled:opacity-50"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "#c7c7c7" }}
            >
              {busy ? "Working…" : "Download"}
            </button>
            <button
              onClick={handleShare}
              disabled={busy || !qrDataUrl}
              className="flex-1 py-2.5 rounded-md font-bold text-sm text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #ff4655, #cc2233)" }}
            >
              {busy ? "Working…" : "Share"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
