import API from '../api/api';

// ─── Unread badge counts ──────────────────────────────────────────────────────
export const getUnreadCounts = () => API.get('/chat/unread');

// ─── Team chat ────────────────────────────────────────────────────────────────
export const getTeamMessages = (teamId, after = 0) =>
  API.get(`/chat/team/${teamId}/messages`, { params: { after } });

export const sendTeamMessage = (teamId, content, replyToId = null) =>
  API.post(`/chat/team/${teamId}/messages`, { content, replyToId });

export const deleteTeamMessage = (teamId, messageId) =>
  API.delete(`/chat/team/${teamId}/messages/${messageId}`);

export const markTeamRead = (teamId, lastMessageId) =>
  API.put(`/chat/team/${teamId}/read`, { lastMessageId });

// ─── DM chat (draft-accept) ───────────────────────────────────────────────────
export const getDmMessages = (appId, after = 0) =>
  API.get(`/chat/dm/${appId}/messages`, { params: { after } });

export const sendDmMessage = (appId, content, replyToId = null) =>
  API.post(`/chat/dm/${appId}/messages`, { content, replyToId });

export const deleteDmMessage = (appId, messageId) =>
  API.delete(`/chat/dm/${appId}/messages/${messageId}`);

export const markDmRead = (appId, lastMessageId) =>
  API.put(`/chat/dm/${appId}/read`, { lastMessageId });

// ─── Swipe-match chat ──────────────────────────────────────────────────────────
export const getSwipeMessages = (matchId, after = 0) =>
  API.get(`/chat/swipe/${matchId}/messages`, { params: { after } });

export const sendSwipeMessage = (matchId, content, replyToId = null) =>
  API.post(`/chat/swipe/${matchId}/messages`, { content, replyToId });

export const deleteSwipeMessage = (matchId, messageId) =>
  API.delete(`/chat/swipe/${matchId}/messages/${messageId}`);

export const markSwipeRead = (matchId, lastMessageId) =>
  API.put(`/chat/swipe/${matchId}/read`, { lastMessageId });
