import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowLeft, Camera, Keyboard, CheckCircle2, Package } from "lucide-react";
import api from "../../lib/api";

export default function SellerScan() {
  const nav = useNavigate();
  const [mode, setMode] = useState("camera");
  const [manualToken, setManualToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null);
  const scannerRef = useRef(null);
  const startedRef = useRef(false);
  // Ref pour éviter la closure stale dans processQr
  const successRef = useRef(null);

  // Synchroniser successRef avec success
  useEffect(() => {
    successRef.current = success;
  }, [success]);

  // Démarrer / arrêter la caméra
  useEffect(() => {
    if (mode !== "camera" || success) return;
    let mounted = true;

    (async () => {
      try {
        const html5 = new Html5Qrcode("qr-region");
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
          () => {}
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
  }, [mode, success]); // eslint-disable-line react-hooks/exhaustive-deps

  const parseQr = (raw) => {
    const s = raw.trim();
    try {
      const u = new URL(s);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "qr-collect" && parts.length >= 3) {
        return { orderId: parts[1], token: parts[2] };
      }
    } catch { /* pas une URL */ }
    return { orderId: null, token: s };
  };

  // useCallback pour stabiliser la référence — évite closure stale
  const processQr = useCallback(async (raw) => {
    setBusy(true);
    const { orderId, token } = parseQr(raw);

    try {
      let order;
      if (orderId) {
        const { data } = await api.get(`/orders/${orderId}`);
        order = data;
      } else {
        const { data } = await api.get(`/orders/by-qr/${encodeURIComponent(token)}`);
        order = data;
      }

      await api.post(`/orders/${order.id}/scan-qr`, { qr_token: token });

      // D'abord setBusy(false) PUIS setSuccess — ordre critique pour éviter
      // le render intermédiaire page blanche
      setBusy(false);
      setSuccess({
        orderId: order.id,
        orderRef: order.id.slice(0, 8).toUpperCase(),
        buyerName: order.buyer_name || "l'acheteur",
        total: order.amount_due ?? order.total_amount,
        currency: order.currency,
      });

    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Erreur lors de la validation";
      toast.error(msg);
      startedRef.current = false;
      setBusy(false);
    }
    // PAS de finally — le setBusy(false) est géré explicitement dans chaque branche
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Écran de succès ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="mobile-shell flex flex-col items-center justify-center px-6 text-center gap-6 bg-white min-h-screen">
        <div className="w-24 h-24 rounded-full bg-afri-soft flex items-center justify-center">
          <CheckCircle2 size={48} className="text-green-600" />
        </div>
        <div>
          <h2 className="font-display font-black text-2xl text-afri-secondary">Retrait validé !</h2>
          <p className="text-gray-600 mt-2">
            Commande <span className="font-bold">#{success.orderRef}</span>
            <br />confirmée pour <span className="font-semibold">{success.buyerName}</span>.
          </p>
          {success.total > 0 && (
            <p className="text-2xl font-display font-black text-afri-secondary mt-4">
              {new Intl.NumberFormat("fr-FR").format(success.total)}{" "}
              <span className="text-lg">{success.currency}</span>
            </p>
          )}
          <p className="text-sm text-afri-primary font-semibold mt-2">
            Paiement libéré au vendeur ✓
          </p>
        </div>
        <div className="w-full space-y-3 mt-4">
          <button
            onClick={() => nav("/seller/orders")}
            className="w-full bg-afri-primary hover:bg-afri-primary-hover text-white rounded-lg py-3 font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Package size={18} /> Voir mes commandes
          </button>
          <button
            onClick={() => {
              setSuccess(null);
              successRef.current = null;
              startedRef.current = false;
              setMode("camera");
            }}
            className="w-full border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg py-3 font-semibold transition-colors"
          >
            Scanner un autre QR
          </button>
        </div>
      </div>
    );
  }

  // ── Écran scanner ──────────────────────────────────────────────────────────
  return (
    <div className="mobile-shell bg-black text-white !pb-0 min-h-screen">
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur px-4 py-3 flex items-center gap-3">
        <Link
          to="/seller/orders"
          className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center"
          data-testid="back-btn"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-bold text-lg">Scanner QR retrait</h1>
        {busy && (
          <span className="ml-auto text-xs text-afri-primary font-semibold animate-pulse">
            Validation…
          </span>
        )}
      </header>

      <div className="px-4 mt-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            data-testid="scan-mode-camera"
            onClick={() => { startedRef.current = false; setMode("camera"); }}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              mode === "camera" ? "bg-afri-primary" : "bg-white/10"
            }`}
          >
            <Camera size={14} className="inline mr-1" /> Caméra
          </button>
          <button
            data-testid="scan-mode-manual"
            onClick={() => setMode("manual")}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              mode === "manual" ? "bg-afri-primary" : "bg-white/10"
            }`}
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
            <p className="text-xs text-gray-400 text-center mt-3">
              Pointez la caméra vers le QR code de l'acheteur.
            </p>
          </>
        ) : (
          <div className="bg-white text-gray-900 rounded-xl p-4 space-y-3">
            <label className="text-sm font-semibold text-gray-700">
              Code QR ou URL du QR
            </label>
            <textarea
              data-testid="manual-token-input"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Collez le token ou l'URL complète ici…"
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-afri-primary resize-none"
            />
            <button
              data-testid="manual-scan-submit"
              disabled={busy || !manualToken.trim()}
              onClick={() => processQr(manualToken.trim())}
              className="w-full bg-afri-primary hover:bg-afri-primary-hover text-white rounded-lg py-3 font-semibold disabled:opacity-50 transition-colors"
            >
              {busy ? "Validation…" : "Valider"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
