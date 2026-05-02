import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/games", label: "Games" },
  { to: "/tournament", label: "The Arena" },
  { to: "/teamfinder", label: "LFG Hub" },
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
      <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
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
      <span className="theme-toggle__knob" style={{ color: isDark ? "#e2e8f0" : "#f59e0b" }}>
        {isDark ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}

/* ── Small avatar — shows profile pic or initial ── */
function NavAvatar({ user }) {
  const [imgErr, setImgErr] = useState(false);
  const pic = user?.profile_picture;

  useEffect(() => { setImgErr(false); }, [pic]);

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
                  borderColor: dropdownOpen ? "rgba(255,70,85,0.3)" : "transparent",
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
                  className={"w-4 h-4 transition-transform duration-200 " + (dropdownOpen ? "rotate-180" : "")}
                  style={{ color: dropdownOpen ? "var(--red)" : "var(--text-muted)" }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                        {user?.username}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Online</p>
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className={dropdownItemBase}
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,70,85,0.06)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                    >
                      <svg className="w-4 h-4" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Player Card
                    </Link>

                    {user?.isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className={dropdownItemBase + " text-yellow-500"}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(234,179,8,0.06)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <span className="text-base">⚡</span>
                        Admin Panel
                      </Link>
                    )}

                    <div className="border-t my-1" style={{ borderColor: "var(--border-color)" }} />

                    <button
                      onClick={handleLogout}
                      className={dropdownItemBase + " w-full"}
                      style={{ color: "var(--red)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,70,85,0.08)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
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
            style={{ borderColor: "transparent", color: "var(--text-secondary)" }}
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
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="lg:hidden border-t px-4 py-3 flex flex-col gap-1 animate-fade-in"
          style={{ background: "var(--nav-bg)", borderColor: "var(--border-color)" }}
        >
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                "px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border " +
                (isActive ? "border-red/30" : "border-transparent hover:border-red/25")
              }
              style={({ isActive }) => ({
                background: isActive ? "var(--bg-card)" : "transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              })}
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}
