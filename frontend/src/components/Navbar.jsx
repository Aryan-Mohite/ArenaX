import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/games", label: "Games" },
  { to: "/tournament", label: "The Arena" },
  { to: "/teamfinder", label: "TeamUP Arena" },
  { to: "/stream", label: "Spectate" },
  { to: "/communities", label: "The Nexus" },
  { to: "/about", label: "About" },
];

/* ── Moon icon (dark mode) ── */
function MoonIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

/* ── Sun icon (light mode) ── */
function SunIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
      <line
        x1="12"
        y1="1"
        x2="12"
        y2="3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="12"
        y1="21"
        x2="12"
        y2="23"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="4.22"
        y1="4.22"
        x2="5.64"
        y2="5.64"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="18.36"
        y1="18.36"
        x2="19.78"
        y2="19.78"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="1"
        y1="12"
        x2="3"
        y2="12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="21"
        y1="12"
        x2="23"
        y2="12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="4.22"
        y1="19.78"
        x2="5.64"
        y2="18.36"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="18.36"
        y1="5.64"
        x2="19.78"
        y2="4.22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── Animated Theme Toggle ── */
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`theme-toggle ${theme}`}
      style={{ cursor: "none" }}
    >
      <span
        className="theme-toggle__knob"
        style={{ color: isDark ? "#e2e8f0" : "#f59e0b" }}
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}

/* ── Small avatar — shows profile pic or initial ── */
function NavAvatar({ user }) {
  const [imgErr, setImgErr] = useState(false);
  const pic = user?.profile_picture;

  useEffect(() => {
    setImgErr(false);
  }, [pic]);

  if (pic && !imgErr) {
    return (
      <img
        src={pic}
        alt={user?.username}
        onError={() => setImgErr(true)}
        className="w-8 h-8 rounded-full object-cover border border-red/40 ring-1 ring-red/20"
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-red/20 border border-red/40 flex items-center justify-center text-red font-bold text-sm select-none">
      {user?.username?.[0]?.toUpperCase() || "U"}
    </div>
  );
}

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isLight = theme === "light";

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate("/");
  };

  /* Dynamic class helpers based on theme */
  const navLinkBase = (isActive) =>
    "relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 group " +
    (isActive
      ? `text-[var(--text-primary)] bg-[var(--bg-card)] border border-red/30`
      : `text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-red/25 hover:bg-[var(--bg-card)]`);

  const dropdownItemBase =
    "flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors group";

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        background: "var(--nav-bg)",
        borderBottomColor: "var(--border-color)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        transition: "background-color 0.3s ease, border-color 0.3s ease",
      }}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <Link
          to="/"
          className="font-display font-bold text-xl tracking-widest flex items-center gap-2 shrink-0"
        >
          <span className="text-gradient">ARENA</span>
          <span style={{ color: "var(--text-primary)" }}>X</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-0.5">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => navLinkBase(isActive)}
            >
              {({ isActive }) => (
                <>
                  {label}
                  <span
                    className={
                      "absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-red transition-all duration-200 " +
                      (isActive
                        ? "w-4/5 opacity-100"
                        : "w-0 opacity-0 group-hover:w-3/5 group-hover:opacity-60")
                    }
                  />
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Right area: theme toggle + auth */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Theme Toggle */}
          <ThemeToggle />

          {!isAuthenticated ? (
            <>
              <Link
                to="/login"
                className="btn-ghost text-sm hidden sm:block border border-transparent hover:border-red/25 transition-all duration-200"
                style={{ color: "var(--text-secondary)" }}
              >
                Sign in
              </Link>
              <Link to="/register" className="btn-primary text-sm">
                Join the Battle
              </Link>
            </>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all duration-200 border"
                style={{
                  background: dropdownOpen ? "var(--bg-card)" : "transparent",
                  borderColor: dropdownOpen
                    ? "rgba(255,70,85,0.3)"
                    : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!dropdownOpen) {
                    e.currentTarget.style.background = "var(--bg-card)";
                    e.currentTarget.style.borderColor = "rgba(255,70,85,0.2)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!dropdownOpen) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "transparent";
                  }
                }}
              >
                <NavAvatar user={user} />
                <span
                  className="text-sm font-medium hidden sm:block max-w-[100px] truncate"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {user?.username}
                </span>
                <svg
                  className={
                    "w-4 h-4 transition-transform duration-200 " +
                    (dropdownOpen ? "rotate-180" : "")
                  }
                  style={{
                    color: dropdownOpen ? "var(--red)" : "var(--text-muted)",
                  }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div
                  className="absolute right-0 top-12 w-52 rounded-xl border overflow-hidden animate-fade-in"
                  style={{
                    background: "var(--bg-card)",
                    borderColor: "var(--border-color)",
                    boxShadow: "var(--shadow-dropdown)",
                  }}
                >
                  {/* User info header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 border-b"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <NavAvatar user={user} />
                    <div className="min-w-0">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {user?.username}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Online
                      </p>
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className={dropdownItemBase}
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(255,70,85,0.06)";
                        e.currentTarget.style.color = "var(--text-primary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }}
                    >
                      <svg
                        className="w-4 h-4"
                        style={{ color: "var(--text-muted)" }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      Player Card
                    </Link>

                    {user?.isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className={dropdownItemBase + " text-yellow-500"}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            "rgba(234,179,8,0.06)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <span className="text-base">⚡</span>
                        Admin Panel
                      </Link>
                    )}

                    <div
                      className="border-t my-1"
                      style={{ borderColor: "var(--border-color)" }}
                    />

                    <button
                      onClick={handleLogout}
                      className={dropdownItemBase + " w-full"}
                      style={{ color: "var(--red)" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(255,70,85,0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      GG · Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            className="lg:hidden p-2 rounded-lg border transition-all duration-200"
            style={{
              borderColor: "transparent",
              color: "var(--text-secondary)",
            }}
            onClick={() => setMobileOpen(!mobileOpen)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,70,85,0.25)";
              e.currentTarget.style.background = "var(--bg-card)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "transparent";
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="lg:hidden border-t px-4 py-3 flex flex-col gap-1 animate-fade-in"
          style={{
            background: "var(--nav-bg)",
            borderColor: "var(--border-color)",
          }}
        >
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                "px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border " +
                (isActive
                  ? "border-red/30"
                  : "border-transparent hover:border-red/25")
              }
              style={({ isActive }) => ({
                background: isActive ? "var(--bg-card)" : "transparent",
                color: isActive
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
              })}
            >
              {label}
            </NavLink>
          ))}

          {/* Social links row in mobile menu */}
          <div
            className="flex items-center gap-3 pt-2 pb-1 px-1 border-t mt-1"
            style={{ borderColor: "var(--border-color)" }}
          >
            <span
              className="text-xs mr-1"
              style={{ color: "var(--text-muted)" }}
            >
              Follow us:
            </span>
            {[
              {
                href: "https://instagram.com/arenax.gg",
                label: "Instagram",
                icon: (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                ),
              },
              {
                href: "https://youtube.com/@arenax",
                label: "YouTube",
                icon: (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                ),
              },
              {
                href: "https://discord.gg/arenax",
                label: "Discord",
                icon: (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 00-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 00-5.487 0 12.36 12.36 0 00-.617-1.23A.077.077 0 008.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 00-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 00.031.055 20.03 20.03 0 005.993 2.98.078.078 0 00.084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 01-1.872-.878.075.075 0 01-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 01.078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 01.079.009c.12.098.245.195.372.288a.075.075 0 01-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 00-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 00.084.028 19.963 19.963 0 006.002-2.981.076.076 0 00.032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 00-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
                  </svg>
                ),
              },
              {
                href: "https://x.com/arenax_gg",
                label: "X",
                icon: (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                ),
              },
              {
                href: "https://twitch.tv/arenax",
                label: "Twitch",
                icon: (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                  </svg>
                ),
              },
            ].map(({ href, label, icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className="flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-200"
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
                {icon}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
