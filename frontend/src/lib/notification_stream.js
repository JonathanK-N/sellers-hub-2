import { API_BASE } from "./api_config";

let currentStatus = "connecting";
export const getNotificationStatus = () => currentStatus;

// A single authenticated connection per tab. No credentials or content in URLs.
export function startNotificationStream(token) {
  let stopped = false;
  let controller;
  let timer;
  let attempts = 0;
  const notify = () => window.dispatchEvent(new Event("afri-notifications-changed"));
  const status = value => { currentStatus = value; window.dispatchEvent(new CustomEvent("afri-notifications-status", { detail: value })); };
  const connect = async () => {
    if (stopped || document.hidden) return;
    status("connecting");
    controller?.abort();
    const active = new AbortController();
    controller = active;
    const timeout = setTimeout(() => active.abort(), 45000);
    let idle;
    const touch = () => { clearTimeout(idle); idle = setTimeout(() => active.abort(), 45000); };
    let reader;
    try {
      const response = await fetch(`${API_BASE}/notifications/stream`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        cache: "no-store", signal: active.signal,
      });
      clearTimeout(timeout);
      if (response.status === 401 || response.status === 403) {
        window.dispatchEvent(new Event("afri-session-expired"));
        stopped = true;
        return;
      }
      if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("Stream unavailable");
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      touch();
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        touch();
        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
        if (buffer.length > 65536) throw new Error("Stream frame too large");
        let end;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          if (/^event: changed$/m.test(frame)) { attempts = 0; status("connected"); notify(); }
          if (/^event: expired$/m.test(frame)) {
            stopped = true;
            window.dispatchEvent(new Event("afri-session-expired"));
          }
          if (/^event: unavailable$/m.test(frame)) throw new Error("Stream unavailable");
        }
      }
    } catch { if (!stopped) status(document.hidden ? "paused" : "reconnecting"); }
    finally {
      clearTimeout(timeout); clearTimeout(idle);
      if (reader) await reader.cancel().catch(() => {});
      if (!stopped && !document.hidden && controller === active) {
        status("reconnecting");
        timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)));
      }
    }
  };
  const visibility = () => {
    clearTimeout(timer);
    if (document.hidden) controller?.abort();
    else { notify(); connect(); }
  };
  document.addEventListener("visibilitychange", visibility);
  connect();
  return () => {
    stopped = true; clearTimeout(timer); controller?.abort();
    document.removeEventListener("visibilitychange", visibility);
  };
}
