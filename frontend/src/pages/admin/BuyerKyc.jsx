import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, ShieldCheck, Phone } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";

export default function AdminBuyerKyc() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/admin/buyer-kyc/pending").then(({ data }) => setPending(data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try {
      await api.post(`/admin/buyer-kyc/${id}/approve`);
      toast.success("Acheteur vérifié");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };
  const reject = async (id) => {
    const reason = window.prompt("Motif du rejet (visible par l'acheteur) :", "");
    if (reason === null) return;
    try {
      await api.post(`/admin/buyer-kyc/${id}/reject`, { reason });
      toast.success("Vérification rejetée");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10">
        <h1 className="font-display font-black text-xl lg:text-2xl text-[#085041]">Vérification identité acheteurs</h1>
        <p className="text-xs text-gray-500 mt-0.5">Validez les profils pour attribuer le badge Vérifié</p>
      </header>
      <main className="p-6 lg:p-10 max-w-7xl">
        {loading ? (
          <div className="text-gray-500">Chargement…</div>
        ) : pending.length === 0 ? (
          <div className="text-gray-500 text-sm">Aucune demande en attente.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map((u) => (
              <div key={u.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5" data-testid={`buyer-kyc-card-${u.id}`}>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="font-display font-bold text-gray-900">{u.name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Phone size={11} /> {u.phone}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {u.country_code} · soumis le {u.buyer_kyc_submitted_at ? new Date(u.buyer_kyc_submitted_at).toLocaleDateString("fr-FR") : "—"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    data-testid={`approve-buyer-kyc-${u.id}`}
                    onClick={() => approve(u.id)}
                    className="bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <Check size={16} /> Approuver
                  </button>
                  <button
                    data-testid={`reject-buyer-kyc-${u.id}`}
                    onClick={() => reject(u.id)}
                    className="bg-white border border-[#E24B4A] text-[#E24B4A] hover:bg-red-50 rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <X size={16} /> Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
