import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowLeft, Camera, Keyboard } from "lucide-react";
import api, { formatApiError } from "../../lib/api";

export default function SellerScan() {
  const nav = useNavigate();
  const [mode, setMode] = useState("camera");
  const [manualToken, setManualToken] = useState("");
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (mode !== "camera") return;
    let html5;
    (async () => {
      try {
        html5 = new Html5Qrcode("qr-region");
        scannerRef.current = html5;
        await html5.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          (decoded) => {
            if (startedRef.current) return;
            startedRef.current = true;
            html5.stop().then(() => process(decoded));
          },
          () => {}
        );
      } catch (e) {
        toast.error("Caméra indisponible. Utilisez la saisie manuelle.");
        setMode("manual");
      }
    })();
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
      startedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const process = async (token) => {
    setBusy(true);
    try {
      const { data: order } = await api.get(`/orders/by-qr/${encodeURIComponent(token)}`);
      await api.post(`/orders/${order.id}/scan-qr`, { qr_token: token });
      toast.success("Retrait validé. Paiement libéré !");
      nav(`/buyer/orders/${order.id}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
      startedRef.current = false;
      // restart camera
      if (mode === "camera") setMode((m) => m); // noop, dependency unchanged
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mobile-shell bg-black text-white !pb-0 min-h-screen">
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur px-4 py-3 flex items-center gap-3">
        <Link to="/seller/orders" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-bold text-lg">Scanner QR retrait</h1>
      </header>

      <div className="px-4 mt-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            data-testid="scan-mode-camera"
            onClick={() => setMode("camera")}
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
            <div id="qr-region" className="w-full aspect-square rounded-xl overflow-hidden bg-black" data-testid="qr-region" />
            <p className="text-xs text-gray-300 text-center mt-3">Pointez la caméra vers le QR code de l'acheteur.</p>
          </>
        ) : (
          <div className="bg-white text-gray-900 rounded-xl p-4 space-y-3">
            <label className="text-sm font-medium">Code QR (UUID)</label>
            <input
              data-testid="manual-token-input"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Collez le token ici…"
              className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]"
            />
            <button
              data-testid="manual-scan-submit"
              disabled={busy || !manualToken.trim()}
              onClick={() => process(manualToken.trim())}
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
