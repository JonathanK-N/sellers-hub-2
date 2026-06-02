import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      // Don't nag: respect a previous dismissal for 7 days.
      const dismissedAt = Number(localStorage.getItem("pwa_dismissed") || 0);
      if (Date.now() - dismissedAt > 7 * 24 * 3600 * 1000) {
        setVisible(true);
      }
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch {}
    setDeferred(null);
    setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem("pwa_dismissed", String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-[60] bg-white rounded-xl shadow-lg border border-gray-200 p-3 flex items-center gap-3" data-testid="pwa-install-banner">
      <div className="w-10 h-10 rounded-lg bg-[#085041] text-white flex items-center justify-center shrink-0 font-display font-black">A</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">Installer AfriMarket</div>
        <div className="text-xs text-gray-500">Accès rapide depuis votre écran d'accueil.</div>
      </div>
      <button onClick={install} data-testid="pwa-install-btn" className="bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-1.5 shrink-0">
        <Download size={15} /> Installer
      </button>
      <button onClick={dismiss} aria-label="Fermer" className="text-gray-400 hover:text-gray-600 shrink-0">
        <X size={18} />
      </button>
    </div>
  );
}
