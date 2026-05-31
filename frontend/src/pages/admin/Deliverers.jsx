import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bike, CheckCircle2, XCircle } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";

export default function AdminDeliverers() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = () => api.get("/admin/deliverers").then(({ data }) => setRows(data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const toggle = async (userId, isActive) => {
    setBusy(userId);
    try {
      await api.patch(`/admin/deliverers/${userId}`, { is_active: isActive });
      toast.success(isActive ? "Livreur activé" : "Livreur désactivé");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10">
        <h1 className="font-display font-black text-xl lg:text-2xl text-[#085041]">Livreurs</h1>
        <p className="text-xs text-gray-500 mt-0.5">Gestion des partenaires de livraison</p>
      </header>
      <main className="p-6 lg:p-10 max-w-5xl">
        {rows.length === 0 ? (
          <div className="text-center py-20 text-sm text-gray-500 bg-white rounded-xl border border-gray-100">
            Aucun livreur inscrit.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((d) => (
              <div key={d.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4" data-testid={`deliverer-${d.id}`}>
                <div className="w-11 h-11 rounded-lg bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center shrink-0">
                  <Bike size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{d.name}</span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${d.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {d.is_active ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {d.phone} · {d.country_code} · {d.vehicle || "moto"}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {d.completed_all} livraison{d.completed_all > 1 ? "s" : ""} · {d.active_deliveries} en cours
                  </div>
                </div>
                <button
                  onClick={() => toggle(d.id, !d.is_active)}
                  disabled={busy === d.id}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
                    d.is_active
                      ? "border-red-200 text-red-700 hover:bg-red-50"
                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  {d.is_active ? <><XCircle size={14} /> Désactiver</> : <><CheckCircle2 size={14} /> Activer</>}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
