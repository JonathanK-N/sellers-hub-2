import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

/**
 * Modal d'authentification superpose (facon casakonnect) :
 * fond assombri + carte centree, fermeture par croix, clic exterieur ou Echap.
 */
export default function AuthModal({ mode = "login", onClose, onModeChange }) {
  const [step, setStep] = useState(1);

  // Fermeture au clavier + blocage du defilement de l'arriere-plan
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const handleStep = useCallback((s) => setStep(s), []);

  const isLogin = mode === "login";
  const title = isLogin ? "Se connecter" : "Créer un compte";
  const subtitle = isLogin
    ? "Bienvenue sur AfriMarket"
    : `Rejoignez la communauté AfriMarket · Étape ${step} sur 2`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto afri-fade"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="auth-modal"
    >
      {/* Fond assombri */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        data-testid="auth-modal-backdrop"
      />

      {/* Carte */}
      <div className="relative w-full sm:max-w-md my-0 sm:my-8 bg-white sm:rounded-2xl shadow-2xl min-h-screen sm:min-h-0 afri-scale-in">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          data-testid="auth-modal-close"
          className="absolute right-3 top-3 w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
        >
          <X size={20} />
        </button>

        <header className="px-6 pt-8 pb-5 flex flex-col items-center text-center border-b border-gray-100">
          <div className="w-12 h-12 rounded-xl bg-afri-secondary text-afri-primary flex items-center justify-center font-black text-xl mb-3">
            A
          </div>
          <h2 className="font-display font-black text-xl text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </header>

        <div className="px-6 py-6">
          {isLogin ? (
            <LoginForm onSuccess={onClose} onSwitch={onModeChange} />
          ) : (
            <RegisterForm onSuccess={onClose} onSwitch={onModeChange} onStep={handleStep} />
          )}
        </div>
      </div>
    </div>
  );
}
