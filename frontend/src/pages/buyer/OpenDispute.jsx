import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, AlertCircle, Upload } from "lucide-react";
import api, { formatApiError, API_BASE } from "../../lib/api";

const REASONS = [
  "Produit non reçu",
  "Produit endommagé",
  "Produit non conforme à la description",
  "Mauvaise quantité",
  "Autre",
];

export default function OpenDispute() {
  const { orderId } = useParams();
  const nav = useNavigate();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const token = localStorage.getItem("afri_token");
      // Reuse seller upload but it requires seller; use kyc upload as substitute? Need a buyer-friendly upload endpoint.
      // For now, store as a file via a generic endpoint — fallback to seller endpoint won't work.
      // Use FormData with the orders/photo endpoint via seller route is wrong.
      // Simplest MVP: send the file to a new public endpoint? Skip photo if not available.
      toast.info("Téléversement photo non disponible dans cette version, votre description sera utilisée.");
    } catch {} finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/disputes", {
        order_id: orderId,
        reason: `${reason}${details ? " — " + details : ""}`,
        photo_url: photoUrl,
      });
      toast.success("Litige ouvert. L'escrow est gelé en attendant la résolution.");
      nav(`/buyer/orders/${orderId}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mobile-shell bg-white">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link to={`/buyer/orders/${orderId}`} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-black text-lg text-[#085041]">Ouvrir un litige</h1>
      </header>

      <div className="px-4 mt-4 space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-[#E24B4A] mt-0.5" />
          <p className="text-xs text-red-900">
            Une fois ouvert, l'escrow restera bloqué jusqu'à la décision admin. Soyez précis.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Motif</label>
          <div className="mt-2 space-y-2">
            {REASONS.map((r) => (
              <button
                key={r}
                data-testid={`dispute-reason-${r.replace(/\s+/g, '-')}`}
                onClick={() => setReason(r)}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all ${reason === r ? "border-[#E24B4A] bg-red-50 text-[#E24B4A]" : "border-gray-200 bg-white text-gray-700"}`}
              >
                <span className="text-sm font-semibold">{r}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Détails (optionnel)</label>
          <textarea
            data-testid="dispute-details-input"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Décrivez le problème en détail…"
            rows={4}
            className="w-full mt-1.5 border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75] resize-none"
          />
        </div>

        <button
          data-testid="submit-dispute-btn"
          disabled={busy}
          onClick={submit}
          className="w-full bg-[#E24B4A] hover:bg-red-700 text-white rounded-lg py-3 font-semibold disabled:opacity-50"
        >
          {busy ? "Envoi…" : "Ouvrir le litige"}
        </button>
      </div>
    </div>
  );
}
