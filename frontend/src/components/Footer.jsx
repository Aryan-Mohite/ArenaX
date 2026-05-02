import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer
      className="relative overflow-hidden mt-16 border-t"
      style={{
        background: "var(--bg-card)",
        borderTopColor: "var(--border-color)",
        transition: "background-color 0.3s ease, border-color 0.3s ease",
      }}
    >
      {/* Subtle red glow from bottom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 120%, rgba(255,70,85,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col items-center gap-6">
        {/* Logo mark + wordmark */}
        <div className="flex items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 4L36 13V27L20 36L4 27V13L20 4Z" stroke="#ff4655" strokeWidth="1.5" fill="none" opacity="0.5" />
            <path d="M20 10L30 16V24L20 30L10 24V16L20 10Z" fill="#ff4655" fillOpacity="0.12" />
            <circle cx="20" cy="20" r="4" fill="#ff4655" />
            <line x1="20" y1="10" x2="20" y2="14" stroke="#ff4655" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20" y1="26" x2="20" y2="30" stroke="#ff4655" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="10" y1="20" x2="14" y2="20" stroke="#ff4655" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="26" y1="20" x2="30" y2="20" stroke="#ff4655" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div className="flex items-baseline gap-[2px] leading-none">
            <span className="font-display font-bold text-2xl tracking-tight" style={{ color: "var(--text-primary)" }}>
              Arena
            </span>
            <span className="font-display font-bold text-2xl tracking-tight" style={{ color: "#ff4655" }}>
              X
            </span>
          </div>
        </div>

        {/* Thin divider */}
        <div className="w-16 h-px" style={{ background: "var(--border-color)" }} />

        {/* Copyright */}
        <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
          Copyright © {new Date().getFullYear()} ArenaX. All Rights Reserved.
        </p>

        {/* Disclaimer */}
        <p className="text-xs text-center max-w-xl leading-relaxed" style={{ color: "var(--text-muted)" }}>
          ArenaX is an independent eSports platform. All trademarks, game names,
          and logos are the property of their respective owners. Prize pools are
          subject to tournament rules.
        </p>
      </div>
    </footer>
  );
}
