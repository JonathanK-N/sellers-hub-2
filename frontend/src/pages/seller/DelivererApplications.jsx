import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Check, X, Truck, Phone, Calendar, MapPin, Mail, FileText, Camera, Loader2 } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import BottomNav from "../../components/BottomNav";

export default function SellerDelivererApplications() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/seller/deliverer-applications", { params: { status: "pending" } })
      .then(({ data }) => setPending(data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (id) => {
    setSelected(id);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/seller/deliverer-applications/${id}`);
      setDetail(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const approve = async (id) => {
    try {
      await api.post(`/seller/deliverer-applications/${id}/approve`);
      toast.success("Livreur approuvé — il peut désormais livrer vos commandes");
      setSelected(null);
      setDetail(null);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const reject = async (id) => {
    const reason = window.prompt("Motif du rejet (visible par le candidat) :", "");
    if (reason === null) return;
    try {
      await api.post(`/seller/deliverer-applications/${id}/reject`, { reason });
      toast.success("Candidature rejetée");
      setSelected(null);
      setDetail(null);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  return (
    <div className="mobile-shell pb-24">
      <header className="sticky top-0 z-40 bg-afri-secondary text-white px-4 py-3 flex items-center gap-3 shadow-md">
        {selected ? (
          <button onClick={() => { setSelected(null); setDetail(null); }} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center">
            <ArrowLeft size={20} />
          </button>
        ) : (
          <Link to="/seller/dashboard" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" data-testid="back-btn">
            <ArrowLeft size={20} />
          </Link>
        )}
        <h1 className="font-display font-black text-lg">Candidatures livreurs</h1>
      </header>

      <div className="px-4 mt-4">
        {!selected ? (
          loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)}
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              Aucune candidature en attente pour votre boutique.
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((a) => (
                <button
                  key={a.id}
                  onClick={() => openDetail(a.id)}
                  data-testid={`application-card-${a.id}`}
                  className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-xs p-4 hover:border-afri-primary transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg bg-afri-soft text-afri-primary flex items-center justify-center shrink-0">
                      <Truck size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{a.full_name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone size={11} /> {a.phone} {a.phone_verified && <Check size={11} className="text-afri-primary" />}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : detailLoading || !detail ? (
          <div className="flex items-center gap-2 text-gray-500 py-8 justify-center"><Loader2 size={18} className="animate-spin" /> Chargement…</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-afri-soft text-afri-primary flex items-center justify-center">
                <Truck size={22} />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-gray-900">{detail.full_name}</h2>
                <p className="text-xs text-gray-500">Soumis le {new Date(detail.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <InfoRow icon={Calendar} label="Date de naissance" value={detail.date_of_birth} />
              <InfoRow icon={Phone} label="Téléphone" value={detail.phone} verified={detail.phone_verified} />
              <InfoRow icon={MapPin} label="Adresse" value={detail.address} />
              <InfoRow icon={Mail} label="Email" value={detail.email || "—"} />
              <InfoRow icon={Truck} label="Véhicule" value={detail.vehicle} capitalize />
            </div>

            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Documents</h3>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <DocPreview icon={FileText} label="Pièce d'identité" url={detail.document_urls?.id_document} />
              <DocPreview icon={Camera} label="Selfie" url={detail.document_urls?.selfie} round />
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 mb-5 bg-gray-50 rounded-lg p-3">
              <Check size={14} className={detail.contract_accepted ? "text-afri-primary" : "text-gray-300"} />
              Contrat {detail.contract_accepted ? "accepté" : "non accepté"}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                data-testid={`approve-application-${detail.id}`}
                onClick={() => approve(detail.id)}
                className="bg-afri-primary hover:bg-afri-primary-hover text-white rounded-lg py-3 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Check size={16} /> Approuver
              </button>
              <button
                data-testid={`reject-application-${detail.id}`}
                onClick={() => reject(detail.id)}
                className="bg-white border border-[#E24B4A] text-[#E24B4A] hover:bg-red-50 rounded-lg py-3 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <X size={16} /> Rejeter
              </button>
            </div>
          </div>
        )}
      </div>

      <BottomNav role="seller" />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, verified, capitalize }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Icon size={13} /> {label}
      </div>
      <div className={`text-sm font-medium text-gray-900 flex items-center gap-1.5 ${capitalize ? "capitalize" : ""}`}>
        {value}
        {verified && <Check size={13} className="text-afri-primary" />}
      </div>
    </div>
  );
}

function DocPreview({ icon: Icon, label, url, round }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
        <Icon size={11} /> {label}
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={url}
            alt={label}
            className={`w-full object-cover border border-gray-200 ${round ? "rounded-full aspect-square" : "rounded-lg h-28"}`}
          />
        </a>
      ) : (
        <div className="w-full h-28 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">
          Manquant
        </div>
      )}
    </div>
  );
}
