import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/games", label: "Games" },
  { to: "/tournament", label: "Tournaments" },
  { to: "/teamfinder", label: "Team Finder" },
  { to: "/stream", label: "Stream" },
  { to: "/communities", label: "Communities" },
];

// ── Small avatar — shows profile pic or initial ───────────────────────────────
function NavAvatar({ user }) {
  const [imgErr, setImgErr] = useState(false);
  const pic = user?.profile_picture;

  // Reset error state if picture URL changes (user just updated it)
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
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  return (
    <header className="sticky top-0 z-50 border-b border-surface-border bg-navy/90 backdrop-blur-md">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <Link
          to="/"
          className="font-display font-bold text-xl tracking-widest flex items-center gap-2 shrink-0"
        >
          <span className="text-gradient">ARENA</span>
          <span className="text-white">X</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-0.5">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                "relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 group " +
                (isActive
                  ? "text-white bg-surface-card border border-red/30"
                  : "text-gray-400 hover:text-white border border-transparent hover:border-red/25 hover:bg-surface-card")
              }
            >
              {({ isActive }) => (
                <>
                  {label}
                  {/* Red underline bar — slides in on hover/active */}
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

        {/* Auth area */}
        <div className="flex items-center gap-2 shrink-0">
          {!isAuthenticated ? (
            <>
              <Link
                to="/login"
                className="btn-ghost text-sm hidden sm:block border border-transparent hover:border-red/25 transition-all duration-200"
              >
                Sign in
              </Link>
              <Link to="/register" className="btn-primary text-sm">
                Get Started
              </Link>
            </>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={
                  "flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all duration-200 border " +
                  (dropdownOpen
                    ? "bg-surface-card border-red/30"
                    : "border-transparent hover:bg-surface-card hover:border-red/20")
                }
              >
                <NavAvatar user={user} />
                <span className="text-sm font-medium text-gray-300 hidden sm:block max-w-[100px] truncate">
                  {user?.username}
                </span>
                <svg
                  className={
                    "w-4 h-4 text-gray-500 transition-transform duration-200 " +
                    (dropdownOpen ? "rotate-180 text-red" : "")
                  }
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
                <div className="absolute right-0 top-12 w-52 rounded-xl border border-surface-border bg-surface-card shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-fade-in overflow-hidden">
                  {/* User info header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
                    <NavAvatar user={user} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {user?.username}
                      </p>
                      <p className="text-xs text-gray-500">Logged in</p>
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-red/8 transition-colors group"
                    >
                      <svg
                        className="w-4 h-4 text-gray-500 group-hover:text-red transition-colors"
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
                      My Profile
                    </Link>

                    <div className="border-t border-surface-border my-1" />

                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red hover:bg-red/10 transition-colors"
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
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            className="lg:hidden p-2 rounded-lg border border-transparent hover:border-red/25 hover:bg-surface-card text-gray-400 hover:text-white transition-all duration-200"
            onClick={() => setMobileOpen(!mobileOpen)}
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
        <div className="lg:hidden border-t border-surface-border bg-navy/95 backdrop-blur-md px-4 py-3 flex flex-col gap-1 animate-fade-in">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                "px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border " +
                (isActive
                  ? "text-white bg-surface-card border-red/30"
                  : "text-gray-400 hover:text-white hover:bg-surface-card border-transparent hover:border-red/20")
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}
