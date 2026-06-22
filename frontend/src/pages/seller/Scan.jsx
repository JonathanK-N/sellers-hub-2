import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowLeft, Camera, Keyboard, CheckCircle2, Package } from "lucide-react";
import api, { formatApiError } from "../../lib/api";

export default function SellerScan() {
  const nav = useNavigate();
  const [mode, setMode] = useState("camera");
  const [manualToken, setManualToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null); // { orderId, orderRef }
  const scannerRef = useRef(null);
  const startedRef = useRef(false);

  // Démarrer / arrêter la caméra
  useEffect(() => {
    if (mode !== "camera" || success) return;
    let html5;
    let mounted = true;

    (async () => {
      try {
        html5 = new Html5Qrcode("qr-region");
        scannerRef.current = html5;
        await html5.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decoded) => {
            if (!mounted || startedRef.current) return;
            startedRef.current = true;
            html5.stop().catch(() => {}).finally(() => {
              if (mounted) processQr(decoded);
            });
          },
          () => {} // erreur de frame — silencieux
        );
      } catch {
        toast.error("Caméra indisponible. Utilisez la saisie manuelle.");
        if (mounted) setMode("manual");
      }
    })();

    return () => {
      mounted = false;
      startedRef.current = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [mode, success]);

  /**
   * Extraire orderId + token depuis le QR scanné.
   * Formats supportés :
   *   1. URL complète : https://afrimarket.up.railway.app/qr-collect/<orderId>/<token>
   *   2. Token UUID brut (ancien format)
   */
  const parseQr = (raw) => {
    const s = raw.trim();
    try {
      const u = new URL(s);
      const parts = u.pathname.split("/").filter(Boolean);
      // /qr-collect/:orderId/:token
      if (parts[0] === "qr-collect" && parts.length >= 3) {
        return { orderId: parts[1], token: parts[2] };
      }
    } catch {
      // pas une URL valide
    }
    // Fallback : traiter comme token brut
    return { orderId: null, token: s };
  };

  const processQr = async (raw) => {
    setBusy(true);
    const { orderId, token } = parseQr(raw);

    try {
      // Récupérer la commande
      let order;
      if (orderId) {
        const { data } = await api.get(`/orders/${orderId}`);
        order = data;
      } else {
        const { data } = await api.get(`/orders/by-qr/${encodeURIComponent(token)}`);
        order = data;
      }

      // Valider le scan
      await api.post(`/orders/${order.id}/scan-qr`, { qr_token: token });

      // Succès — afficher l'écran de confirmation IN-PAGE (pas de navigation)
      setSuccess({
        orderId: order.id,
        orderRef: order.id.slice(0, 8).toUpperCase(),
        buyerName: order.buyer_name || "l'acheteur",
        total: order.amount_due ?? order.total_amount,
        currency: order.currency,
      });

    } catch (e) {
      const msg = e.response?.data?.detail || "Erreur lors de la validation";
      toast.error(typeof msg === "string" ? msg : "Erreur lors de la validation");
      // Permettre un nouveau scan
      startedRef.current = false;
      setBusy(false);
    } finally {
      if (!success) setBusy(false);
    }
  };

  // ── Écran de succès ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="mobile-shell flex flex-col items-center justify-center px-6 text-center gap-6 bg-white">
        <div className="w-24 h-24 rounded-full bg-[#E1F5EE] flex items-center justify-center">
          <CheckCircle2 size={48} className="text-[#1D9E75]" />
        </div>
        <div>
          <h2 className="font-display font-black text-2xl text-[#085041]">Retrait validé !</h2>
          <p className="text-gray-600 mt-1">
            Commande <span className="font-bold">#{success.orderRef}</span> confirmée pour {success.buyerName}.
          </p>
          {success.total && (
            <p className="text-xl font-display font-black text-[#085041] mt-3">
              {new Intl.NumberFormat("fr-FR").format(success.total)} {success.currency}
            </p>
          )}
          <p className="text-sm text-[#1D9E75] font-semibold mt-1">Le paiement a été libéré au vendeur.</p>
        </div>
        <div className="w-full space-y-3 mt-2">
          <button
            onClick={() => nav(`/seller/orders`)}
            className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold flex items-center justify-center gap-2"
          >
            <Package size={18} /> Voir mes commandes
          </button>
          <button
            onClick={() => {
              setSuccess(null);
              setMode("camera");
              startedRef.current = false;
            }}
            className="w-full border border-gray-200 text-gray-700 rounded-lg py-3 font-semibold"
          >
            Scanner un autre QR
          </button>
        </div>
      </div>
    );
  }

  // ── Écran principal scanner ────────────────────────────────────────────────
  return (
    <div className="mobile-shell bg-black text-white !pb-0 min-h-screen">
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur px-4 py-3 flex items-center gap-3">
        <Link to="/seller/orders" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-bold text-lg">Scanner QR retrait</h1>
        {busy && <span className="ml-auto text-xs text-[#1D9E75] font-semibold animate-pulse">Validation…</span>}
      </header>

      <div className="px-4 mt-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            data-testid="scan-mode-camera"
            onClick={() => { setMode("camera"); startedRef.current = false; }}
            className={`py-2.5 rounded-lg text-sm font-semibold ${mode === "camera" ? "bg-[#1D9E75]" : "bg-white/10"}`}
          >
            <Camera size={14} className="inline mr-1" /> Caméra
          </button>
          <button
            data-testid="scan-mode-manual"
            onClick={() => setMode("manual")}
            className={`py-2.5 rounded-lg text-sm font-semibold ${mode === "manual" ? "bg-[#1D9E75]" : "bg-white/10"}`}
          >
            <Keyboard size={14} className="inline mr-1" /> Manuel
          </button>
        </div>
      </div>

      <div className="px-4 mt-4">
        {mode === "camera" ? (
          <>
            <div
              id="qr-region"
              className="w-full aspect-square rounded-xl overflow-hidden bg-black"
              data-testid="qr-region"
            />
            <p className="text-xs text-gray-300 text-center mt-3">
              Pointez la caméra vers le QR code de l'acheteur.
            </p>
          </>
        ) : (
          <div className="bg-white text-gray-900 rounded-xl p-4 space-y-3">
            <label className="text-sm font-medium">Code QR ou URL du QR</label>
            <textarea
              data-testid="manual-token-input"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Collez le token ou l'URL complète ici…"
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75] resize-none"
            />
            <button
              data-testid="manual-scan-submit"
              disabled={busy || !manualToken.trim()}
              onClick={() => processQr(manualToken.trim())}
              className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold disabled:opacity-50"
            >
              {busy ? "Validation…" : "Valider"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
