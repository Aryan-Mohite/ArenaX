

import axios from "axios";

const API = "http://localhost:5000/api/users";

export const getProfile = (id) => {
  return axios.get(`${API}/profile/${id}`);
};

export const updateProfile = (id, data) => {
  return axios.put(`${API}/profile/${id}`, data);
};