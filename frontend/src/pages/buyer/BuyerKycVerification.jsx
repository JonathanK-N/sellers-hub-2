import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Upload, ShieldCheck, CheckCircle2, Clock } from "lucide-react";
import api, { formatApiError, API_BASE } from "../../lib/api";

const STATUS_LABEL = {
  none: { label: "Non vérifié", color: "bg-gray-100 text-gray-700" },
  pending_review: { label: "En attente de vérification", color: "bg-amber-50 text-amber-700" },
  verified: { label: "Profil vérifié", color: "bg-afri-soft text-afri-primary" },
  rejected: { label: "Rejeté", color: "bg-red-50 text-red-700" },
};

const STEPS = [
  { key: "id", title: "Pièce d'identité", desc: "CNI ou passeport (recto)" },
  { key: "selfie", title: "Selfie de vérification", desc: "Photo de votre visage, bien éclairée" },
];

export default function BuyerKycVerification() {
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState({});

  const load = async () => {
    const { data } = await api.get("/buyer/kyc/status");
    setStatus(data);
  };
  useEffect(() => { load(); }, []);

  const upload = async (docType, file) => {
    setUploading((u) => ({ ...u, [docType]: true }));
    const fd = new FormData();
    fd.append("file", file);
    try {
      const token = localStorage.getItem("afri_token");
      const res = await fetch(`${API_BASE}/buyer/kyc/upload?doc_type=${docType}`, {
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
      await api.post("/buyer/kyc/submit");
      toast.success("Demande envoyée. Vous serez notifié.");
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  if (!status) return <div className="mobile-shell pt-24 text-center text-gray-500">Chargement…</div>;

  const lbl = STATUS_LABEL[status.buyer_kyc_status] || STATUS_LABEL.none;
  const allDocsUploaded = STEPS.every((s) => status.docs?.[s.key]);

  return (
    <div className="mobile-shell bg-white">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link to="/buyer/profile" className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-black text-lg text-afri-secondary">Vérification d'identité</h1>
      </header>

      <div className="px-4 mt-4 space-y-4">
        <section className="rounded-xl border-2 border-afri-primary/30 bg-afri-soft p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-afri-primary text-white flex items-center justify-center shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="text-xs uppercase font-bold text-afri-secondary">Statut actuel</div>
            <span data-testid="buyer-kyc-current-status" className={`inline-block mt-1 text-xs font-bold px-2.5 py-1 rounded-full ${lbl.color}`}>
              {lbl.label}
            </span>
            {status.buyer_kyc_reject_reason && (
              <p className="text-xs text-[#E24B4A] mt-2">Motif rejet : {status.buyer_kyc_reject_reason}</p>
            )}
          </div>
        </section>

        <p className="text-xs text-gray-500 leading-relaxed">
          Faites vérifier votre identité pour obtenir le badge <span className="font-semibold text-afri-secondary">Vérifié</span>, visible par les vendeurs et qui renforce la confiance lors de vos commandes.
        </p>

        <div className="space-y-3">
          {STEPS.map((s) => {
            const uploaded = status.docs?.[s.key];
            return (
              <div key={s.key} className="bg-white rounded-xl border border-gray-100 shadow-xs p-4" data-testid={`buyer-kyc-step-${s.key}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${uploaded ? "bg-afri-soft text-afri-primary" : "bg-gray-100 text-gray-400"}`}>
                    {uploaded ? <CheckCircle2 size={18} /> : <Upload size={18} />}
                  </div>
                  <div className="flex-1">
                    <div className="font-display font-bold text-gray-900 text-sm">{s.title}</div>
                    <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                    {uploaded ? (
                      <p className="text-[10px] text-afri-primary mt-2 font-semibold">✓ Document reçu</p>
                    ) : (
                      <label className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-afri-primary hover:bg-afri-primary-hover text-white rounded-lg text-xs font-semibold cursor-pointer" data-testid={`buyer-upload-${s.key}-btn`}>
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

        {status.buyer_kyc_status !== "pending_review" && status.buyer_kyc_status !== "verified" && allDocsUploaded && (
          <button
            data-testid="buyer-kyc-submit-btn"
            onClick={submit}
            className="w-full bg-afri-secondary hover:bg-[#063b30] text-white rounded-lg py-3 font-semibold transition-colors"
          >
            Soumettre pour vérification
          </button>
        )}

        {status.buyer_kyc_status === "pending_review" && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3" data-testid="buyer-kyc-pending-banner">
            <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-semibold">Vérification en cours</p>
              <p className="mt-0.5 opacity-80">Notre équipe examine vos documents (généralement &lt; 24h).</p>
            </div>
          </div>
        )}

        {status.buyer_kyc_status === "verified" && (
          <div className="rounded-xl bg-afri-soft border border-afri-primary/30 p-4 flex items-start gap-3" data-testid="buyer-kyc-verified-banner">
            <ShieldCheck size={18} className="text-green-600 shrink-0 mt-0.5" />
            <div className="text-xs text-afri-secondary">
              <p className="font-semibold">Profil vérifié</p>
              <p className="mt-0.5 opacity-80">Votre badge Vérifié est visible par les vendeurs.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
