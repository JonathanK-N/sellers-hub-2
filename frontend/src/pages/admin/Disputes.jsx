import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";
import { formatPrice, timeAgo } from "../../lib/format";

const PRIORITY_STYLES = {
  urgent: "bg-red-50 text-red-700 border-red-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  normal: "bg-gray-50 text-gray-700 border-gray-200",
};

export default function AdminDisputes() {
  const [items, setItems] = useState([]);
  const [resolving, setResolving] = useState(null);

  const load = () => api.get("/admin/disputes").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const resolve = async (id, decision) => {
    try {
      await api.post(`/admin/disputes/${id}/resolve`, { decision, note: "" });
      toast.success("Litige résolu");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10">
        <h1 className="font-display font-black text-xl lg:text-2xl text-[#085041]">Litiges</h1>
        <p className="text-xs text-gray-500 mt-0.5">Escrow gelé en attente de votre décision</p>
      </header>
      <main className="p-6 lg:p-10 max-w-7xl">
        {items.length === 0 ? (
          <div className="text-center py-20 text-sm text-gray-500">Aucun litige.</div>
        ) : (
          <div className="space-y-4">
            {items.map((d) => (
              <div key={d.id} className={`bg-white rounded-xl border-l-4 shadow-sm p-5 ${PRIORITY_STYLES[d.priority] || PRIORITY_STYLES.normal}`} data-testid={`dispute-card-${d.id}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-50 text-[#E24B4A] flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[d.priority]}`}>
                          {d.priority === "urgent" ? "URGENT" : d.priority === "high" ? "PRIORITAIRE" : "Normal"}
                        </span>
                        <span className={`ml-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${d.status === "open" ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {d.status === "open" ? "Ouvert" : "Résolu"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500"><Clock size={11} className="inline mr-1" />{timeAgo(d.created_at)}</span>
                    </div>
                    <h3 className="font-display font-bold text-lg text-gray-900 mt-2">{d.reason}</h3>
                    {d.order && (
                      <div className="mt-2 text-xs text-gray-600 flex flex-wrap gap-3">
                        <span>Commande <code className="font-mono">{d.order.id?.slice(0,8)}</code></span>
                        <span className="font-semibold text-[#085041]">{formatPrice(d.order.total_amount, d.order.currency)}</span>
                        <span>Mode : {d.order.delivery_mode === "delivery" ? "Livraison" : "Retrait"}</span>
                        <span>Pays : {d.country_code}</span>
                      </div>
                    )}
                    {d.admin_decision && (
                      <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Décision : {d.admin_decision}
                      </p>
                    )}
                    {d.status === "open" && (
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <button
                          data-testid={`refund-buyer-${d.id}`}
                          onClick={() => resolve(d.id, "refund_buyer")}
                          className="bg-white border-2 border-[#E24B4A] text-[#E24B4A] hover:bg-red-50 rounded-lg py-2 text-sm font-semibold"
                        >
                          Rembourser
                        </button>
                        <button
                          data-testid={`partial-refund-${d.id}`}
                          onClick={() => resolve(d.id, "partial_refund")}
                          className="bg-white border-2 border-amber-500 text-amber-600 hover:bg-amber-50 rounded-lg py-2 text-sm font-semibold"
                        >
                          Partiel
                        </button>
                        <button
                          data-testid={`release-seller-${d.id}`}
                          onClick={() => resolve(d.id, "release_seller")}
                          className="bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-2 text-sm font-semibold"
                        >
                          Libérer vendeur
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
