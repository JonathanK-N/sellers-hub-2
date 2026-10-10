import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Truck, Phone, Calendar, MapPin, Mail, FileText, Camera, Loader2, ArrowLeft, Store, Globe } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";

export default function AdminDelivererApplications() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/admin/deliverer-applications", { params: { status: "pending" } })
      .then(({ data }) => setPending(data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (id) => {
    setSelected(id);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/admin/deliverer-applications/${id}`);
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
      await api.post(`/admin/deliverer-applications/${id}/approve`);
      toast.success("Candidat approuvé — compte livreur activé");
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
      await api.post(`/admin/deliverer-applications/${id}/reject`, { reason });
      toast.success("Candidature rejetée");
      setSelected(null);
      setDetail(null);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10 flex items-center gap-3">
        {selected && (
          <button onClick={() => { setSelected(null); setDetail(null); }} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h1 className="font-display font-black text-xl lg:text-2xl text-afri-secondary">Candidatures livreurs — Réseau AfriMarket</h1>
          <p className="text-xs text-gray-500 mt-0.5">Validez les candidats pour le réseau de livreurs indépendants</p>
        </div>
      </header>

      <main className="p-6 lg:p-10 max-w-7xl">
        {!selected ? (
          loading ? (
            <div className="text-gray-500">Chargement…</div>
          ) : pending.length === 0 ? (
            <div className="text-gray-500 text-sm">Aucune candidature en attente.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pending.map((a) => (
                <button
                  key={a.id}
                  onClick={() => openDetail(a.id)}
                  data-testid={`application-card-${a.id}`}
                  className="text-left bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-afri-primary transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg var(--afri-success-bg) text-afri-primary flex items-center justify-center shrink-0">
                      <Truck size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-gray-900 truncate">{a.full_name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone size={11} /> {a.phone} {a.phone_verified && <Check size={11} className="text-afri-primary" />}
                      </div>
                      <div className="text-xs text-gray-600 mt-1 capitalize">{a.vehicle}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] font-semibold text-afri-primary uppercase tracking-wide">
                    Voir le dossier →
                  </div>
                </button>
              ))}
            </div>
          )
        ) : detailLoading || !detail ? (
          <div className="flex items-center gap-2 text-gray-500"><Loader2 size={18} className="animate-spin" /> Chargement du dossier…</div>
        ) : (
          <div className="max-w-3xl">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-14 h-14 rounded-xl var(--afri-success-bg) text-afri-primary flex items-center justify-center">
                  <Truck size={24} />
                </div>
                <div>
                  <h2 className="font-display font-bold text-xl text-gray-900">{detail.full_name}</h2>
                  <p className="text-xs text-gray-500">Candidature soumise le {new Date(detail.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <InfoRow icon={Calendar} label="Date de naissance" value={detail.date_of_birth} />
                <InfoRow icon={Phone} label="Téléphone" value={detail.phone} verified={detail.phone_verified} />
                <InfoRow icon={MapPin} label="Adresse" value={detail.address} span2 />
                <InfoRow icon={Mail} label="Email" value={detail.email || "—"} />
                <InfoRow icon={Truck} label="Véhicule" value={detail.vehicle} capitalize />
              </div>

              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Documents</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <DocPreview
                  icon={FileText}
                  label="Pièce d'identité"
                  url={detail.document_urls?.id_document}
                />
                <DocPreview
                  icon={Camera}
                  label="Selfie"
                  url={detail.document_urls?.selfie}
                  round
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 mb-6 bg-gray-50 rounded-lg p-3">
                <Check size={14} className={detail.contract_accepted ? "text-afri-primary" : "text-gray-300"} />
                Contrat {detail.contract_accepted ? "accepté" : "non accepté"} par le candidat
              </div>

              <div className="grid grid-cols-2 gap-3">
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
          </div>
        )}
      </main>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, verified, capitalize, span2 }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
        <Icon size={11} /> {label}
      </div>
      <div className={`text-sm text-gray-900 mt-0.5 flex items-center gap-1.5 ${capitalize ? "capitalize" : ""}`}>
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
            className={`w-full h-40 object-cover border border-gray-200 hover:opacity-90 transition-opacity ${round ? "rounded-full aspect-square w-40 h-40 mx-auto" : "rounded-lg"}`}
          />
        </a>
      ) : (
        <div className="w-full h-40 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">
          Document manquant
        </div>
      )}
    </div>
  );
}
