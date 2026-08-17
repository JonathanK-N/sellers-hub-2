import { createContext, useContext, useState, useCallback, useMemo } from "react";
import AuthModal from "../components/auth/AuthModal";

const AuthModalContext = createContext(null);

/**
 * Rend le modal d'authentification disponible partout dans l'application.
 * Les routes /auth/login et /auth/register restent fonctionnelles pour les
 * liens directs, les e-mails et les redirections.
 */
export function AuthModalProvider({ children }) {
  const [mode, setMode] = useState(null); // null | "login" | "register"

  const openAuth = useCallback((m = "login") => setMode(m), []);
  const closeAuth = useCallback(() => setMode(null), []);

  const value = useMemo(() => ({ openAuth, closeAuth, mode }), [openAuth, closeAuth, mode]);

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      {mode && <AuthModal mode={mode} onClose={closeAuth} onModeChange={setMode} />}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal doit être utilisé dans AuthModalProvider");
  return ctx;
}
