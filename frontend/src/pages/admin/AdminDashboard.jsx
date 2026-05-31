/**
 * AdminDashboard.jsx
 * Place at: src/pages/admin/AdminDashboard.jsx
 *
 * Tabs:
 *  1. Overview   — live platform stats cards
 *  2. Users      — searchable table with ban / unban / rename
 *  3. Content    — delete any post / comment / tournament / team / team-finder listing
 *  4. Archives   — link through to existing AdminArchiveDashboard
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// ─── API helper (mirrors pattern in AdminArchiveDashboard) ────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "/api";
const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  });

  // Guard against empty/non-JSON bodies (e.g. browser-aborted requests mid-navigation,
  // or unexpected server responses). Without this, res.json() throws a cryptic
  // "Unexpected end of JSON input" SyntaxError that swallows the real error.
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server returned an empty or invalid response (HTTP ${res.status})`);
  }

  if (!res.ok) throw new Error(data.message ?? "Request failed");
  return data;
};

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-display font-bold text-white mb-2">
            Access Denied
          </h1>
          <p className="text-gray-400 mb-6">
            You don't have permission to view this page.
          </p>
          <button className="btn-primary" onClick={() => navigate("/")}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "users", label: "Users", icon: "👥" },
    { id: "content", label: "Content", icon: "🗂️" },
    { id: "archives", label: "Archives", icon: "🗄️" },
  ];

  return (
    <div className="min-h-screen bg-navy text-white">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl animate-fade-in"
          style={{ background: toast.ok ? "#16a34a" : "#dc2626" }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="border-b border-surface-border bg-surface sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red/20 border border-red/30 flex items-center justify-center text-lg">
              ⚡
            </div>
            <div>
              <h1 className="font-display font-bold text-xl text-white tracking-wide">
                Admin Control Panel
              </h1>
              <p className="text-xs text-gray-500">
                Signed in as <span className="text-red">{user.username}</span>
              </p>
            </div>
          </div>
          <button className="btn-ghost text-sm" onClick={() => navigate("/")}>
            ← Back to Site
          </button>
        </div>

        {/* Tab Bar */}
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === "archives") return navigate("/admin/archives");
                setTab(t.id);
              }}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-150 ${
                tab === t.id
                  ? "border-red text-red"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {tab === "overview" && <OverviewTab showToast={showToast} />}
        {tab === "users" && <UsersTab showToast={showToast} />}
        {tab === "content" && <ContentTab showToast={showToast} />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════
function OverviewTab({ showToast }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/admin/stats")
      .then((d) => setStats(d.stats))
      .catch((e) => showToast(`Failed to load stats: ${e.message}`, false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingGrid />;
  if (!stats) return null;

  const cards = [
    {
      label: "Total Users",
      value: stats.users.total.toLocaleString(),
      sub: `+${stats.users.newToday} today`,
      icon: "👥",
      color: "#3b82f6",
      accent: "rgba(59,130,246,0.15)",
    },
    {
      label: "Active Users",
      value: stats.users.active.toLocaleString(),
      sub: `${stats.users.banned} banned`,
      icon: "✅",
      color: "#22c55e",
      accent: "rgba(34,197,94,0.15)",
    },
    {
      label: "Tournaments",
      value: stats.tournaments.total.toLocaleString(),
      sub: `${stats.tournaments.active} active`,
      icon: "🏆",
      color: "#f97316",
      accent: "rgba(249,115,22,0.15)",
    },
    {
      label: "Teams",
      value: stats.teams.toLocaleString(),
      sub: "registered teams",
      icon: "🛡️",
      color: "#a855f7",
      accent: "rgba(168,85,247,0.15)",
    },
    {
      label: "Community Posts",
      value: stats.posts.total.toLocaleString(),
      sub: `+${stats.posts.today} today`,
      icon: "💬",
      color: "#ec4899",
      accent: "rgba(236,72,153,0.15)",
    },
    {
      label: "Live Streams",
      value: stats.liveStreams.toLocaleString(),
      sub: "right now",
      icon: "📡",
      color: "#ff4655",
      accent: "rgba(255,70,85,0.15)",
    },
    {
      label: "Team Finder",
      value: stats.openTeamFinderPosts.toLocaleString(),
      sub: "open listings",
      icon: "🔍",
      color: "#eab308",
      accent: "rgba(234,179,8,0.15)",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="section-title">Platform Overview</h2>
        <p className="section-subtitle">Live stats — refreshed on page load</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="card relative overflow-hidden"
            style={{ borderColor: card.color + "33" }}
          >
            {/* Glow blob */}
            <div
              className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-60"
              style={{ background: card.accent }}
            />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{card.icon}</span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    color: card.color,
                    background: card.accent,
                  }}
                >
                  LIVE
                </span>
              </div>
              <div
                className="text-3xl font-display font-bold mb-1"
                style={{ color: card.color }}
              >
                {card.value}
              </div>
              <div className="text-xs text-gray-500 font-medium">
                {card.label}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">{card.sub}</div>
            </div>
          </div>
        ))}

        {/* Banned users warning card */}
        {stats.users.banned > 0 && (
          <div className="card border-red/30 relative overflow-hidden col-span-2 md:col-span-1">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-40 bg-red/30" />
            <div className="relative flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red/20 border border-red/30 flex items-center justify-center text-2xl flex-shrink-0">
                🚫
              </div>
              <div>
                <div className="text-3xl font-display font-bold text-red">
                  {stats.users.banned}
                </div>
                <div className="text-xs text-gray-400 font-medium">
                  Banned Accounts
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  Review in Users tab
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="mt-10">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              label: "View All Users",
              desc: "Search, ban, rename",
              icon: "👥",
              tab: "users",
            },
            {
              label: "Moderate Content",
              desc: "Delete posts & tournaments",
              icon: "🗂️",
              tab: "content",
            },
            {
              label: "Browse Archives",
              desc: "Inspect & restore data",
              icon: "🗄️",
              tab: "archives",
            },
          ].map((a) => (
            <button
              key={a.label}
              className="card-hover flex items-center gap-4 text-left"
              onClick={() =>
                a.tab === "archives"
                  ? window.location.assign("/admin/archives")
                  : (() => {})()
              }
            >
              <div className="text-2xl">{a.icon}</div>
              <div>
                <div className="text-sm font-semibold text-white">
                  {a.label}
                </div>
                <div className="text-xs text-gray-500">{a.desc}</div>
              </div>
              <span className="ml-auto text-gray-600">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — USERS
// ══════════════════════════════════════════════════════════════════════════════
function UsersTab({ showToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [renameModal, setRename] = useState(null); // { user_id, username }
  const [newUsername, setNewUsername] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banModal, setBanModal] = useState(null); // user object
  const PAGE = 20;
  const debounceRef = useRef(null);

  const fetchUsers = useCallback(
    async (q, status, pg) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: PAGE,
          offset: pg * PAGE,
          ...(status ? { status } : {}),
          ...(q ? { q } : {}),
        });
        const data = await apiFetch(`/admin/users?${params}`);
        setUsers(data.users || []);
      } catch (e) {
        showToast(e.message, false);
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => fetchUsers(query, statusFilter, page),
      300,
    );
  }, [query, statusFilter, page, fetchUsers]);

  const handleBan = async () => {
    try {
      await apiFetch(`/admin/users/${banModal.user_id}/ban`, {
        method: "PATCH",
        body: JSON.stringify({ reason: banReason || "Banned by admin" }),
      });
      showToast(`@${banModal.username} has been banned`);
      setBanModal(null);
      setBanReason("");
      fetchUsers(query, statusFilter, page);
    } catch (e) {
      showToast(e.message, false);
    }
  };

  const handleUnban = async (u) => {
    if (!window.confirm(`Unban @${u.username}?`)) return;
    try {
      await apiFetch(`/admin/users/${u.user_id}/unban`, { method: "PATCH" });
      showToast(`@${u.username} has been unbanned`);
      fetchUsers(query, statusFilter, page);
    } catch (e) {
      showToast(e.message, false);
    }
  };

  const handleRename = async () => {
    try {
      await apiFetch(`/admin/users/${renameModal.user_id}/username`, {
        method: "PATCH",
        body: JSON.stringify({ username: newUsername }),
      });
      showToast(`Username updated to @${newUsername}`);
      setRename(null);
      setNewUsername("");
      fetchUsers(query, statusFilter, page);
    } catch (e) {
      showToast(e.message, false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">User Management</h2>
          <p className="section-subtitle">
            Search, ban, unban, or rename users
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          className="input max-w-xs"
          placeholder="Search username or email…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          className="input w-40"
          value={statusFilter}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
        <button
          className="btn-secondary"
          onClick={() => fetchUsers(query, statusFilter, page)}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingRows />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy border-b border-surface-border">
              <tr>
                {[
                  "User",
                  "Email",
                  "Country",
                  "Status",
                  "Joined",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-600">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.user_id}
                    className="border-b border-surface-border/50 hover:bg-surface-card/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {u.profile_picture ? (
                          <img
                            src={u.profile_picture}
                            className="w-8 h-8 rounded-full object-cover border border-surface-border"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-surface-card border border-surface-border flex items-center justify-center text-xs font-bold text-gray-400">
                            {u.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-white">
                            @{u.username}
                          </div>
                          <div className="text-xs text-gray-600">
                            ID: {u.user_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {u.country || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          u.status === "banned" ? "badge-red" : "badge-green"
                        }
                      >
                        {u.status === "banned" ? "🚫 Banned" : "✅ Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {fmt(u.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {u.status === "banned" ? (
                          <button
                            className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors font-semibold"
                            onClick={() => handleUnban(u)}
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            className="text-xs px-3 py-1.5 rounded-lg bg-red/10 border border-red/30 text-red hover:bg-red/20 transition-colors font-semibold"
                            onClick={() => {
                              setBanModal(u);
                              setBanReason("");
                            }}
                          >
                            Ban
                          </button>
                        )}
                        <button
                          className="text-xs px-3 py-1.5 rounded-lg bg-surface-card border border-surface-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors font-semibold"
                          onClick={() => {
                            setRename(u);
                            setNewUsername(u.username);
                          }}
                        >
                          Rename
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <Pagination
        page={page}
        setPage={setPage}
        count={users.length}
        pageSize={PAGE}
      />

      {/* Ban Modal */}
      {banModal && (
        <Modal onClose={() => setBanModal(null)}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red/20 border border-red/30 flex items-center justify-center text-xl">
                🚫
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-lg">
                  Ban User
                </h3>
                <p className="text-xs text-gray-400">@{banModal.username}</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              This will immediately block the user from logging in and
              connecting via WebSocket.
            </p>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Reason (optional)
            </label>
            <input
              className="input mt-2 mb-5"
              placeholder="e.g. Harassment, spam, inappropriate content…"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button
                className="btn-secondary"
                onClick={() => setBanModal(null)}
              >
                Cancel
              </button>
              <button
                className="px-5 py-2.5 rounded-lg bg-red font-semibold text-white hover:bg-red-dark transition-colors"
                onClick={handleBan}
              >
                Confirm Ban
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <Modal onClose={() => setRename(null)}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xl">
                ✏️
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-lg">
                  Rename User
                </h3>
                <p className="text-xs text-gray-400">
                  Currently: @{renameModal.username}
                </p>
              </div>
            </div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              New Username
            </label>
            <input
              className="input mt-2 mb-5"
              placeholder="3–30 chars, letters/numbers/underscore"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              maxLength={30}
            />
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setRename(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleRename}>
                Update Username
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — CONTENT MODERATION
// ══════════════════════════════════════════════════════════════════════════════
function ContentTab({ showToast }) {
  const [section, setSection] = useState("posts");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [deleting, setDeleting] = useState(null);
  const PAGE = 25;

  const SECTIONS = [
    {
      id: "posts",
      label: "Posts",
      icon: "💬",
      endpoint: "/communities/posts",
      listKey: "posts",
      idKey: "post_id",
      nameKey: "title",
    },
    {
      id: "tournaments",
      label: "Tournaments",
      icon: "🏆",
      endpoint: "/tournaments",
      listKey: "tournaments",
      idKey: "tournament_id",
      nameKey: "name",
    },
    {
      id: "teams",
      label: "Teams",
      icon: "🛡️",
      endpoint: "/teams/all",
      listKey: "teams",
      idKey: "team_id",
      nameKey: "name",
    },
    {
      id: "teamfinder",
      label: "Team Finder",
      icon: "🔍",
      endpoint: "/teamfinder",
      listKey: "posts",
      idKey: "post_id",
      nameKey: "title",
    },
    {
      id: "streams",
      label: "Streams",
      icon: "📡",
      endpoint: "/streams",
      listKey: "streams",
      idKey: "stream_id",
      nameKey: "title",
    },
  ];

  const current = SECTIONS.find((s) => s.id === section);

  const fetchItems = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: PAGE, offset: page * PAGE });
      const data = await apiFetch(`${current.endpoint}?${params}`);
      // Each section declares its own listKey — no guessing needed
      const list = data[current.listKey] || [];
      setItems(list);
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setLoading(false);
    }
  }, [section, page, current, showToast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const deleteItem = async (item) => {
    const id = item[current.idKey];
    const name = item[current.nameKey] || `ID ${id}`;
    if (!window.confirm(`Delete "${name}"?\nThis cannot be undone.`)) return;

    setDeleting(id);
    try {
      // Route to the correct admin delete endpoint
      const deleteEndpoints = {
        posts: `/communities/posts/${id}`,
        tournaments: `/tournaments/${id}`,
        teams: `/teams/${id}`,
        teamfinder: `/teamfinder/${id}`,
        streams: `/streams/${id}`,
      };
      const endpoint = deleteEndpoints[section];
      if (!endpoint) throw new Error("No delete endpoint for this section");
      await apiFetch(endpoint, { method: "DELETE" });
      showToast(`"${name}" has been removed`);
      setItems((prev) => prev.filter((i) => i[current.idKey] !== id));
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setDeleting(null);
    }
  };

  // Client-side filter on the fetched page
  const filtered = items.filter((item) => {
    if (!query) return true;
    const name = (item[current?.nameKey] || "").toLowerCase();
    const user = (item.username || item.created_by || "")
      .toString()
      .toLowerCase();
    return (
      name.includes(query.toLowerCase()) || user.includes(query.toLowerCase())
    );
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="section-title">Content Moderation</h2>
        <p className="section-subtitle">
          Browse and remove any content across the platform
        </p>
      </div>

      {/* Section pills */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setSection(s.id);
              setPage(0);
              setQuery("");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-150 ${
              section === s.id
                ? "bg-red/15 border-red/40 text-red"
                : "bg-surface-card border-surface-border text-gray-400 hover:text-white hover:border-gray-500"
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-5">
        <input
          className="input max-w-sm"
          placeholder={`Filter ${current?.label?.toLowerCase()}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn-secondary" onClick={fetchItems}>
          ↻ Refresh
        </button>
      </div>

      {/* Content list */}
      {loading ? (
        <LoadingRows />
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="card text-center py-16 text-gray-600">
              No {current?.label?.toLowerCase()} found
            </div>
          ) : (
            filtered.map((item) => {
              const id = item[current.idKey];
              const name = item[current.nameKey] || `Untitled (ID: ${id})`;
              const user =
                item.username ||
                item.captain_username ||
                item.organizer_name ||
                `User #${item.user_id || item.created_by || "?"}`;
              const date =
                item.created_at || item.start_date || item.stream_start;

              return (
                <div
                  key={id}
                  className="card flex items-center gap-4 py-3 hover:border-surface-border/80 transition-all"
                >
                  <div className="text-xl flex-shrink-0">{current.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm truncate">
                      {name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      by <span className="text-gray-400">@{user}</span>
                      {date && (
                        <span className="ml-2 text-gray-600">{fmt(date)}</span>
                      )}
                      {item.status && (
                        <span className="ml-2 badge-gray text-xs">
                          {item.status}
                        </span>
                      )}
                    </div>
                    {item.content && (
                      <div className="text-xs text-gray-600 mt-1 truncate max-w-xl">
                        {item.content}
                      </div>
                    )}
                  </div>
                  <button
                    disabled={deleting === id}
                    onClick={() => deleteItem(item)}
                    className="flex-shrink-0 px-4 py-2 rounded-lg bg-red/10 border border-red/30 text-red text-xs font-bold hover:bg-red/20 transition-colors disabled:opacity-40"
                  >
                    {deleting === id ? "Removing…" : "🗑 Remove"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      <Pagination
        page={page}
        setPage={setPage}
        count={filtered.length}
        pageSize={PAGE}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════
function Modal({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-md shadow-2xl animate-slide-up">
        {children}
      </div>
    </div>
  );
}

function Pagination({ page, setPage, count, pageSize }) {
  if (count < pageSize && page === 0) return null;
  return (
    <div className="flex items-center justify-center gap-4 mt-8">
      <button
        className="btn-secondary text-sm"
        disabled={page === 0}
        onClick={() => setPage((p) => p - 1)}
      >
        ← Prev
      </button>
      <span className="text-sm text-gray-500">Page {page + 1}</span>
      <button
        className="btn-secondary text-sm"
        disabled={count < pageSize}
        onClick={() => setPage((p) => p + 1)}
      >
        Next →
      </button>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="card h-28 animate-pulse bg-surface-card" />
      ))}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card h-16 animate-pulse bg-surface-card" />
      ))}
    </div>
  );
}
