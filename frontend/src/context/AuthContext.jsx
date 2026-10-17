import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";

import { verifySession } from "../lib/session_api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const revision = useRef(0);
  const [user, setUser] = useState(() => {
    try {
      if (!localStorage.getItem("afri_token")) return null;
      const raw = localStorage.getItem("afri_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      return Boolean(localStorage.getItem("afri_token"));
    } catch {
      return false;
    }
  });

  const [sessionUnavailable, setSessionUnavailable] = useState(false);

  const refresh = useCallback(async () => {
    const current = ++revision.current;
    setLoading(true);
    setSessionUnavailable(false);
    const token = localStorage.getItem("afri_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await verifySession(token);
      if (current !== revision.current) return;
      setUser(data);
      localStorage.setItem("afri_user", JSON.stringify(data));
    } catch (error) {
      if (current !== revision.current) return;
      setUser(null);
      localStorage.removeItem("afri_user");
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("afri_token");
      } else {
        setSessionUnavailable(true);
      }
    } finally {
      if (current === revision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const expired = () => {
      revision.current++;
      localStorage.removeItem("afri_token");
      localStorage.removeItem("afri_user");
      setSessionUnavailable(false);
      setUser(null);
      setLoading(false);
    };
    window.addEventListener("afri-session-expired", expired);
    return () => window.removeEventListener("afri-session-expired", expired);
  }, []);

  useEffect(() => {
    const changed = event => { if (event.key === "afri_token" || event.key === null) refresh(); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    import("../lib/push")
      .then(({ enablePushNotifications }) => {
        enablePushNotifications().catch(() => {});
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user || loading || sessionUnavailable) return;
    let disposed = false;
    let stop;
    const token = localStorage.getItem("afri_token");
    import("../lib/notification_stream").then(({ startNotificationStream }) => {
      if (!disposed && token) stop = startNotificationStream(token);
    });
    return () => { disposed = true; stop?.(); };
  }, [user, loading, sessionUnavailable]);

  const setSession = (token, userObj) => {
    revision.current++;
    setLoading(false);
    setSessionUnavailable(false);
    localStorage.setItem("afri_token", token);
    localStorage.setItem("afri_user", JSON.stringify(userObj));
    setUser(userObj);
  };

  const logout = () => {
    revision.current++;
    setLoading(false);
    setSessionUnavailable(false);
    import("../lib/push")
      .then(({ disablePushNotifications }) => {
        disablePushNotifications().catch(() => {});
      })
      .catch(() => {});
    localStorage.removeItem("afri_token");
    localStorage.removeItem("afri_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, sessionUnavailable, setSession, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
