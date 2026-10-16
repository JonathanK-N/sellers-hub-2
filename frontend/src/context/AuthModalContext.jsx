import { createContext, useContext, useState, useCallback, useMemo, lazy, Suspense } from "react";
const AuthModal = lazy(() => import("../components/auth/AuthModal"));

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
      {mode && <Suspense fallback={<div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 text-afri-secondary">Chargement…</div>}><AuthModal mode={mode} onClose={closeAuth} onModeChange={setMode} /></Suspense>}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal doit être utilisé dans AuthModalProvider");
  return ctx;
}
