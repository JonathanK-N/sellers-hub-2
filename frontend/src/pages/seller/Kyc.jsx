import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Upload, ShieldCheck, CheckCircle2, Clock, X } from "lucide-react";
import api, { formatApiError, API_BASE } from "../../lib/api";

const STATUS_LABEL = {
  level1: { label: "Niveau 1 - Téléphone vérifié", color: "bg-gray-100 text-gray-700" },
  pending_review: { label: "En attente de vérification", color: "bg-amber-50 text-amber-700" },
  level2: { label: "Niveau 2 - Pièce vérifiée", color: "bg-blue-50 text-blue-700" },
  level3: { label: "Niveau 3 - Vendeur Vérifié", color: "bg-[#E1F5EE] text-[#1D9E75]" },
  rejected: { label: "Rejeté", color: "bg-red-50 text-red-700" },
};

const STEPS = [
  { key: "id", title: "Niveau 2 — Pièce d'identité", desc: "CNI ou passeport (recto/verso)" },
  { key: "selfie", title: "Niveau 3 — Selfie avec pièce", desc: "Photo de vous tenant votre pièce d'identité" },
  { key: "address", title: "Niveau 3 — Justificatif domicile", desc: "Facture (électricité, eau) ou attestation" },
];

export default function SellerKyc() {
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState({});

  const load = async () => {
    const { data } = await api.get("/seller/kyc/status");
    setStatus(data);
  };
  useEffect(() => { load(); }, []);

  const upload = async (docType, file) => {
    setUploading((u) => ({ ...u, [docType]: true }));
    const fd = new FormData();
    fd.append("file", file);
    try {
      const token = localStorage.getItem("afri_token");
      const res = await fetch(`${API_BASE}/seller/kyc/upload?doc_type=${docType}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Document téléversé");
      await load();
    } catch {
      toast.error("Échec du téléversement");
    } finally {
      setUploading((u) => ({ ...u, [docType]: false }));
    }
  };

  const submit = async () => {
    try {
      await api.post("/seller/kyc/submit");
      toast.success("Demande envoyée. Vous serez notifié.");
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  if (!status) return <div className="mobile-shell pt-24 text-center text-gray-500">Chargement…</div>;

  const lbl = STATUS_LABEL[status.kyc_status] || STATUS_LABEL.level1;

  return (
    <div className="mobile-shell bg-white">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link to="/seller/dashboard" className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-black text-lg text-[#085041]">Vérification KYC</h1>
      </header>

      <div className="px-4 mt-4 space-y-4">
        <section className="rounded-xl border-2 border-[#1D9E75]/30 bg-[#E1F5EE] p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-[#1D9E75] text-white flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="text-xs uppercase font-bold text-[#085041]">Statut actuel</div>
            <span data-testid="kyc-current-status" className={`inline-block mt-1 text-xs font-bold px-2.5 py-1 rounded-full ${lbl.color}`}>
              {lbl.label}
            </span>
            {status.kyc_reject_reason && (
              <p className="text-xs text-[#E24B4A] mt-2">Motif rejet : {status.kyc_reject_reason}</p>
            )}
          </div>
        </section>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <LevelDot active={status.kyc_level >= 1} label="N1" />
          <div className={`flex-1 h-1 rounded-full ${status.kyc_level >= 2 ? "bg-[#1D9E75]" : "bg-gray-200"}`} />
          <LevelDot active={status.kyc_level >= 2} label="N2" />
          <div className={`flex-1 h-1 rounded-full ${status.kyc_level >= 3 ? "bg-[#1D9E75]" : "bg-gray-200"}`} />
          <LevelDot active={status.kyc_level >= 3} label="N3" />
        </div>

        <div className="space-y-3">
          {STEPS.map((s) => {
            const uploaded = status.docs?.[s.key];
            return (
              <div key={s.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4" data-testid={`kyc-step-${s.key}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${uploaded ? "bg-[#E1F5EE] text-[#1D9E75]" : "bg-gray-100 text-gray-400"}`}>
                    {uploaded ? <CheckCircle2 size={18} /> : <Upload size={18} />}
                  </div>
                  <div className="flex-1">
                    <div className="font-display font-bold text-gray-900 text-sm">{s.title}</div>
                    <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                    {uploaded ? (
                      <p className="text-[10px] text-[#1D9E75] mt-2 font-semibold">✓ Document reçu</p>
                    ) : (
                      <label className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg text-xs font-semibold cursor-pointer" data-testid={`upload-${s.key}-btn`}>
                        <Upload size={14} />
                        {uploading[s.key] ? "Envoi…" : "Téléverser"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading[s.key]}
                          onChange={(e) => e.target.files?.[0] && upload(s.key, e.target.files[0])}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {status.kyc_status !== "pending_review" && status.kyc_status !== "level3" && status.docs?.id && (
          <button
            data-testid="kyc-submit-btn"
            onClick={submit}
            className="w-full bg-[#085041] hover:bg-[#063b30] text-white rounded-lg py-3 font-semibold transition-colors"
          >
            Soumettre pour vérification
          </button>
        )}

        {status.kyc_status === "pending_review" && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3" data-testid="kyc-pending-banner">
            <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-semibold">Vérification en cours</p>
              <p className="mt-0.5 opacity-80">Notre équipe examine vos documents (généralement &lt; 24h).</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LevelDot({ active, label }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${active ? "bg-[#1D9E75] text-white" : "bg-gray-200 text-gray-400"}`}>
      {label}
    </div>
  );
}
