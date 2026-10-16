// Author: Jonathan Kakesa (JonathanK-N). Session verification without a private client waterfall.
import { API_BASE } from "./api_config";

export async function verifySession(token) {
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
    if (!response.ok) {
      const error = new Error("Session verification failed");
      error.response = { status: response.status, data };
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
