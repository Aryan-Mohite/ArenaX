import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { getUnreadCounts } from "../services/chatService";

const ChatContext = createContext({ unread: { teams: {}, dms: {}, swipes: {} }, refresh: () => {} });

const BADGE_POLL_MS = 30_000; // 30 s — very light

export function ChatProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [unread, setUnread] = useState({ teams: {}, dms: {}, swipes: {} });
  const intervalRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const res = await getUnreadCounts();
      setUnread({ teams: res.data.teams || {}, dms: res.data.dms || {}, swipes: res.data.swipes || {} });
    } catch {/* silently ignore network errors for badge poll */}
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { setUnread({ teams: {}, dms: {}, swipes: {} }); return; }

    refresh(); // immediate on login
    intervalRef.current = setInterval(refresh, BADGE_POLL_MS);
    return () => clearInterval(intervalRef.current);
  }, [isAuthenticated, refresh]);

  return (
    <ChatContext.Provider value={{ unread, refresh }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChatContext = () => useContext(ChatContext);
