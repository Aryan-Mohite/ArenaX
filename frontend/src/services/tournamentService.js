import API from "../api/api";

export const getTournaments = () => API.get("/tournaments");
export const createTournament = (data) => API.post("/tournaments", data);