// Author: Jonathan Kakesa (JonathanK-N). Session verification without a private client waterfall.
import { API_BASE } from "./api_config";

function sessionData(result) {
  if (result.error) throw result.error;
  if (!result.ok) {
    const error = new Error("Session verification failed");
    error.response = { status: result.status, data: result.data };
    throw error;
  }
  return result.data;
}

export async function verifySession(token) {
  if (typeof window !== "undefined") {
    const initial = window.__afriInitialSession;
    delete window.__afriInitialSession;
    if (initial) clearTimeout(initial.cleanupTimer);
    if (initial?.token === token && initial.expires > Date.now()) {
      return sessionData(await initial.promise);
    }
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(API_BASE + "/auth/me", {
      method: "GET",
      headers: { Authorization: "Bearer " + token },
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    return sessionData({ok: response.ok, status: response.status, data});
  } finally {
    clearTimeout(timeout);
  }
}
