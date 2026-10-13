import axios from "axios";

import { API_BASE } from "./api_config";
export { API_BASE } from "./api_config";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("afri_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      // Token expired
      localStorage.removeItem("afri_token");
      localStorage.removeItem("afri_user");
      window.dispatchEvent(new Event("afri-session-expired"));
    }
    return Promise.reject(err);
  },
);

export function formatApiError(detail) {
  if (detail == null) return "Une erreur est survenue. Réessayez.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;
