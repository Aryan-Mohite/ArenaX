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
          background:
            "radial-gradient(ellipse at 50% 120%, rgba(255,70,85,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col items-center gap-6">
        {/* Logo mark + wordmark */}
        <div className="flex items-center gap-3">
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20 4L36 13V27L20 36L4 27V13L20 4Z"
              stroke="#ff4655"
              strokeWidth="1.5"
              fill="none"
              opacity="0.5"
            />
            <path
              d="M20 10L30 16V24L20 30L10 24V16L20 10Z"
              fill="#ff4655"
              fillOpacity="0.12"
            />
            <circle cx="20" cy="20" r="4" fill="#ff4655" />
            <line
              x1="20"
              y1="10"
              x2="20"
              y2="14"
              stroke="#ff4655"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="20"
              y1="26"
              x2="20"
              y2="30"
              stroke="#ff4655"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="10"
              y1="20"
              x2="14"
              y2="20"
              stroke="#ff4655"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="26"
              y1="20"
              x2="30"
              y2="20"
              stroke="#ff4655"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <div className="flex items-baseline gap-[2px] leading-none">
            <span
              className="font-display font-bold text-2xl tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Arena
            </span>
            <span
              className="font-display font-bold text-2xl tracking-tight"
              style={{ color: "#ff4655" }}
            >
              X
            </span>
          </div>
        </div>

        {/* Legal links */}
        <div className="flex items-center gap-5 flex-wrap justify-center">
          <Link
            to="/blog"
            className="text-xs transition-colors hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            Blog
          </Link>
          <span className="text-xs" style={{ color: "var(--border-color)" }}>
            |
          </span>
          <Link
            to="/faq"
            className="text-xs transition-colors hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            FAQ
          </Link>
          <span className="text-xs" style={{ color: "var(--border-color)" }}>
            |
          </span>
          <Link
            to="/terms"
            className="text-xs transition-colors hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            Terms &amp; Conditions
          </Link>
          <span className="text-xs" style={{ color: "var(--border-color)" }}>
            |
          </span>
          <Link
            to="/privacy"
            className="text-xs transition-colors hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            Privacy Policy
          </Link>
          <span className="text-xs" style={{ color: "var(--border-color)" }}>
            |
          </span>
          <a
            href="mailto:support@arenax.io"
            className="text-xs transition-colors hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            support@arenax.io
          </a>
        </div>

        {/* Social Media Links */}
        <div className="flex items-center gap-4">
          {/* Instagram */}
          <a
            href="https://www.instagram.com/arenax_gg/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow us on Instagram"
            title="Instagram"
            className="group flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-200"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-muted)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,70,85,0.4)";
              e.currentTarget.style.background = "rgba(255,70,85,0.06)";
              e.currentTarget.style.color = "#ff4655";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-color)";
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
          </a>

          {/* YouTube */}
          <a
            href="https://youtube.com/@ArenaX_gg"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Subscribe on YouTube"
            title="YouTube"
            className="group flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-200"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-muted)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,70,85,0.4)";
              e.currentTarget.style.background = "rgba(255,70,85,0.06)";
              e.currentTarget.style.color = "#ff4655";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-color)";
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </a>

          {/* X / Twitter */}
          <a
            href="https://x.com/Official_ArenaX"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow us on X"
            title="X (Twitter)"
            className="group flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-200"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-muted)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,70,85,0.4)";
              e.currentTarget.style.background = "rgba(255,70,85,0.06)";
              e.currentTarget.style.color = "#ff4655";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-color)";
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>

          {/* Discord */}
          <a
            href="https://discordapp.com/users/1517943851581571144"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join our Discord"
            title="Discord"
            className="group flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-200"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-muted)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,70,85,0.4)";
              e.currentTarget.style.background = "rgba(255,70,85,0.06)";
              e.currentTarget.style.color = "#ff4655";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-color)";
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 00-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 00-5.487 0 12.36 12.36 0 00-.617-1.23A.077.077 0 008.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 00-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 00.031.055 20.03 20.03 0 005.993 2.98.078.078 0 00.084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 01-1.872-.878.075.075 0 01-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 01.078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 01.079.009c.12.098.245.195.372.288a.075.075 0 01-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 00-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 00.084.028 19.963 19.963 0 006.002-2.981.076.076 0 00.032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 00-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
            </svg>
          </a>

          {/* Twitch */}
          <a
            href="https://www.twitch.tv/arenaxxtreme"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Watch us on Twitch"
            title="Twitch"
            className="group flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-200"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-muted)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,70,85,0.4)";
              e.currentTarget.style.background = "rgba(255,70,85,0.06)";
              e.currentTarget.style.color = "#ff4655";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-color)";
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
            </svg>
          </a>
        </div>

        {/* Thin divider */}
        <div
          className="w-16 h-px"
          style={{ background: "var(--border-color)" }}
        />

        {/* Copyright */}
        <p
          className="text-sm text-center"
          style={{ color: "var(--text-secondary)" }}
        >
          Copyright © {new Date().getFullYear()} ArenaX. All Rights Reserved.
        </p>

        {/* Disclaimer */}
        <p
          className="text-xs text-center max-w-xl leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          ArenaX is an independent eSports platform. All trademarks, game names,
          and logos are the property of their respective owners. Prize pools are
          subject to tournament rules.
        </p>
      </div>
    </footer>
  );
}
