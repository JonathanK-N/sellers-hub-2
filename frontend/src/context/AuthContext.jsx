import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("afri_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("afri_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      localStorage.setItem("afri_user", JSON.stringify(data));
    } catch {
      setUser(null);
      localStorage.removeItem("afri_user");
      localStorage.removeItem("afri_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    import("../lib/push").then(({ enablePushNotifications }) => {
      enablePushNotifications().catch(() => {});
    }).catch(() => {});
  }, [user]);

  const setSession = (token, userObj) => {
    localStorage.setItem("afri_token", token);
    localStorage.setItem("afri_user", JSON.stringify(userObj));
    setUser(userObj);
  };

  const logout = () => {
    import("../lib/push").then(({ disablePushNotifications }) => {
      disablePushNotifications().catch(() => {});
    }).catch(() => {});
    localStorage.removeItem("afri_token");
    localStorage.removeItem("afri_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, setSession, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
