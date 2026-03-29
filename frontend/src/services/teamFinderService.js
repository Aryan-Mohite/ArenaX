import API from "../api/api";

export const getPosts = () => API.get("/teamfinder");
export const createPost = (data) => API.post("/teamfinder", data);