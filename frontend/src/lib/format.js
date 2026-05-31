import { API_BASE } from "./api";

export function formatPrice(value, currency = "FC") {
  const n = Number(value || 0);
  const formatted = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(n);
  return `${formatted} ${currency}`;
}

export function formatDistance(km) {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function photoUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/api/")) return `${API_BASE.replace(/\/api$/, "")}${path}`;
  return path;
}

export function timeAgo(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return date.toLocaleDateString("fr-FR");
}
