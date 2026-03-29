import API from "../api/api";

export const getUsers = () => API.get("/users");