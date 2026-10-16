// Author: Jonathan Kakesa (JonathanK-N). Anonymous public reads, never private credentials.
import { API_BASE } from "./api_config";

async function get(route, { params = {} } = {}) {
  const url = new URL(API_BASE + route, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null)
      url.searchParams.set(key, String(value));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      credentials: "omit",
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(new Error("Public request failed"), {
        response: { status: response.status, data },
      });
    return { data, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

export default { get };
