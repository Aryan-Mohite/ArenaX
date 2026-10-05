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
    { id: "billing", label: "Billing", icon: "💳" },
    { id: "organizers", label: "Organizers", icon: "🎖️" },
    { id: "analytics", label: "Analytics", icon: "📈" },
    { id: "disputes", label: "Disputes", icon: "💸" },
    { id: "reports", label: "Reports", icon: "🚩" },
    { id: "coins", label: "Coins", icon: "🪙" },
    { id: "gear", label: "Gear", icon: "🎧" },
    { id: "sponsors", label: "Sponsors", icon: "🤝" },
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
        {tab === "billing" && <BillingTab showToast={showToast} />}
        {tab === "organizers" && <OrganizersTab showToast={showToast} />}
        {tab === "analytics" && <AnalyticsTab showToast={showToast} />}
        {tab === "disputes" && <DisputesTab showToast={showToast} />}
        {tab === "reports" && <ReportsTab showToast={showToast} />}
        {tab === "coins" && <CoinsTab showToast={showToast} />}
        {tab === "gear" && <GearTab showToast={showToast} />}
        {tab === "sponsors" && <SponsorsTab showToast={showToast} />}
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
          loading="lazy"
                            src={u.profile_picture}
                            alt={u.username ? `${u.username}'s avatar` : "User avatar"}
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

// ══════════════════════════════════════════════════════════════════════════════
// TAB — BILLING (§1/§2)
// ══════════════════════════════════════════════════════════════════════════════
function BillingTab({ showToast }) {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/admin/billing")
      .then((d) => setBilling(d.billing))
      .catch((e) => showToast(`Failed to load billing: ${e.message}`, false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingGrid />;
  if (!billing) return null;

  const cards = [
    { label: "Active Subscriptions", value: billing.activeSubscriptions, icon: "📦", color: "#22c55e" },
    { label: "MRR", value: `₹${Number(billing.mrr).toLocaleString("en-IN")}`, icon: "💰", color: "#3b82f6" },
    { label: "Failed Payments (30d)", value: billing.failedPayments30d, icon: "⚠️", color: "#f97316" },
    { label: "Cancellations (30d)", value: billing.canceled30d, icon: "📉", color: "#ec4899" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="section-title">Billing</h2>
        <p className="section-subtitle">Subscriptions, revenue, and recent payments</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="card relative overflow-hidden" style={{ borderColor: c.color + "33" }}>
            <div className="relative">
              <div className="text-2xl mb-2">{c.icon}</div>
              <div className="text-2xl font-display font-bold text-white">{c.value}</div>
              <div className="text-xs text-gray-500 mt-1">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Recent Payments</h3>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy border-b border-surface-border">
            <tr>
              {["User", "Plan", "Amount", "Gateway", "Status", "Date"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {billing.recentPayments.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-gray-600">No payments yet</td>
              </tr>
            ) : (
              billing.recentPayments.map((p) => (
                <tr key={p.payment_id} className="border-b border-surface-border/50 hover:bg-surface-card/40 transition-colors">
                  <td className="px-4 py-3 text-white">@{p.username}</td>
                  <td className="px-4 py-3 text-gray-300">{p.plan_name}</td>
                  <td className="px-4 py-3 text-gray-300">₹{Number(p.amount).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{p.gateway}</td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-1 rounded-md text-xs font-semibold"
                      style={{
                        background:
                          p.status === "success" ? "rgba(34,197,94,0.15)" :
                          p.status === "failed"  ? "rgba(220,38,38,0.15)" :
                                                    "rgba(234,179,8,0.15)",
                        color:
                          p.status === "success" ? "#22c55e" :
                          p.status === "failed"  ? "#dc2626" : "#eab308",
                      }}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{fmt(p.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB — ORGANIZERS (§2 verification queue)
// ══════════════════════════════════════════════════════════════════════════════
function OrganizersTab({ showToast }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState(null); // verification object
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/admin/organizer-verifications?status=pending");
      setRequests(data.verifications || []);
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (v) => {
    try {
      await apiFetch(`/admin/organizer-verifications/${v.verification_id}/approve`, { method: "POST" });
      showToast(`@${v.username} approved as a verified organizer`);
      load();
    } catch (e) {
      showToast(e.message, false);
    }
  };

  const handleReject = async () => {
    try {
      await apiFetch(`/admin/organizer-verifications/${rejectModal.verification_id}/reject`, {
        method: "POST",
        body: JSON.stringify({ note: rejectNote || undefined }),
      });
      showToast(`@${rejectModal.username}'s request rejected`);
      setRejectModal(null);
      setRejectNote("");
      load();
    } catch (e) {
      showToast(e.message, false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="section-title">Organizer Verification Queue</h2>
        <p className="section-subtitle">
          Pending requests from Pro/Org-tier organizers — their tournaments stay hidden from public listings until approved
        </p>
      </div>

      {loading ? (
        <LoadingRows />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy border-b border-surface-border">
              <tr>
                {["User", "Email", "Requested", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-gray-600">No pending requests</td>
                </tr>
              ) : (
                requests.map((v) => (
                  <tr key={v.verification_id} className="border-b border-surface-border/50 hover:bg-surface-card/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">@{v.username}</td>
                    <td className="px-4 py-3 text-gray-400">{v.email}</td>
                    <td className="px-4 py-3 text-gray-500">{fmt(v.requested_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={() => handleApprove(v)}>
                          Approve
                        </button>
                        <button
                          className="btn-ghost text-xs px-3 py-1.5"
                          onClick={() => setRejectModal(v)}
                        >
                          Reject
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

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h3 className="font-display font-bold text-lg text-white mb-2">
              Reject @{rejectModal.username}'s request?
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Optional note — the organizer can see this if you show it to them later.
            </p>
            <textarea
              className="input w-full mb-4"
              rows={3}
              placeholder="Reason (optional)…"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button className="btn-ghost" onClick={() => { setRejectModal(null); setRejectNote(""); }}>
                Cancel
              </button>
              <button className="btn-primary" style={{ background: "#dc2626" }} onClick={handleReject}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB — ANALYTICS (§6 — the "live traction screen" for investors/IIE Cell)
// ══════════════════════════════════════════════════════════════════════════════
function AnalyticsTab({ showToast }) {
  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [organizerRetention, setOrganizerRetention] = useState(null);
  const [cohorts, setCohorts] = useState(null);
  const [cohortWindow, setCohortWindow] = useState(7);
  const [loading, setLoading] = useState(true);
  const [cohortsLoading, setCohortsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch("/admin/analytics/overview"),
      apiFetch("/admin/analytics/trend?days=30"),
      apiFetch("/admin/analytics/funnel"),
      apiFetch("/admin/analytics/organizer-retention"),
      apiFetch("/admin/analytics/retention?window=7"),
    ])
      .then(([o, t, f, or, c]) => {
        if (cancelled) return;
        setOverview(o.overview);
        setTrend(t.trend);
        setFunnel(f.funnel);
        setOrganizerRetention(or.organizerRetention);
        setCohorts(c.cohorts);
      })
      .catch((e) => showToast(`Failed to load analytics: ${e.message}`, false))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const loadCohorts = useCallback((window) => {
    setCohortWindow(window);
    setCohortsLoading(true);
    apiFetch(`/admin/analytics/retention?window=${window}`)
      .then((d) => setCohorts(d.cohorts))
      .catch((e) => showToast(`Failed to load retention: ${e.message}`, false))
      .finally(() => setCohortsLoading(false));
  }, [showToast]);

  if (loading) return <LoadingGrid />;
  if (!overview) return null;

  const overviewCards = [
    { label: "Daily Active Users", value: overview.dau.toLocaleString(), icon: "🟢", color: "#22c55e" },
    { label: "Weekly Active Users", value: overview.wau.toLocaleString(), icon: "📅", color: "#3b82f6" },
    { label: "Monthly Active Users", value: overview.mau.toLocaleString(), icon: "🗓️", color: "#a855f7" },
    { label: "Total Users", value: overview.totalUsers.toLocaleString(), icon: "👥", color: "#ff4655" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="section-title">Analytics &amp; Traction</h2>
        <p className="section-subtitle">DAU/WAU/MAU, retention, and the signup → activation funnel</p>
      </div>

      {/* DAU / WAU / MAU */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {overviewCards.map((c) => (
          <div key={c.label} className="card relative overflow-hidden" style={{ borderColor: c.color + "33" }}>
            <div className="relative">
              <div className="text-2xl mb-2">{c.icon}</div>
              <div className="text-2xl font-display font-bold text-white">{c.value}</div>
              <div className="text-xs text-gray-500 mt-1">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Daily trend chart */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">30-Day Activity Trend</h3>
        <div className="card">
          {trend && trend.length > 0 ? (
            <TrendChart trend={trend} />
          ) : (
            <p className="text-gray-600 text-sm py-8 text-center">Not enough data yet</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Funnel */}
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
            Signup → Profile → First Tournament
          </h3>
          <div className="card">
            {funnel && <FunnelChart funnel={funnel} />}
          </div>
        </div>

        {/* Organizer retention */}
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Organizer Retention</h3>
          <div className="card h-full flex flex-col justify-center">
            {organizerRetention && (
              <>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-3xl font-display font-bold text-white">
                    {Math.round(organizerRetention.retentionRate * 100)}%
                  </span>
                  <span className="text-xs text-gray-500">
                    returned to run a tournament in a later month
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-navy overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(organizerRetention.retentionRate * 100)}%`,
                      background: "#a855f7",
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {organizerRetention.returningOrganizers.toLocaleString()} of{" "}
                  {organizerRetention.totalOrganizers.toLocaleString()} organizers have run tournaments in
                  more than one calendar month.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Retention cohorts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Retention Cohorts</h3>
          <div className="flex gap-1 bg-navy rounded-lg p-1">
            {[7, 30].map((w) => (
              <button
                key={w}
                onClick={() => loadCohorts(w)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  cohortWindow === w ? "bg-red text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                D{w}
              </button>
            ))}
          </div>
        </div>
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy border-b border-surface-border">
              <tr>
                {["Cohort", "Signed Up", "Retained", "Retention"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohortsLoading ? (
                <tr><td colSpan={4} className="text-center py-16 text-gray-600">Loading…</td></tr>
              ) : !cohorts || cohorts.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-16 text-gray-600">No cohorts in this window yet</td></tr>
              ) : (
                cohorts.map((c) => (
                  <tr key={c.cohortDate} className="border-b border-surface-border/50 hover:bg-surface-card/40 transition-colors">
                    <td className="px-4 py-3 text-white">{fmt(c.cohortDate)}</td>
                    <td className="px-4 py-3 text-gray-300">{c.cohortSize.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-300">{c.retained.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-navy overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.round(c.retentionRate * 100)}%`, background: "#3b82f6" }}
                          />
                        </div>
                        <span className="text-gray-400 text-xs">{Math.round(c.retentionRate * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CoinAnalytics showToast={showToast} />
      <ReferralAnalytics showToast={showToast} />
    </div>
  );
}

// Lightweight dependency-free SVG line chart for signups vs. logins over time.
// Pass `series` / `xKey` to reuse it for other daily data (e.g. coin issue vs spend).
function TrendChart({ trend, series: seriesProp, xKey = "rollup_date" }) {
  const width = 800;
  const height = 220;
  const padding = { top: 10, right: 10, bottom: 24, left: 32 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const series = seriesProp || [
    { key: "signups", label: "Signups", color: "#ff4655" },
    { key: "logins", label: "Logins", color: "#3b82f6" },
    { key: "tournament_registrations", label: "Tournament Regs", color: "#f97316" },
  ];

  const maxVal = Math.max(1, ...trend.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const n = trend.length;
  const xFor = (i) => padding.left + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yFor = (v) => padding.top + innerH - (v / maxVal) * innerH;

  const pathFor = (key) =>
    trend
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(Number(d[key]) || 0).toFixed(1)}`)
      .join(" ");

  // show at most ~6 x-axis labels to avoid crowding
  const labelStep = Math.max(1, Math.ceil(n / 6));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + innerH * (1 - t)}
            y2={padding.top + innerH * (1 - t)}
            stroke="#ffffff10"
          />
        ))}
        {series.map((s) => (
          <path key={s.key} d={pathFor(s.key)} fill="none" stroke={s.color} strokeWidth="2" />
        ))}
        {trend.map((d, i) =>
          i % labelStep === 0 ? (
            <text key={i} x={xFor(i)} y={height - 4} fontSize="9" fill="#6b7280" textAnchor="middle">
              {String(d[xKey]).slice(5, 10)}
            </text>
          ) : null
        )}
      </svg>
      <div className="flex gap-4 mt-2 flex-wrap">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// Simple step-down funnel visualization
function FunnelChart({ funnel }) {
  const steps = [
    { label: "Signed Up", value: funnel.signups, color: "#ff4655" },
    { label: "Profile Complete", value: funnel.profileComplete, color: "#3b82f6" },
    { label: "First Tournament", value: funnel.firstTournament, color: "#22c55e" },
  ];
  const base = Math.max(1, steps[0].value);

  return (
    <div className="space-y-4">
      {steps.map((s, i) => {
        const pctOfBase = Math.round((s.value / base) * 100);
        const prev = i > 0 ? steps[i - 1].value : null;
        const pctOfPrev = prev ? Math.round((s.value / Math.max(1, prev)) * 100) : null;
        return (
          <div key={s.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-white font-semibold">{s.label}</span>
              <span className="text-sm text-gray-400">
                {s.value.toLocaleString()}
                {pctOfPrev !== null && (
                  <span className="text-gray-600 ml-2">({pctOfPrev}% of previous step)</span>
                )}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-navy overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(2, pctOfBase)}%`, background: s.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB — COINS (§11 — economy settings, redemption queue, reward catalog)
// ══════════════════════════════════════════════════════════════════════════════
function CoinsTab({ showToast }) {
  const [view, setView] = useState("settings");
  const [stats, setStats] = useState(null);
  const [ledgerUserId, setLedgerUserId] = useState(null);
  const openLedger = (userId) => { setLedgerUserId(userId); setView("ledger"); };

  const loadStats = useCallback(() => {
    apiFetch("/admin/coins/stats").then((d) => setStats(d.stats)).catch(() => {});
  }, []);
  useEffect(() => { loadStats(); }, [loadStats, view]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="section-title">Arena Coins</h2>
          <p className="section-subtitle">Tune the economy, review redemptions, manage rewards</p>
        </div>
        <div className="flex gap-1 bg-navy rounded-lg p-1">
          {[["settings", "Settings"], ["queue", "Redemptions"], ["disputes", "Disputes"], ["ledger", "User ledger"], ["catalog", "Catalog"]].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${view === id ? "bg-red text-white" : "text-gray-400 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {stats && stats.budget_status === "reached" && (
        <div className="card mb-4 border border-red/40 bg-red/10 text-sm text-red">
          Monthly cash budget reached: ₹{Number(stats.cash_committed_this_month_inr).toLocaleString("en-IN")} of ₹{Number(stats.monthly_cash_budget_inr).toLocaleString("en-IN")} committed.
          New gift card and top-up requests are refused until next month.
        </div>
      )}
      {stats && stats.budget_status === "warning" && (
        <div className="card mb-4 border border-yellow-500/40 bg-yellow-500/10 text-sm text-yellow-500">
          Over 80% of this month's cash budget is committed: ₹{Number(stats.cash_committed_this_month_inr).toLocaleString("en-IN")} of ₹{Number(stats.monthly_cash_budget_inr).toLocaleString("en-IN")}.
        </div>
      )}
      {stats && stats.liability_exceeds_budget && (
        <div className="card mb-4 text-sm text-yellow-500">
          Max liability (₹{Number(stats.max_liability_inr).toLocaleString("en-IN")}) is above your monthly budget. The budget cap still limits what is actually paid out each month.
        </div>
      )}
      {stats && stats.anomalies > 0 && (
        <div className="card mb-4 border border-red/40 bg-red/10 text-sm text-red">
          {stats.anomalies} ledger anomal{stats.anomalies === 1 ? "y" : "ies"} found (a negative balance, a missing debit or refund, or stuck pending coins).
          Run <span className="font-mono">node scripts/reconcileCoins.js</span> on the server for details.
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            ["Exchange rate", `${stats.coins_per_inr} coins = ₹1`],
            ["Coins outstanding", Number(stats.outstanding).toLocaleString("en-IN")],
            ["Max liability if all redeemed", `₹${Number(stats.max_liability_inr).toLocaleString("en-IN")}`],
            ["Open requests", `${stats.open_requests} (₹${Number(stats.open_requests_inr).toLocaleString("en-IN")})`],
            ["Coins issued (all time)", Number(stats.issued).toLocaleString("en-IN")],
            ["Coins spent", Number(stats.spent).toLocaleString("en-IN")],
            ["Earners (30 days)", stats.earners_30d],
            ["Cash rewards sent this month", `₹${Number(stats.cash_rewards_fulfilled_this_month_inr).toLocaleString("en-IN")}`],
            ["Cash committed this month", stats.monthly_cash_budget_inr > 0 ? `₹${Number(stats.cash_committed_this_month_inr).toLocaleString("en-IN")} / ₹${Number(stats.monthly_cash_budget_inr).toLocaleString("en-IN")}` : `₹${Number(stats.cash_committed_this_month_inr).toLocaleString("en-IN")} (no budget set)`],
          ].map(([label, value]) => (
            <div key={label} className="card py-3">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
              <p className="font-display font-bold text-white mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {view === "settings" && <CoinSettingsPanel showToast={showToast} onSaved={loadStats} />}
      {view === "queue" && <CoinQueuePanel showToast={showToast} onChanged={loadStats} onOpenUser={openLedger} />}
      {view === "disputes" && <CoinDisputesPanel showToast={showToast} onChanged={loadStats} />}
      {view === "ledger" && <CoinLedgerPanel showToast={showToast} userId={ledgerUserId} setUserId={setLedgerUserId} onChanged={loadStats} />}
      {view === "catalog" && <CoinCatalogPanel showToast={showToast} />}
    </div>
  );
}

function CoinSettingsPanel({ showToast, onSaved }) {
  const [specs, setSpecs] = useState([]);
  const [audit, setAudit] = useState([]);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/admin/coins/settings")
      .then((d) => {
        setSpecs(d.settings || []);
        setAudit(d.audit || []);
        setDraft(Object.fromEntries((d.settings || []).map((s) => [s.key, String(s.value)])));
      })
      .catch((e) => showToast(`Failed to load settings: ${e.message}`, false))
      .finally(() => setLoading(false));
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const changed = specs.filter((s) => String(s.value) !== String(draft[s.key]));

  const save = async () => {
    const settings = Object.fromEntries(changed.map((s) => [s.key, draft[s.key]]));
    setSaving(true);
    try {
      await apiFetch("/admin/coins/settings", { method: "PUT", body: JSON.stringify({ settings }) });
      showToast("Settings saved");
      load();
      onSaved?.();
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingRows />;

  const rate = Number(draft.coins_per_inr) || 0;
  const perfectMonth = (Number(draft.earn_login) + Number(draft.earn_dailies)) * 30;

  return (
    <div>
      <div className="card mb-4 text-sm text-gray-400">
        <p>
          At <span className="text-white font-semibold">{rate} coins = ₹1</span>, a user who logs in and plays Dailies every day earns about{" "}
          <span className="text-white font-semibold">{perfectMonth.toLocaleString("en-IN")} coins/month</span>
          {rate > 0 && <> (≈ ₹{(perfectMonth / rate).toFixed(2)} of reward value) before streak bonuses</>}.
          Changing the rate reprices gift cards and top-ups on the next page load; coins already earned are unaffected.
        </p>
      </div>

      <div className="card mb-4">
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
          {specs.map((s) => (
            <label key={s.key} className="block">
              <span className="text-xs text-gray-400 block mb-1">
                {s.label}
                {s.type !== "bool" && s.type !== "list" && s.min !== undefined && <span className="text-gray-600"> ({s.min}–{s.max})</span>}
              </span>
              {s.type === "bool" ? (
                <select className="input text-sm w-full" value={draft[s.key] === "true" || draft[s.key] === "1" ? "1" : "0"}
                  onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}>
                  <option value="1">On</option>
                  <option value="0">Off (paused)</option>
                </select>
              ) : (
                <input className="input text-sm w-full" value={draft[s.key] ?? ""}
                  inputMode={s.type === "list" ? "text" : "decimal"}
                  onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))} />
              )}
              {s.type === "list" && <span className="text-[11px] text-gray-600">Comma-separated: {s.allowed.join(", ")}</span>}
            </label>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3 mt-5">
          {changed.length > 0 && <span className="text-xs text-gray-500">{changed.length} unsaved change{changed.length > 1 ? "s" : ""}</span>}
          <button className="btn-ghost text-sm" disabled={changed.length === 0 || saving}
            onClick={() => setDraft(Object.fromEntries(specs.map((s) => [s.key, String(s.value)])))}>Reset</button>
          <button className="btn-primary text-sm" disabled={changed.length === 0 || saving} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <h3 className="font-display font-bold text-white mb-2">Recent changes</h3>
      {audit.length === 0 ? (
        <div className="card text-sm text-gray-600 text-center py-6">No edits yet</div>
      ) : (
        <div className="space-y-1">
          {audit.map((a) => (
            <div key={a.audit_id} className="card py-2 text-xs flex flex-wrap justify-between gap-2">
              <span className="text-gray-300"><span className="font-mono">{a.setting_key}</span>: {a.old_value} → <span className="text-white font-semibold">{a.new_value}</span></span>
              <span className="text-gray-500">{a.changed_by ? `@${a.changed_by}` : "system"} · {fmt(a.changed_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const RISK_FLAG_LABELS = {
  new_account: "New account",
  high_earn_rate: "Earning unusually fast",
  referral_heavy: "Many referral rewards",
  repeat_redeemer: "Repeat redeemer",
  admin_grants: "Received admin grants",
  shared_device: "Shares a device with other accounts",
  shared_signup_ip: "3+ accounts signed up from the same IP",
};

function CoinQueuePanel({ showToast, onChanged, onOpenUser }) {
  const [status, setStatus] = useState("requested");
  const [exp, setExp] = useState({ status: "", from: "", to: "" });
  const [exporting, setExporting] = useState(false);

  // CSV for accounting. Fetched with the auth header, then saved as a file.
  // Gift card codes are never included (the server leaves them out).
  const exportCsv = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams(Object.fromEntries(Object.entries(exp).filter(([, v]) => v)));
      const res = await fetch(`${API_BASE}/admin/coins/redemptions/export?${qs}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `arenax-redemptions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setExporting(false);
    }
  };
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/admin/coins/redemptions?status=${status}`)
      .then((d) => setRows(d.redemptions || []))
      .catch((e) => showToast(`Failed to load: ${e.message}`, false))
      .finally(() => setLoading(false));
  }, [status, showToast]);
  useEffect(() => { load(); }, [load]);

  const act = async (r, action, body) => {
    setBusyId(r.redemption_id);
    try {
      await apiFetch(`/admin/coins/redemptions/${r.redemption_id}/${action}`, { method: "POST", body: JSON.stringify(body || {}) });
      showToast(action === "fulfil" ? "Marked delivered" : action === "reject" ? "Rejected, coins refunded" : "Approved");
      load();
      onChanged?.();
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex gap-1 bg-navy rounded-lg p-1 w-fit mb-4">
        {["requested", "approved", "fulfilled", "rejected", "refunded"].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${status === s ? "bg-red text-white" : "text-gray-400 hover:text-white"}`}>
            {s}
          </button>
        ))}
      </div>
      <div className="card mb-4 flex flex-wrap items-end gap-3">
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Accounting export</p>
          <select className="input text-sm" value={exp.status} onChange={(e) => setExp((x) => ({ ...x, status: e.target.value }))}>
            <option value="">All statuses</option>
            {["requested", "approved", "fulfilled", "rejected", "refunded"].map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>
        <input className="input text-sm" type="date" aria-label="From date" value={exp.from} onChange={(e) => setExp((x) => ({ ...x, from: e.target.value }))} />
        <input className="input text-sm" type="date" aria-label="To date" value={exp.to} onChange={(e) => setExp((x) => ({ ...x, to: e.target.value }))} />
        <button className="btn-secondary text-sm" onClick={exportCsv} disabled={exporting}>{exporting ? "Exporting..." : "Export CSV"}</button>
        <p className="text-[11px] text-gray-600 basis-full">Opens in Excel / Sheets. Gift card codes are never included.</p>
      </div>
      {loading ? <LoadingRows /> : rows.length === 0 ? (
        <div className="card text-center py-12 text-gray-600 text-sm">No {status} redemptions</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.redemption_id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-white">{r.reward_name}{r.inr_value != null && <span className="text-gray-500"> · ₹{Number(r.inr_value)}</span>}</p>
                  <p className="text-xs text-gray-400"><button className="hover:text-white underline decoration-dotted" onClick={() => onOpenUser?.(r.user_id)} title="Open coin ledger">@{r.username}</button> · {r.email} {!r.email_verified && <span className="text-red">(unverified)</span>}</p>
                </div>
                <p className="text-xs text-gray-500">{fmt(r.created_at)} · {Number(r.coins_spent).toLocaleString("en-IN")} coins · member since {fmt(r.user_since)}</p>
              </div>
              {r.flags && r.flags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {r.flags.map((f) => (
                    <span key={f} className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(234,179,8,0.15)", color: "#eab308" }}>
                      {RISK_FLAG_LABELS[f] || f}
                    </span>
                  ))}
                  <span className="text-[11px] text-gray-500">{Number(r.earned_7d).toLocaleString("en-IN")} coins earned in 7 days</span>
                </div>
              )}
              {(status === "requested" || status === "approved") ? (
                <div className="flex flex-wrap gap-2">
                  <input className="input flex-1 min-w-[200px] text-sm" placeholder="Gift card code / top-up reference"
                    value={codes[r.redemption_id] || ""} onChange={(e) => setCodes((c) => ({ ...c, [r.redemption_id]: e.target.value }))} />
                  {status === "requested" && (
                    <button className="btn-secondary text-sm" disabled={busyId === r.redemption_id} onClick={() => act(r, "approve")}>Approve</button>
                  )}
                  <button className="btn-primary text-sm" disabled={busyId === r.redemption_id || !(codes[r.redemption_id] || "").trim()}
                    onClick={() => act(r, "fulfil", { fulfillment: codes[r.redemption_id] })}>Mark delivered</button>
                  <button className="btn-ghost text-sm" disabled={busyId === r.redemption_id}
                    onClick={() => { if (window.confirm("Reject and refund the coins?")) act(r, "reject"); }}>Reject</button>
                </div>
              ) : r.fulfillment ? (
                <p className="text-xs text-gray-500 font-mono break-all">Delivered: {r.fulfillment}</p>
              ) : r.admin_note ? (
                <p className="text-xs text-gray-500">Note: {r.admin_note}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const COIN_REASON_LABELS = {
  login: "Daily login", dailies: "Dailies game", profile_complete: "Profile completed",
  first_game: "First game added", team_join: "Joined a team", streak_7: "7-day streak bonus",
  streak_30: "30-day streak bonus", redemption: "Redeemed reward", redemption_refund: "Redemption refunded",
  admin_adjust: "Admin adjustment", ban_reversal: "Balance removed (ban)",
};

// Per-user coin ledger: balance, earn pattern, full history, manual adjustment.
// Opened from the user search below or by clicking a username in the
// redemption queue.
function CoinLedgerPanel({ showToast, userId, setUserId, onChanged }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const search = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    try {
      const d = await apiFetch(`/admin/users?${new URLSearchParams({ q: q.trim(), limit: 8 })}`);
      setResults(d.users || []);
    } catch (err) { showToast(err.message, false); }
    finally { setSearching(false); }
  };

  const load = useCallback(() => {
    if (!userId) { setData(null); return; }
    setLoading(true);
    apiFetch(`/admin/coins/users/${userId}?limit=50`)
      .then((d) => setData(d))
      .catch((err) => { showToast(err.message, false); setData(null); })
      .finally(() => setLoading(false));
  }, [userId, showToast]);
  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    setMoreLoading(true);
    try {
      const d = await apiFetch(`/admin/coins/users/${userId}?limit=50&offset=${data.entries.length}`);
      setData((prev) => ({ ...prev, entries: [...prev.entries, ...d.entries] }));
    } catch (err) { showToast(err.message, false); }
    finally { setMoreLoading(false); }
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isInteger(n) || n === 0) { showToast("Enter a whole number (use - to deduct)", false); return; }
    if (!window.confirm(`${n > 0 ? "Grant" : "Deduct"} ${Math.abs(n).toLocaleString("en-IN")} coins ${n > 0 ? "to" : "from"} @${data.user.username}?`)) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/coins/users/${userId}/adjust`, { method: "POST", body: JSON.stringify({ amount: n, note }) });
      showToast("Adjustment recorded");
      setAmount(""); setNote("");
      load();
      onChanged?.();
    } catch (err) { showToast(err.message, false); }
    finally { setSaving(false); }
  };

  const n = (v) => Number(v).toLocaleString("en-IN");

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex gap-2">
        <input className="input flex-1 text-sm" placeholder="Search by username or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-secondary text-sm" disabled={searching || !q.trim()}>{searching ? "Searching…" : "Search"}</button>
      </form>

      {results.length > 0 && (
        <div className="card p-2 divide-y divide-white/5">
          {results.map((u) => (
            <button key={u.user_id} onClick={() => { setUserId(u.user_id); setResults([]); setQ(""); }}
              className="w-full flex items-center justify-between gap-3 px-2 py-2 text-left hover:bg-white/5 rounded">
              <span className="text-sm text-white">@{u.username} <span className="text-gray-500">· {u.email}</span></span>
              <span className="text-xs text-gray-500">{u.status}</span>
            </button>
          ))}
        </div>
      )}

      {!userId && !results.length && (
        <div className="card text-center py-12 text-gray-600 text-sm">Search for a user, or click a username in the Redemptions queue.</div>
      )}

      {userId && loading && !data && <LoadingRows />}

      {data && (
        <>
          <div className="card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-display font-bold text-white text-lg">@{data.user.username}</p>
                <p className="text-xs text-gray-400">
                  {data.user.email} {!data.user.email_verified && <span className="text-red">(unverified)</span>}
                </p>
              </div>
              <div className="text-xs text-gray-500 text-right">
                <p>Status: <span className={data.user.status === "active" ? "text-green-400" : "text-red"}>{data.user.status}</span></p>
                <p>Member since {fmt(data.user.created_at)}</p>
                <p>Last login {data.user.last_login ? fmt(data.user.last_login) : "—"}</p>
              </div>
            </div>
          </div>

          {data.linked_accounts && (data.linked_accounts.same_device.length > 0 || data.linked_accounts.same_signup_ip.length > 0) && (
            <div className="card border border-yellow-500/30">
              <p className="text-xs text-yellow-400 uppercase tracking-wider mb-2">Linked accounts</p>
              {data.linked_accounts.same_device.length > 0 && (
                <p className="text-sm text-gray-300 mb-1">
                  <span className="text-gray-500">Same device (strong): </span>
                  {data.linked_accounts.same_device.map((a) => (
                    <button key={a.user_id} className="mr-2 underline decoration-dotted hover:text-white" onClick={() => setUserId(a.user_id)}>@{a.username}{a.status !== "active" ? ` (${a.status})` : ""}</button>
                  ))}
                </p>
              )}
              {data.linked_accounts.same_signup_ip.length > 0 && (
                <p className="text-sm text-gray-300">
                  <span className="text-gray-500">Signed up from the same IP (weak, can be a shared network): </span>
                  {data.linked_accounts.same_signup_ip.map((a) => (
                    <button key={a.user_id} className="mr-2 underline decoration-dotted hover:text-white" onClick={() => setUserId(a.user_id)}>@{a.username}</button>
                  ))}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[["Available", n(data.balance.available)], ["Pending", n(data.balance.pending)],
              ["Earned (lifetime)", n(data.totals.earned)], ["Spent on rewards", n(data.totals.spent)]].map(([label, value]) => (
              <div key={label} className="card py-3">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
                <p className="font-display font-bold text-white mt-1">{value}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Earned per day (last 14 days)</p>
            {data.daily.length === 0 ? <p className="text-sm text-gray-600">No earnings in this period</p> : (
              <div className="flex flex-wrap gap-2">
                {data.daily.map((d) => (
                  <span key={String(d.day)} className="text-xs bg-navy rounded px-2 py-1 text-gray-300">
                    {d.day}: <span className="text-white font-semibold">{n(d.coins)}</span> <span className="text-gray-600">({d.entries})</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={submitAdjust} className="card">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Manual adjustment</p>
            <div className="flex flex-wrap gap-2">
              <input className="input w-32 text-sm" type="number" step="1" placeholder="e.g. 100 or -100" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <input className="input flex-1 min-w-[200px] text-sm" maxLength={200} placeholder="Reason (required, shown in the audit trail)" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn-primary text-sm" disabled={saving || !amount || note.trim().length < 3}>{saving ? "Saving…" : "Apply"}</button>
            </div>
            <p className="text-[11px] text-gray-600 mt-2">Adds a new ledger entry; history is never edited. Fix a mistake with an opposite adjustment. A deduction can't take the balance below 0.</p>
          </form>

          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider border-b border-white/5">
                  <th className="px-3 py-2">When</th><th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2 text-right">Coins</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.entries.map((e) => (
                  <tr key={e.entry_id} className={e.status === "reversed" ? "opacity-50" : ""}>
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{fmt(e.created_at)}</td>
                    <td className="px-3 py-2 text-white">{COIN_REASON_LABELS[e.reason] || e.reason}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${e.delta > 0 ? "text-green-400" : "text-red"}`}>{e.delta > 0 ? "+" : ""}{n(e.delta)}</td>
                    <td className="px-3 py-2 text-gray-400">{e.status}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{e.note || ""}</td>
                  </tr>
                ))}
                {data.entries.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-600">No ledger entries</td></tr>}
              </tbody>
            </table>
            {data.entries.length < data.total_entries && (
              <div className="p-3 text-center">
                <button className="btn-ghost text-sm" onClick={loadMore} disabled={moreLoading}>{moreLoading ? "Loading…" : `Load more (${data.total_entries - data.entries.length} left)`}</button>
              </div>
            )}
          </div>

          <div className="card">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Recent redemptions</p>
            {data.redemptions.length === 0 ? <p className="text-sm text-gray-600">None</p> : (
              <div className="space-y-1">
                {data.redemptions.map((r) => (
                  <p key={r.redemption_id} className="text-sm text-gray-300">
                    {fmt(r.created_at)} · {r.reward_name} · {n(r.coins_spent)} coins · <span className="text-white">{r.status}</span>
                    {r.admin_note && <span className="text-gray-500"> — {r.admin_note}</span>}
                  </p>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Redemption disputes: a user reported a missing or invalid gift card code.
function CoinDisputesPanel({ showToast, onChanged }) {
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});       // per dispute: { action, note, code }
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/admin/coins/disputes?status=${status}`)
      .then((d) => setRows(d.disputes || []))
      .catch((e) => showToast(`Failed to load: ${e.message}`, false))
      .finally(() => setLoading(false));
  }, [status, showToast]);
  useEffect(() => { load(); }, [load]);

  const f = (id) => form[id] || { action: "replace", note: "", code: "" };
  const set = (id, patch) => setForm((x) => ({ ...x, [id]: { ...f(id), ...patch } }));

  const resolve = async (d) => {
    const v = f(d.dispute_id);
    if (v.action === "refund" && !window.confirm(`Return ${Number(d.coins_spent).toLocaleString("en-IN")} coins to @${d.username}?`)) return;
    setBusyId(d.dispute_id);
    try {
      await apiFetch(`/admin/coins/disputes/${d.dispute_id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ action: v.action, note: v.note, ...(v.action === "replace" ? { fulfillment: v.code } : {}) }),
      });
      showToast("Report resolved");
      load();
      onChanged?.();
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex gap-1 bg-navy rounded-lg p-1 w-fit mb-4">
        {["open", "replaced", "refunded", "denied"].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${status === s ? "bg-red text-white" : "text-gray-400 hover:text-white"}`}>
            {s}
          </button>
        ))}
      </div>
      {loading ? <LoadingRows /> : rows.length === 0 ? (
        <div className="card text-center py-12 text-gray-600 text-sm">No {status} reports</div>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => {
            const v = f(d.dispute_id);
            return (
              <div key={d.dispute_id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-white">{d.reward_name}{d.inr_value != null && <span className="text-gray-500"> {"\u00B7"} ₹{Number(d.inr_value)}</span>}</p>
                    <p className="text-xs text-gray-400">@{d.username} {"\u00B7"} {d.email}</p>
                  </div>
                  <p className="text-xs text-gray-500">{fmt(d.created_at)} {"\u00B7"} {Number(d.coins_spent).toLocaleString("en-IN")} coins {"\u00B7"} request is {d.redemption_status}</p>
                </div>
                <p className="text-sm text-gray-300 bg-navy rounded-lg p-3 mb-3 whitespace-pre-wrap">{d.reason}</p>
                {d.fulfillment && <p className="text-xs text-gray-500 font-mono break-all mb-3">Code sent: {d.fulfillment}</p>}
                {d.status === "open" ? (
                  <div className="flex flex-wrap gap-2">
                    <select className="input text-sm" value={v.action} onChange={(e) => set(d.dispute_id, { action: e.target.value })}>
                      <option value="replace">Send a new code</option>
                      <option value="refund">Refund the coins</option>
                      <option value="deny">No problem found</option>
                    </select>
                    {v.action === "replace" && (
                      <input className="input flex-1 min-w-[180px] text-sm" placeholder="New code / reference" value={v.code} onChange={(e) => set(d.dispute_id, { code: e.target.value })} />
                    )}
                    <input className="input flex-1 min-w-[200px] text-sm" maxLength={200} placeholder="Note to the user (required)" value={v.note} onChange={(e) => set(d.dispute_id, { note: e.target.value })} />
                    <button className="btn-primary text-sm"
                      disabled={busyId === d.dispute_id || v.note.trim().length < 3 || (v.action === "replace" && !v.code.trim())}
                      onClick={() => resolve(d)}>Resolve</button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Resolved: {d.admin_note}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CoinCatalogPanel({ showToast }) {
  const blank = { name: "", description: "", type: "gift_card", inr_value: "", coin_cost: "", pro_days: "", stock: "" };
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/admin/coins/catalog")
      .then((d) => setRows(d.rewards || []))
      .catch((e) => showToast(`Failed to load catalog: ${e.message}`, false))
      .finally(() => setLoading(false));
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const patch = async (id, body, msg) => {
    try {
      await apiFetch(`/admin/coins/catalog/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      showToast(msg);
      load();
    } catch (e) { showToast(e.message, false); }
  };

  const create = async () => {
    setBusy(true);
    try {
      await apiFetch("/admin/coins/catalog", { method: "POST", body: JSON.stringify(form) });
      showToast("Reward added");
      setForm(blank);
      load();
    } catch (e) { showToast(e.message, false); }
    finally { setBusy(false); }
  };

  const cash = form.type === "gift_card" || form.type === "topup";

  return (
    <div>
      <div className="card mb-4">
        <h3 className="font-display font-bold text-white mb-3">Add reward</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className="input text-sm" placeholder="Name (e.g. Free Fire 100 diamonds)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="gift_card">Gift card</option>
            <option value="topup">In-game top-up</option>
            <option value="pro_days">Pro days (instant)</option>
            <option value="other">Other (manual)</option>
          </select>
          <input className="input text-sm sm:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {cash ? (
            <input className="input text-sm" placeholder="Value in ₹ (coin price follows the exchange rate)" inputMode="decimal" value={form.inr_value} onChange={(e) => setForm({ ...form, inr_value: e.target.value })} />
          ) : (
            <input className="input text-sm" placeholder="Fixed coin cost" inputMode="numeric" value={form.coin_cost} onChange={(e) => setForm({ ...form, coin_cost: e.target.value })} />
          )}
          {form.type === "pro_days" && (
            <input className="input text-sm" placeholder="Days of Pro" inputMode="numeric" value={form.pro_days} onChange={(e) => setForm({ ...form, pro_days: e.target.value })} />
          )}
          <input className="input text-sm" placeholder="Stock (blank = unlimited)" inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
        </div>
        <div className="flex justify-end mt-3">
          <button className="btn-primary text-sm" disabled={busy || !form.name.trim()} onClick={create}>{busy ? "Adding…" : "Add reward"}</button>
        </div>
      </div>

      {loading ? <LoadingRows /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.reward_id} className={`card flex flex-wrap items-center justify-between gap-3 ${r.is_active ? "" : "opacity-50"}`}>
              <div className="min-w-0">
                <p className="font-semibold text-white">{r.name} <span className="text-xs text-gray-500">({r.type})</span></p>
                <p className="text-xs text-gray-500">
                  {Number(r.live_coin_cost).toLocaleString("en-IN")} coins
                  {r.inr_value != null && <> · ₹{Number(r.inr_value)} at the current rate</>}
                  {" · "}{r.stock == null ? "unlimited stock" : `${r.stock} in stock`}
                </p>
              </div>
              <div className="flex gap-2">
                {r.stock != null && (
                  <button className="btn-ghost text-xs" onClick={() => {
                    const n = window.prompt("Set stock to:", String(r.stock));
                    if (n !== null && n.trim() !== "") patch(r.reward_id, { stock: n }, "Stock updated");
                  }}>Set stock</button>
                )}
                <button className="btn-secondary text-xs" onClick={() => patch(r.reward_id, { is_active: !r.is_active }, r.is_active ? "Hidden" : "Visible")}>
                  {r.is_active ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB — DISPUTES (§9 — manual refund/dispute review)
// ══════════════════════════════════════════════════════════════════════════════
function DisputesTab({ showToast }) {
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/admin/disputes?status=${status}`)
      .then((d) => setRows(d.disputes || []))
      .catch((e) => showToast(`Failed to load disputes: ${e.message}`, false))
      .finally(() => setLoading(false));
  }, [status, showToast]);
  useEffect(() => { load(); }, [load]);

  const resolve = async (d, outcome) => {
    if (outcome === "refunded" && !window.confirm("Mark as refunded? This cancels their subscription. Issue the actual refund in Razorpay yourself.")) return;
    setBusyId(d.dispute_id);
    try {
      await apiFetch(`/admin/disputes/${d.dispute_id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ status: outcome, note: notes[d.dispute_id] || undefined }),
      });
      showToast(outcome === "refunded" ? "Marked refunded" : "Dispute denied");
      load();
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="section-title">Payment Disputes</h2>
          <p className="section-subtitle">Refunds are issued manually in Razorpay — this records the decision</p>
        </div>
        <div className="flex gap-1 bg-navy rounded-lg p-1">
          {["open", "refunded", "denied"].map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                status === s ? "bg-red text-white" : "text-gray-400 hover:text-white"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      {loading ? <LoadingRows /> : rows.length === 0 ? (
        <div className="card text-center py-12 text-gray-600 text-sm">No {status} disputes</div>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => (
            <div key={d.dispute_id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-white">
                  @{d.username} · ₹{Number(d.amount).toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-gray-500">{fmt(d.created_at)} · {d.gateway_payment_id || `payment #${d.payment_id}`}</p>
              </div>
              <p className="text-sm text-gray-300 mb-3">{d.reason}</p>
              {status === "open" ? (
                <div className="flex flex-wrap gap-2">
                  <input className="input flex-1 min-w-[180px] text-sm" placeholder="Note to keep on record (optional)"
                    value={notes[d.dispute_id] || ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [d.dispute_id]: e.target.value }))} />
                  <button className="btn-primary text-sm" disabled={busyId === d.dispute_id} onClick={() => resolve(d, "refunded")}>Refund</button>
                  <button className="btn-ghost text-sm" disabled={busyId === d.dispute_id} onClick={() => resolve(d, "denied")}>Deny</button>
                </div>
              ) : d.admin_note ? (
                <p className="text-xs text-gray-500">Note: {d.admin_note}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB — REPORTS (§9 — player-side + organizer-side abuse queue)
// ══════════════════════════════════════════════════════════════════════════════
function ReportsTab({ showToast }) {
  const [status, setStatus] = useState("pending");
  const [type, setType] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ status, ...(type ? { type } : {}) }).toString();
    apiFetch(`/admin/reports?${qs}`)
      .then((d) => setRows(d.reports || []))
      .catch((e) => showToast(`Failed to load reports: ${e.message}`, false))
      .finally(() => setLoading(false));
  }, [status, type, showToast]);
  useEffect(() => { load(); }, [load]);

  const resolve = async (r, outcome) => {
    setBusyId(r.report_id);
    try {
      await apiFetch(`/admin/reports/${r.report_id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ status: outcome, note: notes[r.report_id] || undefined }),
      });
      showToast(outcome === "resolved" ? "Marked resolved" : "Dismissed");
      load();
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="section-title">Reports Queue</h2>
          <p className="section-subtitle">Player-side reports and organizer-side abuse (fake tournaments, no-shows)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 bg-navy rounded-lg p-1">
            {["", "user", "tournament"].map((tp) => (
              <button key={tp || "all"} onClick={() => setType(tp)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                  type === tp ? "bg-red text-white" : "text-gray-400 hover:text-white"}`}>
                {tp || "All"}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-navy rounded-lg p-1">
            {["pending", "resolved", "dismissed"].map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                  status === s ? "bg-red text-white" : "text-gray-400 hover:text-white"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
      {loading ? <LoadingRows /> : rows.length === 0 ? (
        <div className="card text-center py-12 text-gray-600 text-sm">No {status} reports</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.report_id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-white">
                  {r.reported_tournament_id
                    ? `🏆 ${r.reported_tournament_name || `Tournament #${r.reported_tournament_id}`}`
                    : `👤 @${r.reported_username || `User #${r.reported_user}`}`}
                  {r.category && (
                    <span className="ml-2 text-xs font-normal text-gray-500 capitalize">
                      {r.category.replace(/_/g, " ")}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(r.created_at).toLocaleDateString("en-IN")} · reported by @{r.reporter_username}
                </p>
              </div>
              <p className="text-sm text-gray-300 mb-3">{r.reason}</p>
              {status === "pending" ? (
                <div className="flex flex-wrap gap-2">
                  <input className="input flex-1 min-w-[180px] text-sm" placeholder="Note to keep on record (optional)"
                    value={notes[r.report_id] || ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.report_id]: e.target.value }))} />
                  <button className="btn-primary text-sm" disabled={busyId === r.report_id} onClick={() => resolve(r, "resolved")}>Resolve</button>
                  <button className="btn-ghost text-sm" disabled={busyId === r.report_id} onClick={() => resolve(r, "dismissed")}>Dismiss</button>
                </div>
              ) : r.resolution_note ? (
                <p className="text-xs text-gray-500">Note: {r.resolution_note}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB — GEAR (§8 — affiliate items shown on /gear)
// ══════════════════════════════════════════════════════════════════════════════
function GearTab({ showToast }) {
  const EMPTY = { name: "", category: "", image_url: "", price_display: "", affiliate_url: "" };
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch("/admin/gear")
      .then((d) => setItems(d.gear || []))
      .catch((e) => showToast(`Failed to load gear: ${e.message}`, false))
      .finally(() => setLoading(false));
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.name.trim() || !form.affiliate_url.trim()) return showToast("Name and affiliate URL are required", false);
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
      await apiFetch("/admin/gear", { method: "POST", body: JSON.stringify(body) });
      setForm(EMPTY);
      showToast("Gear item added");
      load();
    } catch (e) { showToast(e.message, false); }
    finally { setBusy(false); }
  };

  const toggle = async (g) => {
    try {
      await apiFetch(`/admin/gear/${g.item_id}`, { method: "PATCH", body: JSON.stringify({ is_active: !g.is_active }) });
      load();
    } catch (e) { showToast(e.message, false); }
  };

  const remove = async (g) => {
    if (!window.confirm(`Delete "${g.name}"?`)) return;
    try {
      await apiFetch(`/admin/gear/${g.item_id}`, { method: "DELETE" });
      load();
    } catch (e) { showToast(e.message, false); }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="section-title">Gear</h2>
        <p className="section-subtitle">Affiliate items shown on /gear — clicks are tracked through the redirect</p>
      </div>

      <div className="card mb-6 grid sm:grid-cols-2 gap-3">
        <input className="input" placeholder="Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <input className="input" placeholder="Category (e.g. mouse, headset)" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
        <input className="input sm:col-span-2" type="url" placeholder="Affiliate URL * (https://…)" value={form.affiliate_url} onChange={(e) => setForm((f) => ({ ...f, affiliate_url: e.target.value }))} />
        <input className="input" type="url" placeholder="Image URL" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} />
        <input className="input" placeholder="Price shown (e.g. ₹2,499)" value={form.price_display} onChange={(e) => setForm((f) => ({ ...f, price_display: e.target.value }))} />
        <button className="btn-primary text-sm sm:col-span-2" disabled={busy} onClick={add}>{busy ? "Adding…" : "Add item"}</button>
      </div>

      {loading ? <LoadingRows /> : items.length === 0 ? (
        <div className="card text-center py-12 text-gray-600 text-sm">No gear items yet</div>
      ) : (
        <div className="space-y-2">
          {items.map((g) => (
            <div key={g.item_id} className="card flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className={`font-semibold truncate ${g.is_active ? "text-white" : "text-gray-600"}`}>{g.name}</p>
                <p className="text-xs text-gray-500">{g.category || "uncategorised"} · {Number(g.total_clicks)} clicks</p>
              </div>
              <button className="btn-secondary text-xs" onClick={() => toggle(g)}>{g.is_active ? "Hide" : "Show"}</button>
              <button className="btn-ghost text-xs" onClick={() => remove(g)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB — SPONSORS (§5 — applications, manual placements, participation insights)
// ══════════════════════════════════════════════════════════════════════════════
function SponsorsTab({ showToast }) {
  const [apps, setApps] = useState([]);
  const [approved, setApproved] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ tournament_id: "", sponsor_id: "", slot_type: "featured_tournament", ends_at: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/admin/sponsors?status=pending"),
      apiFetch("/admin/sponsors?status=approved"),
      apiFetch("/admin/placements"),
      apiFetch("/admin/sponsor-insights"),
      apiFetch("/tournaments"),
    ])
      .then(([a, ap, pl, ins, t]) => {
        setApps(a.sponsors || []);
        setApproved(ap.sponsors || []);
        setPlacements(pl.placements || []);
        setInsights(ins.insights);
        setTournaments(t.tournaments || []);
      })
      .catch((e) => showToast(`Failed to load sponsors: ${e.message}`, false))
      .finally(() => setLoading(false));
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const decide = async (a, action) => {
    try {
      await apiFetch(`/admin/sponsors/${a.sponsor_id}/${action}`, { method: "POST" });
      showToast(action === "approve" ? `${a.company_name} approved` : `${a.company_name} rejected`);
      load();
    } catch (e) { showToast(e.message, false); }
  };

  const addPlacement = async () => {
    if (!form.tournament_id || !form.sponsor_id) return showToast("Pick a tournament and a sponsor", false);
    setBusy(true);
    try {
      await apiFetch("/admin/placements", {
        method: "POST",
        body: JSON.stringify({
          tournament_id: Number(form.tournament_id),
          sponsor_id: Number(form.sponsor_id),
          slot_type: form.slot_type,
          ...(form.ends_at ? { ends_at: new Date(form.ends_at).toISOString() } : {}),
        }),
      });
      showToast("Placement created");
      setForm((f) => ({ ...f, tournament_id: "", ends_at: "" }));
      load();
    } catch (e) { showToast(e.message, false); }
    finally { setBusy(false); }
  };

  const togglePlacement = async (pl) => {
    try {
      await apiFetch(`/admin/placements/${pl.placement_id}`, { method: "PATCH", body: JSON.stringify({ is_active: !pl.is_active }) });
      load();
    } catch (e) { showToast(e.message, false); }
  };

  if (loading) return <LoadingRows />;

  const qoq = insights?.tournamentParticipation?.qoqChangePercent;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="section-title">Sponsors</h2>
        <p className="section-subtitle">Review applications, assign placements manually, and pull the participation numbers sponsors care about</p>
      </div>

      {/* Insights */}
      {insights && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            ["Registrations (this quarter)", insights.tournamentParticipation.thisQuarter],
            ["Registrations (last quarter)", insights.tournamentParticipation.lastQuarter],
            ["QoQ change", qoq === null ? "—" : `${qoq > 0 ? "+" : ""}${qoq}%`],
          ].map(([l, v]) => (
            <div key={l} className="card">
              <div className="text-2xl font-display font-bold text-white">{v}</div>
              <div className="text-xs text-gray-500 mt-1">{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pending applications */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Pending applications</h3>
        {apps.length === 0 ? (
          <div className="card text-center py-8 text-gray-600 text-sm">No pending applications</div>
        ) : (
          <div className="space-y-3">
            {apps.map((a) => (
              <div key={a.sponsor_id} className="card flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{a.company_name}</p>
                  <p className="text-xs text-gray-500">
                    @{a.username} · {a.contact_email || a.email}{a.website ? ` · ${a.website}` : ""}
                  </p>
                </div>
                <button className="btn-primary text-sm" onClick={() => decide(a, "approve")}>Approve</button>
                <button className="btn-ghost text-sm" onClick={() => decide(a, "reject")}>Reject</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Placements */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Featured placements</h3>
        <div className="card mb-4 grid sm:grid-cols-2 gap-3">
          <select className="input" value={form.tournament_id} onChange={(e) => setForm((f) => ({ ...f, tournament_id: e.target.value }))}>
            <option value="">Select tournament…</option>
            {tournaments.map((t) => <option key={t.tournament_id} value={t.tournament_id}>{t.name}</option>)}
          </select>
          <select className="input" value={form.sponsor_id} onChange={(e) => setForm((f) => ({ ...f, sponsor_id: e.target.value }))}>
            <option value="">Select approved sponsor…</option>
            {approved.map((a) => <option key={a.sponsor_id} value={a.sponsor_id}>{a.company_name}</option>)}
          </select>
          <select className="input" value={form.slot_type} onChange={(e) => setForm((f) => ({ ...f, slot_type: e.target.value }))}>
            <option value="featured_tournament">Featured tournament</option>
            <option value="banner">Banner</option>
          </select>
          <input className="input" type="date" title="Ends on (optional)" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} />
          <button className="btn-primary text-sm sm:col-span-2" disabled={busy} onClick={addPlacement}>
            {busy ? "Creating…" : "Create placement"}
          </button>
        </div>
        {placements.length === 0 ? (
          <div className="card text-center py-8 text-gray-600 text-sm">No placements yet</div>
        ) : (
          <div className="space-y-2">
            {placements.map((pl) => (
              <div key={pl.placement_id} className="card flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold truncate ${pl.is_active ? "text-white" : "text-gray-600"}`}>{pl.tournament_name}</p>
                  <p className="text-xs text-gray-500">
                    {pl.sponsor_name} · {pl.slot_type.replace("_", " ")}{pl.ends_at ? ` · until ${fmt(pl.ends_at)}` : " · no end date"}
                  </p>
                </div>
                <button className="btn-secondary text-xs" onClick={() => togglePlacement(pl)}>
                  {pl.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Arena Coins metrics (Analytics tab) ─────────────────────────────────────
// Fetches on its own so a failure here never blanks the rest of the Analytics tab.
// Definitions live in adminCoinController.getCoinAnalytics.
const coinN = (v) => Number(v).toLocaleString("en-IN");
const coinPct = (v) => (v === null || v === undefined ? "—" : `${Math.round(v * 1000) / 10}%`);
const coinInr = (v) => (v === null || v === undefined ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);

function CoinAnalytics({ showToast }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    apiFetch(`/admin/analytics/coins?days=${days}`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) { setFailed(true); showToast(`Failed to load coin metrics: ${e.message}`, false); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days, showToast]);

  const s = data?.summary;
  const cards = s ? [
    { label: "Coins issued", value: coinN(s.issued), sub: s.issued_per_active_user !== null ? `${coinN(s.issued_per_active_user)} per active user` : "no active users yet", watch: "Much higher than you modelled" },
    { label: "Coins spent on rewards", value: coinN(s.spent), sub: `${coinN(s.redeemers)} redeemer${s.redeemers === 1 ? "" : "s"}`, watch: null },
    { label: "Redemption rate", value: coinPct(s.redemption_rate), sub: `${coinN(s.redeemers)} of ${coinN(s.earners)} earners`, watch: "Far above expectations" },
    { label: "Cash cost (delivered)", value: coinInr(s.cash_cost_inr), sub: `${coinInr(s.cash_cost_per_active_user_inr)} per active user`, watch: "Above your monthly budget" },
    { label: "Max cash liability", value: coinInr(s.max_liability_inr), sub: `${coinN(s.outstanding)} coins outstanding (all time)`, watch: "Above your monthly budget" },
    { label: "Rejected requests", value: coinPct(s.rejection_rate), sub: `${coinN(s.redemptions_rejected)} of ${coinN(s.redemptions_total)} requests`, watch: "Rising trend = fraud or support load" },
    { label: "Earners / active", value: `${coinN(s.earners)} / ${coinN(s.active_users)}`, sub: s.issued_per_earner !== null ? `${coinN(s.issued_per_earner)} coins per earner` : "—", watch: null },
    { label: "Paid Pro among earners", value: coinPct(data.pro.paid_pro_share), sub: `${coinN(data.pro.earners_with_paid_pro)} of ${coinN(data.pro.earners)} earners`, watch: "Flat = multiplier isn't selling Pro" },
  ] : [];

  const retRow = (label, r) => {
    if (!r) return null;
    const cell = (g) => (g.size === 0 ? <span className="text-gray-600">no users yet</span> : (
      <span><span className="text-white font-semibold">{coinPct(g.rate)}</span> <span className="text-gray-500 text-xs">({coinN(g.retained)} of {coinN(g.size)})</span></span>
    ));
    return (
      <tr key={label} className="border-b border-surface-border/50">
        <td className="px-4 py-3 text-white">{label}</td>
        <td className="px-4 py-3">{cell(r.engaged)}</td>
        <td className="px-4 py-3">{cell(r.other)}</td>
      </tr>
    );
  };

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Arena Coins</h3>
          <p className="text-xs text-gray-600 mt-0.5">Is the coin economy affordable, and is it doing anything for retention?</p>
        </div>
        <div className="flex gap-1 bg-navy rounded-lg p-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${days === d ? "bg-red text-white" : "text-gray-400 hover:text-white"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? <LoadingGrid /> : failed && !data ? (
        <div className="card text-center py-10 text-gray-600 text-sm">Couldn't load coin metrics.</div>
      ) : data && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {cards.map((c) => (
              <div key={c.label} className="card">
                <div className="text-xs text-gray-500">{c.label}</div>
                <div className="text-2xl font-display font-bold text-white mt-1">{c.value}</div>
                <div className="text-xs text-gray-500 mt-1">{c.sub}</div>
                {c.watch && <div className="text-[11px] text-gray-600 mt-2">Watch for: {c.watch}</div>}
              </div>
            ))}
          </div>

          {s.manual_net !== 0 && (
            <p className="text-xs text-gray-500 mb-4">
              Manual admin adjustments in this period: <span className="text-gray-300">{s.manual_net > 0 ? "+" : ""}{coinN(s.manual_net)}</span> coins (not included in "issued").
            </p>
          )}

          <div className="card mb-6">
            <div className="text-xs text-gray-500 mb-2">Coins issued vs spent per day</div>
            <TrendChart
              trend={data.trend}
              xKey="day"
              series={[
                { key: "issued", label: "Issued", color: "#22c55e" },
                { key: "spent", label: "Spent on rewards", color: "#ff4655" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-gray-500 mb-2">Retention: coin-engaged vs other new users</div>
              <div className="card p-0 overflow-hidden">
                {data.retention.d7 ? (
                  <table className="w-full text-sm">
                    <thead className="bg-navy border-b border-surface-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Day</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Earned non-login coins in first 3 days</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Others</th>
                      </tr>
                    </thead>
                    <tbody>{retRow("D7", data.retention.d7)}{retRow("D30", data.retention.d30)}</tbody>
                  </table>
                ) : (
                  <p className="text-gray-600 text-sm py-8 text-center">No coin activity yet</p>
                )}
              </div>
              <p className="text-[11px] text-gray-600 mt-2">
                Only users who signed up after coins launched{data.retention.since ? ` (${fmt(data.retention.since)})` : ""}. Retained = logged in on exactly that day, as in the cohort table above.
                This shows correlation: engaged users were always likelier to come back, so a gap alone doesn't prove coins cause it.
              </p>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-2">ArenaX Pro: coin trial to paid</div>
              <div className="card">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-3xl font-display font-bold text-white">{coinPct(data.pro.trial_conversion_rate)}</span>
                  <span className="text-xs text-gray-500">of users who redeemed Pro days later bought paid Pro</span>
                </div>
                <p className="text-xs text-gray-500">
                  {coinN(data.pro.trial_converted)} of {coinN(data.pro.trialists)} users (all time).
                </p>
                <p className="text-[11px] text-gray-600 mt-3">
                  Redemption, cash-cost and rejection figures cover the selected period; liability is the current total. Cash cost counts delivered gift cards and top-ups only. Pro days cost no cash.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -- Referrals (Analytics tab) ------------------------------------------------
// Is the invite loop bringing in real users, and is anyone farming it?
// Fetches on its own so a failure never blanks the rest of the Analytics tab.
function ReferralAnalytics({ showToast }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/admin/analytics/referrals")
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) { setFailed(true); showToast(`Failed to load referral metrics: ${e.message}`, false); } });
    return () => { cancelled = true; };
  }, [showToast]);

  const s = data?.summary;
  return (
    <div className="mt-10">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Referrals</h3>
      <p className="text-xs text-gray-600 mt-0.5 mb-3">Is the invite loop bringing in real, active users?</p>
      {failed && !data ? (
        <div className="card text-center py-10 text-gray-600 text-sm">Couldn't load referral metrics.</div>
      ) : !data ? <LoadingGrid /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Invited", value: coinN(s.invited), sub: `${coinN(s.invited_30d)} in the last 30 days` },
              { label: "Activated", value: coinN(s.activated), sub: `${coinPct(s.activation_rate)} of invited \u00B7 ${coinN(s.activated_30d)} in 30 days` },
              { label: "Share of signups via referral", value: coinPct(s.share_of_signups), sub: `${coinN(s.referrers)} referrer${s.referrers === 1 ? "" : "s"}` },
              { label: "Referral coins paid", value: coinN(s.coins_paid), sub: `${coinN(s.coins_on_hold)} on hold \u00B7 ${coinN(Math.abs(s.coins_reversed))} reversed` },
            ].map((c) => (
              <div key={c.label} className="card">
                <div className="text-xs text-gray-500">{c.label}</div>
                <div className="text-2xl font-display font-bold text-white mt-1">{c.value}</div>
                <div className="text-xs text-gray-500 mt-1">{c.sub}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mb-2">Top referrers</div>
          <div className="card p-0 overflow-hidden">
            {data.top.length === 0 ? (
              <p className="text-gray-600 text-sm py-8 text-center">No referrals yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-navy border-b border-surface-border">
                  <tr>
                    {["User", "Invited", "Activated", "Rate", "Coins"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.top.map((t) => (
                    <tr key={t.user_id} className="border-b border-surface-border/50">
                      <td className="px-4 py-3 text-white">@{t.username}{t.status !== "active" && <span className="text-red text-xs"> ({t.status})</span>}</td>
                      <td className="px-4 py-3 text-gray-300">{coinN(t.invited)}</td>
                      <td className="px-4 py-3 text-gray-300">{coinN(t.activated)}</td>
                      <td className="px-4 py-3 text-gray-300">{coinPct(t.activation_rate)}</td>
                      <td className="px-4 py-3 text-gray-300">{coinN(t.coins)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="text-[11px] text-gray-600 mt-2">
            Watch for one referrer whose friends all activate almost instantly: referral coins are held and reversed if the friend is banned, but review those accounts before approving a large redemption.
          </p>
        </>
      )}
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
