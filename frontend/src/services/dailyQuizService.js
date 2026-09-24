import API from "../api/api";

// ─── Sidebar ────────────────────────────────────────────────────────────────
export const getMyDailiesGames = () => API.get("/dailies/games");

// ─── Per-game ───────────────────────────────────────────────────────────────
export const getGameLobby       = (gameId) => API.get(`/dailies/${gameId}/lobby`);
export const startDailyQuiz     = (gameId) => API.post(`/dailies/${gameId}/start`);
export const getGameLeaderboard = (gameId, tab = "daily") =>
  API.get(`/dailies/${gameId}/leaderboard`, { params: { tab } });

// ─── Session ────────────────────────────────────────────────────────────────
export const answerQuestion = (sessionId, selectedOption) =>
  API.post(`/dailies/session/${sessionId}/answer`, { selected_option: selectedOption });

export const forfeitOnBlur = (sessionId) =>
  API.post(`/dailies/session/${sessionId}/blur`);

export const getSessionShareData = (sessionId) =>
  API.get(`/dailies/session/${sessionId}/share`);
