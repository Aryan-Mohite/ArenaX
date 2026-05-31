/**
 * AdminArchiveDashboard.jsx
 *
 * FIX H3: Rewrote to use the shared API axios instance (src/api/api.js) instead
 * of a custom fetch wrapper with a hardcoded localhost:5000 fallback.
 * - JWT is auto-attached by the axios interceptor in api.js
 * - Base URL is read from VITE_API_URL (or defaults to '/api' for same-origin proxy)
 * - No more localhost leaking into production builds
 */

import { useState, useEffect, useCallback } from "react";
import API from "../../api/api";

const ENTITY_TYPES = [
  { value: "", label: "All Types" },
  { value: "tournament", label: "Tournaments" },
  { value: "team", label: "Teams" },
  { value: "stream", label: "Streams" },
  { value: "community_post", label: "Community Posts" },
  { value: "team_finder_post", label: "Team Finder Posts" },
  { value: "match", label: "Matches" },
];

const RESTORABLE = ["tournament", "team", "stream"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const entityColor = (type) =>
  ({
    tournament: "#f97316",
    team: "#3b82f6",
    stream: "#a855f7",
    community_post: "#22c55e",
    team_finder_post: "#eab308",
    match: "#ef4444",
  })[type] ?? "#6b7280";

const entityIcon = (type) =>
  ({
    tournament: "🏆",
    team: "🛡️",
    stream: "📡",
    community_post: "💬",
    team_finder_post: "🔍",
    match: "⚔️",
  })[type] ?? "📦";

// ─── API helpers using shared axios instance ───────────────────────────────────
const archiveGet  = (path, params) => API.get(`/archive${path}`, { params }).then(r => r.data);
const archivePost = (path)         => API.post(`/archive${path}`).then(r => r.data);
const archiveDel  = (path)         => API.delete(`/archive${path}`).then(r => r.data);

// =============================================================================
// Main Component
// =============================================================================
export default function AdminArchiveDashboard() {
  const [tab, setTab] = useState("archives");
  const [archives, setArchives] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);
  const [toast, setToast] = useState(null);

  const [entityType, setEntityType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchArchives = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await archiveGet("/admin/archives", {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        ...(entityType ? { entity_type: entityType } : {}),
      });
      setArchives(data.archives ?? []);
    } catch (e) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  }, [entityType, page]);

  const fetchAuditLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await archiveGet("/admin/archives/audit", {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        ...(entityType ? { entity_type: entityType } : {}),
        ...(fromDate ? { from_date: fromDate } : {}),
        ...(toDate ? { to_date: toDate } : {}),
      });
      setAuditLog(data.audit_log ?? []);
    } catch (e) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  }, [entityType, fromDate, toDate, page]);

  useEffect(() => {
    if (tab === "archives") fetchArchives();
    else fetchAuditLog();
    setExpanded(null);
    setSnapshot(null);
  }, [tab, fetchArchives, fetchAuditLog]);

  const handleExpand = async (row) => {
    if (expanded === row.log_id) {
      setExpanded(null);
      setSnapshot(null);
      return;
    }
    setExpanded(row.log_id);
    setSnapshot(null);
    setSnapshotLoading(true);
    try {
      const data = await archiveGet(`/admin/archives/${row.entity_type}/${row.entity_id}`);
      setSnapshot(data.archived_item);
    } catch (e) {
      setSnapshot({ error: e.response?.data?.message ?? e.message });
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleRestore = async (type, entityId, entityName) => {
    if (!window.confirm(`Restore "${entityName}"? This will re-insert it into the live database.`)) return;
    setRestoring(entityId);
    try {
      await archivePost(`/admin/archives/restore/${type}/${entityId}`);
      showToast(`✅ "${entityName}" restored successfully.`);
      fetchArchives();
    } catch (e) {
      showToast(`❌ Restore failed: ${e.response?.data?.message ?? e.message}`, false);
    } finally {
      setRestoring(null);
    }
  };

  const handlePurge = async () => {
    if (!window.confirm("⚠️ Permanently delete all archives older than the retention period? This CANNOT be undone.")) return;
    setPurging(true);
    setPurgeResult(null);
    try {
      const data = await archiveDel("/admin/archives/purge");
      setPurgeResult(data.purged);
      showToast("🗑️ Old archives purged.");
      fetchArchives();
    } catch (e) {
      showToast(`❌ Purge failed: ${e.response?.data?.message ?? e.message}`, false);
    } finally {
      setPurging(false);
    }
  };

  return (
    <div style={styles.root}>
      {toast && (
        <div style={{ ...styles.toast, background: toast.ok ? "#16a34a" : "#dc2626" }}>
          {toast.msg}
        </div>
      )}

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🗄️ Archive Manager</h1>
          <p style={styles.subtitle}>View, inspect, and restore archived ArenaX data</p>
        </div>
        <button style={styles.dangerBtn} onClick={handlePurge} disabled={purging}>
          {purging ? "Purging…" : "🗑️ Purge Old Archives"}
        </button>
      </div>

      {purgeResult && (
        <div style={styles.purgeResult}>
          <strong>Purge complete:</strong>{" "}
          {purgeResult.map((r) => `${r.table_name}: ${r.rows_purged} rows`).join(" · ")}
        </div>
      )}

      <div style={styles.tabs}>
        {["archives", "audit"].map((t) => (
          <button
            key={t}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
            onClick={() => { setTab(t); setPage(0); }}
          >
            {t === "archives" ? "📦 Archived Items" : "📋 Audit Log"}
          </button>
        ))}
      </div>

      <div style={styles.filters}>
        <select style={styles.select} value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(0); }}>
          {ENTITY_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {tab === "audit" && (
          <>
            <input type="date" style={styles.input} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <input type="date" style={styles.input} value={toDate}   onChange={(e) => setToDate(e.target.value)} />
          </>
        )}
        <button style={styles.refreshBtn} onClick={tab === "archives" ? fetchArchives : fetchAuditLog}>↻ Refresh</button>
      </div>

      {error && <div style={styles.errorBanner}>⚠️ {error}</div>}
      {loading && <div style={styles.loadingBar}><div style={styles.loadingInner} /></div>}

      {tab === "archives" && !loading && (
        <div style={styles.tableWrap}>
          {archives.length === 0 ? (
            <div style={styles.empty}>No archived items found.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Archived At</th>
                  <th style={styles.th}>Reason</th>
                  <th style={styles.th}>Archived By</th>
                  <th style={styles.th}>Restored?</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archives.map((row) => (
                  <>
                    <tr
                      key={row.log_id}
                      style={{ ...styles.tr, background: expanded === row.log_id ? "#1e293b" : "transparent", cursor: "pointer" }}
                      onClick={() => handleExpand(row)}
                    >
                      <td style={styles.td}>
                        <span style={{ ...styles.typeBadge, background: entityColor(row.entity_type) + "22", color: entityColor(row.entity_type), borderColor: entityColor(row.entity_type) + "55" }}>
                          {entityIcon(row.entity_type)} {row.entity_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={{ ...styles.td, fontWeight: 600, color: "#f1f5f9" }}>{row.entity_name ?? `ID: ${row.entity_id}`}</td>
                      <td style={styles.td}>{fmtDate(row.archived_at)}</td>
                      <td style={styles.td}><span style={styles.reasonBadge}>{row.archive_reason}</span></td>
                      <td style={styles.td}>{row.archived_by_user ?? "system"}</td>
                      <td style={styles.td}>
                        {row.restored_at
                          ? <span style={styles.restoredBadge}>✅ {fmtDate(row.restored_at)}</span>
                          : <span style={styles.pendingBadge}>—</span>}
                      </td>
                      <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.actionRow}>
                          <button style={styles.inspectBtn} onClick={() => handleExpand(row)}>
                            {expanded === row.log_id ? "▲ Hide" : "▼ Inspect"}
                          </button>
                          {RESTORABLE.includes(row.entity_type) && !row.restored_at && (
                            <button
                              style={styles.restoreBtn}
                              disabled={restoring === row.entity_id}
                              onClick={() => handleRestore(row.entity_type, row.entity_id, row.entity_name)}
                            >
                              {restoring === row.entity_id ? "…" : "↩ Restore"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === row.log_id && (
                      <tr key={`${row.log_id}-snap`}>
                        <td colSpan={7} style={styles.snapshotTd}>
                          {snapshotLoading
                            ? <div style={styles.snapshotLoading}>Loading snapshot…</div>
                            : snapshot?.error
                              ? <div style={styles.snapshotError}>⚠️ {snapshot.error}</div>
                              : <SnapshotViewer data={snapshot} entityType={row.entity_type} />}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "audit" && !loading && (
        <div style={styles.tableWrap}>
          {auditLog.length === 0 ? (
            <div style={styles.empty}>No audit entries found.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Entity</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Archived At</th>
                  <th style={styles.th}>Reason</th>
                  <th style={styles.th}>Archived By</th>
                  <th style={styles.th}>Restored At</th>
                  <th style={styles.th}>Restored By</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((row) => (
                  <tr key={row.log_id} style={styles.tr}>
                    <td style={{ ...styles.td, color: "#64748b", fontSize: 12 }}>{row.log_id}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.typeBadge, background: entityColor(row.entity_type) + "22", color: entityColor(row.entity_type), borderColor: entityColor(row.entity_type) + "55" }}>
                        {entityIcon(row.entity_type)} {row.entity_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ ...styles.td, color: "#f1f5f9", fontWeight: 600 }}>{row.entity_name ?? `ID ${row.entity_id}`}</td>
                    <td style={styles.td}>{fmtDate(row.archived_at)}</td>
                    <td style={styles.td}><span style={styles.reasonBadge}>{row.archive_reason}</span></td>
                    <td style={styles.td}>{row.archived_by_user ?? "system"}</td>
                    <td style={styles.td}>{row.restored_at ? <span style={styles.restoredBadge}>{fmtDate(row.restored_at)}</span> : "—"}</td>
                    <td style={styles.td}>{row.restored_by_user ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div style={styles.pagination}>
        <button style={styles.pageBtn} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
        <span style={styles.pageNum}>Page {page + 1}</span>
        <button
          style={styles.pageBtn}
          disabled={(tab === "archives" ? archives : auditLog).length < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Snapshot Viewer
// =============================================================================
function SnapshotViewer({ data, entityType }) {
  const [showRaw, setShowRaw] = useState(false);
  if (!data) return <div style={styles.snapshotLoading}>No snapshot data.</div>;

  const childKey = ({
    tournament:       ["registrations_snapshot", "matches_snapshot"],
    team:             ["members_snapshot", "invitations_snapshot"],
    community_post:   ["comments_snapshot"],
    team_finder_post: ["applications_snapshot"],
    match:            ["player_stats_snapshot"],
    stream:           [],
  })[entityType] ?? [];

  const auditCols = new Set(["archived_at", "archived_by", "archive_reason", ...childKey]);
  const coreEntries = Object.entries(data).filter(([k]) => !auditCols.has(k));

  return (
    <div style={styles.snapshot}>
      <div style={styles.snapshotHeader}>
        <span style={styles.snapshotTitle}>📋 Archived Snapshot</span>
        <button style={styles.rawToggle} onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? "Table view" : "Raw JSON"}
        </button>
      </div>
      {showRaw ? (
        <pre style={styles.rawJson}>{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <>
          <div style={styles.fieldGrid}>
            {coreEntries.map(([k, v]) => (
              <div key={k} style={styles.fieldItem}>
                <div style={styles.fieldKey}>{k.replace(/_/g, " ")}</div>
                <div style={styles.fieldVal}>
                  {v === null ? <em style={{ color: "#64748b" }}>null</em>
                    : typeof v === "boolean" ? (v ? "✅" : "❌")
                    : String(v)}
                </div>
              </div>
            ))}
          </div>
          {childKey.map((key) => {
            const arr = data[key];
            return (
              <div key={key} style={styles.childSection}>
                <div style={styles.childTitle}>
                  {key.replace(/_/g, " ").replace("snapshot", "").trim()}
                  {arr?.length > 0 && <span style={styles.childCount}>{arr.length}</span>}
                </div>
                {!arr?.length
                  ? <div style={{ color: "#64748b", fontSize: 13, padding: "8px 0" }}>None recorded.</div>
                  : <div style={styles.childScroll}>
                      {arr.map((item, i) => (
                        <div key={i} style={styles.childCard}>
                          {Object.entries(item).map(([k, v]) => (
                            <div key={k} style={styles.childRow}>
                              <span style={styles.childKey}>{k}</span>
                              <span style={styles.childVal}>{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// =============================================================================
// Styles
// =============================================================================
const styles = {
  root: { minHeight: "100vh", background: "#0f172a", color: "#94a3b8", fontFamily: "'DM Mono', 'Fira Code', 'Courier New', monospace", padding: "32px 24px", position: "relative" },
  toast: { position: "fixed", top: 24, right: 24, zIndex: 9999, padding: "12px 20px", borderRadius: 8, color: "#fff", fontWeight: 600, fontSize: 14, boxShadow: "0 4px 24px rgba(0,0,0,0.4)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  title: { fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: 0, letterSpacing: -0.5 },
  subtitle: { margin: "4px 0 0", fontSize: 14, color: "#64748b" },
  dangerBtn: { background: "transparent", border: "1.5px solid #dc2626", color: "#ef4444", padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" },
  purgeResult: { background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "10px 16px", fontSize: 13, marginBottom: 20, color: "#94a3b8" },
  tabs: { display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #1e293b" },
  tab: { background: "transparent", border: "none", color: "#64748b", padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit", borderBottom: "2px solid transparent" },
  tabActive: { color: "#f97316", borderBottom: "2px solid #f97316" },
  filters: { display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" },
  select: { background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9", padding: "9px 14px", borderRadius: 8, fontSize: 13, fontFamily: "inherit", cursor: "pointer", outline: "none" },
  input: { background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9", padding: "9px 14px", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" },
  refreshBtn: { background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", padding: "9px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  errorBanner: { background: "#450a0a", border: "1px solid #dc2626", color: "#fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 14 },
  loadingBar: { height: 3, background: "#1e293b", borderRadius: 2, overflow: "hidden", marginBottom: 16 },
  loadingInner: { height: "100%", width: "40%", background: "#f97316", borderRadius: 2, animation: "slide 1s infinite" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thead: { background: "#1e293b" },
  th: { padding: "12px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, borderBottom: "1px solid #334155" },
  tr: { borderBottom: "1px solid #1e293b" },
  td: { padding: "12px 14px", verticalAlign: "middle", color: "#94a3b8" },
  typeBadge: { display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 99, border: "1px solid", fontSize: 12, fontWeight: 600, textTransform: "capitalize", whiteSpace: "nowrap" },
  reasonBadge: { display: "inline-block", background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", padding: "2px 8px", borderRadius: 6, fontSize: 12 },
  restoredBadge: { color: "#22c55e", fontSize: 12, fontWeight: 600 },
  pendingBadge: { color: "#475569" },
  actionRow: { display: "flex", gap: 8, alignItems: "center" },
  inspectBtn: { background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" },
  restoreBtn: { background: "#0c4a6e", border: "1px solid #0369a1", color: "#38bdf8", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 700 },
  snapshotTd: { padding: 0, background: "#0f172a" },
  snapshotLoading: { padding: "16px 24px", color: "#64748b", fontSize: 13 },
  snapshotError: { padding: "16px 24px", color: "#ef4444", fontSize: 13 },
  snapshot: { borderTop: "1px solid #1e293b", borderBottom: "2px solid #f97316", padding: "20px 24px", background: "#0c1626" },
  snapshotHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  snapshotTitle: { fontSize: 13, fontWeight: 700, color: "#f1f5f9", letterSpacing: 0.5, textTransform: "uppercase" },
  rawToggle: { background: "transparent", border: "1px solid #334155", color: "#64748b", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "inherit" },
  rawJson: { fontSize: 11, color: "#94a3b8", background: "#1e293b", padding: 16, borderRadius: 8, overflowX: "auto", maxHeight: 400, lineHeight: 1.6, margin: 0 },
  fieldGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 20 },
  fieldItem: { background: "#1e293b", borderRadius: 8, padding: "10px 14px" },
  fieldKey: { fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, fontWeight: 700 },
  fieldVal: { fontSize: 13, color: "#e2e8f0", fontWeight: 500, wordBreak: "break-all" },
  childSection: { marginTop: 16 },
  childTitle: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#f97316", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  childCount: { background: "#f9731622", border: "1px solid #f9731655", color: "#f97316", borderRadius: 99, padding: "1px 8px", fontSize: 11, fontWeight: 700 },
  childScroll: { display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 },
  childCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", minWidth: 240, flexShrink: 0 },
  childRow: { display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0", borderBottom: "1px solid #0f172a", fontSize: 12 },
  childKey: { color: "#475569", fontWeight: 600, minWidth: 90 },
  childVal: { color: "#cbd5e1", wordBreak: "break-all", textAlign: "right" },
  pagination: { display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginTop: 28 },
  pageBtn: { background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  pageNum: { fontSize: 13, color: "#64748b", minWidth: 60, textAlign: "center" },
  empty: { textAlign: "center", padding: "60px 0", color: "#334155", fontSize: 15 },
};
