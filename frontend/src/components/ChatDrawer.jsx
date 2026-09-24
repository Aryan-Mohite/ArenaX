import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useChatContext } from "../context/ChatContext";
import {
  getTeamMessages,
  sendTeamMessage,
  deleteTeamMessage,
  markTeamRead,
  getDmMessages,
  sendDmMessage,
  deleteDmMessage,
  markDmRead,
  getSwipeMessages,
  sendSwipeMessage,
  deleteSwipeMessage,
  markSwipeRead,
} from "../services/chatService";

// ─── Per-chatType API dispatch ─────────────────────────────────────────────────
// Keeps the 'team' | 'dm' | 'swipe' branching in one place instead of a
// ternary at every call site.
const CHAT_API = {
  team:  { get: getTeamMessages,  send: sendTeamMessage,  del: deleteTeamMessage,  read: markTeamRead },
  dm:    { get: getDmMessages,    send: sendDmMessage,    del: deleteDmMessage,    read: markDmRead },
  swipe: { get: getSwipeMessages, send: sendSwipeMessage, del: deleteSwipeMessage, read: markSwipeRead },
};

const POLL_MS = 4_000; // 4 s while drawer is open

// ─── How long we keep messages (must match backend RETENTION_DAYS) ────────────
const RETENTION_DAYS = 7;

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function timeStr(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function dateLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─── WhatsApp-style per-user name colours ─────────────────────────────────────
const NAME_PALETTE = [
  "#ff6b6b", // coral red
  "#ffd93d", // yellow
  "#6bcb77", // green
  "#4d96ff", // blue
  "#c77dff", // purple
  "#ff9a3c", // orange
  "#51e5ff", // cyan
  "#f72585", // pink
];

function nameColor(username = "") {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return NAME_PALETTE[Math.abs(hash) % NAME_PALETTE.length];
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ username, picture, color, size = 8 }) {
  return (
    <div
      className={`w-${size} h-${size} rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold`}
      style={{
        background: picture ? "transparent" : `${color}22`,
        border: `1.5px solid ${color}55`,
        color: color,
      }}
    >
      {picture ? (
        <img
          loading="lazy"
          src={picture}
          alt={username}
          className="w-full h-full object-cover"
        />
      ) : (
        username?.[0]?.toUpperCase()
      )}
    </div>
  );
}

// ─── Single message bubble ─────────────────────────────────────────────────────
/**
 * isFirstInGroup  → show avatar + name above bubble
 * isLastInGroup   → show timestamp below bubble
 * isTeam          → team group chat (show sender names for others)
 * isActive        → action row (Reply / Delete) is currently shown for this bubble
 * onToggleActions → tapping the bubble shows/hides the action row
 * onReply         → set this message as the one being replied to
 * onDelete        → soft-delete this message (only ever called when isMine)
 */
function Bubble({
  msg,
  isMine,
  isFirstInGroup,
  isLastInGroup,
  isTeam,
  isActive,
  onToggleActions,
  onReply,
  onDelete,
}) {
  const color = nameColor(msg.username);
  const isDeleted = !!msg.is_deleted;

  return (
    <div
      className={`flex gap-2 max-w-[85%] ${isMine ? "ml-auto flex-row-reverse" : ""}`}
    >
      {/* Avatar — only for others, only on the first message of a group */}
      {!isMine && isFirstInGroup && (
        <Avatar
          username={msg.username}
          picture={msg.profile_picture}
          color={color}
        />
      )}
      {/* Spacer that aligns later messages in the group with the bubble */}
      {!isMine && !isFirstInGroup && <div className="w-8 shrink-0" />}

      <div
        className={`flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}
      >
        {/* Sender name — only for team chat, others' messages, first in group */}
        {isTeam && !isMine && isFirstInGroup && (
          <span
            className="text-[11px] font-semibold px-1 tracking-wide"
            style={{ color }}
          >
            {msg.username}
          </span>
        )}

        <div
          onClick={() => !isDeleted && onToggleActions(msg.message_id)}
          className="px-3 py-2 text-sm leading-relaxed break-words cursor-pointer select-none"
          style={{
            borderRadius: isMine
              ? isFirstInGroup
                ? "18px 18px 4px 18px"
                : "18px 4px 4px 18px"
              : isFirstInGroup
                ? "18px 18px 18px 4px"
                : "4px 18px 18px 4px",
            ...(isMine
              ? {
                  background: "rgba(255,70,85,0.22)",
                  border: "1px solid rgba(255,70,85,0.4)",
                  color: "#fff",
                }
              : {
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#e5e7eb",
                }),
          }}
        >
          {/* Quoted reply preview */}
          {msg.reply_to_id && (
            <div
              className="mb-1.5 pl-2 py-1 text-[11px] rounded"
              style={{
                borderLeft: `2.5px solid ${color}`,
                background: "rgba(0,0,0,0.15)",
              }}
            >
              <p className="font-semibold" style={{ color }}>
                {msg.reply_username || "Unknown"}
              </p>
              <p className="opacity-70 truncate">
                {msg.reply_is_deleted
                  ? "This message was deleted"
                  : msg.reply_content || "…"}
              </p>
            </div>
          )}

          {isDeleted ? (
            <span className="italic opacity-50">🚫 This message was deleted</span>
          ) : (
            msg.content
          )}
        </div>

        {/* Timestamp — only on the last bubble of a group */}
        {isLastInGroup && !isActive && (
          <span className="text-[9px] text-gray-600 px-1">
            {timeStr(msg.sent_at)}
          </span>
        )}

        {/* Action row — Reply / Delete, shown when the bubble is tapped */}
        {isActive && !isDeleted && (
          <div
            className={`flex items-center gap-1 mt-0.5 ${isMine ? "flex-row-reverse" : ""}`}
          >
            <button
              onClick={() => onReply(msg)}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors"
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "#c9cdd6",
              }}
            >
              ↩ Reply
            </button>
            {isMine && (
              <button
                onClick={() => onDelete(msg)}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors"
                style={{
                  background: "rgba(255,70,85,0.15)",
                  color: "#ff8a94",
                }}
              >
                🗑 Delete
              </button>
            )}
            <span className="text-[9px] text-gray-600 px-1">
              {timeStr(msg.sent_at)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Retention notice ─────────────────────────────────────────────────────────
function RetentionBanner() {
  return (
    <div
      className="mx-3 mb-3 px-3 py-2 rounded-xl flex items-center gap-2 shrink-0"
      style={{
        background: "rgba(99,102,241,0.08)",
        border: "1px solid rgba(99,102,241,0.2)",
      }}
    >
      <span className="text-[13px]">🗑️</span>
      <p className="text-[10px] leading-snug" style={{ color: "#a5b4fc" }}>
        Messages older than <strong>{RETENTION_DAYS} days</strong> are
        automatically deleted to save space.
      </p>
    </div>
  );
}

// ─── Reply preview strip (shown above the input while composing a reply) ──────
function ReplyPreview({ replyingTo, onCancel }) {
  if (!replyingTo) return null;
  return (
    <div
      className="mx-3 mb-2 px-3 py-2 rounded-xl flex items-start justify-between gap-2 shrink-0"
      style={{
        background: "rgba(255,255,255,0.05)",
        borderLeft: "3px solid #ff4655",
      }}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold" style={{ color: "#ff4655" }}>
          Replying to {replyingTo.username}
        </p>
        <p className="text-[11px] text-gray-400 truncate">
          {replyingTo.content}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="text-gray-500 hover:text-white shrink-0 text-sm leading-none"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Main ChatDrawer ───────────────────────────────────────────────────────────
/**
 * Props:
 *   open        boolean
 *   onClose     () => void
 *   chatType    'team' | 'dm' | 'swipe'
 *   chatId      number  (teamId for 'team', applicationId for 'dm', matchId for 'swipe')
 *   title       string  (e.g. "Alpha Squad" or "Chat with shivaay_dev")
 *   subtitle    string  optional
 */
export default function ChatDrawer({
  open,
  onClose,
  chatType,
  chatId,
  title,
  subtitle,
}) {
  const { user } = useAuth();
  const { refresh: refreshBadges } = useChatContext();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [activeActionId, setActiveActionId] = useState(null);

  const lastIdRef = useRef(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const intervalRef = useRef(null);
  const isInitRef = useRef(false);

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const fetchMessages = useCallback(
    async (initial = false) => {
      if (!chatId || !chatType) return;
      try {
        const after = initial ? 0 : lastIdRef.current;
        const res = await CHAT_API[chatType].get(chatId, after);

        const msgs = res.data.messages || [];
        if (msgs.length === 0) return;

        if (initial) {
          setMessages(msgs);
        } else {
          setMessages((prev) => {
            // Merge in edits (e.g. deletions) to already-seen messages, then
            // append any brand-new ones.
            const seen = new Map(prev.map((m) => [m.message_id, m]));
            msgs.forEach((m) => seen.set(m.message_id, m));
            return Array.from(seen.values()).sort(
              (a, b) => a.message_id - b.message_id,
            );
          });
        }

        const newLast = msgs[msgs.length - 1].message_id;
        lastIdRef.current = newLast;

        // Mark as read + refresh badge count
        CHAT_API[chatType].read(chatId, newLast).catch(() => {});
        refreshBadges();
      } catch (err) {
        if (initial) setError("Could not load messages");
      } finally {
        if (initial) setLoading(false);
      }
    },
    [chatId, chatType, refreshBadges],
  );

  // ── Open / close lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !chatId) return;

    // Reset state each time a new chat opens
    setMessages([]);
    setLoading(true);
    setError(null);
    setInput("");
    setReplyingTo(null);
    setActiveActionId(null);
    lastIdRef.current = 0;
    isInitRef.current = false;

    // Initial load
    fetchMessages(true).then(() => {
      isInitRef.current = true;
    });

    // Start polling
    intervalRef.current = setInterval(() => fetchMessages(false), POLL_MS);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [open, chatId, chatType, fetchMessages]);

  // ── Auto-scroll to bottom on new messages ─────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ── Focus input when drawer opens ─────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    const replyToId = replyingTo?.message_id || null;
    try {
      const res = await CHAT_API[chatType].send(chatId, text, replyToId);
      const msg = res.data.message;
      setMessages((prev) => [...prev, msg]);
      lastIdRef.current = msg.message_id;
      setReplyingTo(null);
      CHAT_API[chatType].read(chatId, msg.message_id).catch(() => {});
    } catch {
      setInput(text); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Reply / Delete / action-row toggle ─────────────────────────────────────
  const toggleActions = (messageId) => {
    setActiveActionId((prev) => (prev === messageId ? null : messageId));
  };

  const handleReply = (msg) => {
    setReplyingTo(msg);
    setActiveActionId(null);
    inputRef.current?.focus();
  };

  const handleDelete = async (msg) => {
    setActiveActionId(null);
    if (!window.confirm("Delete this message? This cannot be undone.")) return;

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) =>
        m.message_id === msg.message_id
          ? { ...m, content: "", is_deleted: 1 }
          : m,
      ),
    );
    // Clear it as a reply target if it was selected
    setReplyingTo((prev) =>
      prev?.message_id === msg.message_id ? null : prev,
    );

    try {
      await CHAT_API[chatType].del(chatId, msg.message_id);
    } catch {
      // Revert on failure
      setMessages((prev) =>
        prev.map((m) => (m.message_id === msg.message_id ? msg : m)),
      );
    }
  };

  // ── Group consecutive messages from the same sender ───────────────────────
  // Grouping resets when: sender changes OR date changes (WhatsApp-style)
  const isTeam = chatType === "team";
  const groupedMessages = messages.map((msg, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];

    const sameSenderAsPrev =
      prev &&
      prev.sender_id === msg.sender_id &&
      dateLabel(prev.sent_at) === dateLabel(msg.sent_at);
    const sameSenderAsNext =
      next &&
      next.sender_id === msg.sender_id &&
      dateLabel(next.sent_at) === dateLabel(msg.sent_at);

    return {
      ...msg,
      isFirstInGroup: !sameSenderAsPrev,
      isLastInGroup: !sameSenderAsNext,
    };
  });

  // ── Date separator tracking ────────────────────────────────────────────────
  let lastDate = null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Scrim — dims the rest of the page */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.5)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300 ease-in-out"
        style={{
          width: "min(420px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          background: "linear-gradient(180deg, #12192e 0%, #0d1424 100%)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 py-3.5 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{
              background: "rgba(255,70,85,0.15)",
              border: "1px solid rgba(255,70,85,0.3)",
            }}
          >
            {chatType === "team" ? "🛡️" : chatType === "swipe" ? "🎮" : "💬"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm truncate">{title}</p>
            {subtitle && (
              <p className="text-[10px] text-gray-500 truncate">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {/* DM notice banner */}
        {chatType === "dm" && (
          <div
            className="mx-3 mt-3 px-3 py-2 rounded-xl text-xs text-yellow-400 flex items-center gap-2 shrink-0"
            style={{
              background: "rgba(234,179,8,0.08)",
              border: "1px solid rgba(234,179,8,0.2)",
            }}
          >
            🔒 Draft chat — visible only while your application is under review
          </div>
        )}

        {/* ── Messages ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {loading && (
            <div className="flex justify-center items-center h-full">
              <div className="w-6 h-6 border-2 border-surface-border border-t-red rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <p className="text-center text-sm text-gray-500 mt-8">{error}</p>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-600">
              <span className="text-3xl opacity-40">💬</span>
              <p className="text-sm">No messages yet — say hello!</p>
            </div>
          )}

          {groupedMessages.map((msg) => {
            const msgDate = dateLabel(msg.sent_at);
            const showDate = msgDate !== lastDate;
            lastDate = msgDate;
            return (
              <div key={msg.message_id}>
                {showDate && (
                  <div className="flex items-center gap-2 my-4">
                    <div
                      className="flex-1 h-px"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    />
                    <span className="text-[10px] text-gray-600 px-2">
                      {msgDate}
                    </span>
                    <div
                      className="flex-1 h-px"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    />
                  </div>
                )}
                {/* Add vertical gap between groups (different senders) */}
                {msg.isFirstInGroup && <div className="h-1" />}
                <Bubble
                  msg={msg}
                  isMine={msg.sender_id === user?.id}
                  isFirstInGroup={msg.isFirstInGroup}
                  isLastInGroup={msg.isLastInGroup}
                  isTeam={isTeam}
                  isActive={activeActionId === msg.message_id}
                  onToggleActions={toggleActions}
                  onReply={handleReply}
                  onDelete={handleDelete}
                />
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* ── Retention notice ───────────────────────────────────── */}
        <RetentionBanner />

        {/* ── Reply preview ──────────────────────────────────────── */}
        <ReplyPreview
          replyingTo={replyingTo}
          onCancel={() => setReplyingTo(null)}
        />

        {/* ── Input ──────────────────────────────────────────────── */}
        <div
          className="px-3 pb-3 shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="pt-3" />
          <div
            className="flex items-end gap-2 rounded-xl px-3 py-2"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 resize-none outline-none leading-relaxed"
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ maxHeight: "120px" }}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height =
                  Math.min(e.target.scrollHeight, 120) + "px";
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all disabled:opacity-30"
              style={{
                background: input.trim()
                  ? "rgba(255,70,85,0.8)"
                  : "transparent",
                color: "#fff",
              }}
            >
              {sending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-[9px] text-gray-700 mt-1.5 px-1">
            Enter to send · Shift+Enter for new line · Tap a message for reply/delete
          </p>
        </div>
      </div>
    </>
  );
}
