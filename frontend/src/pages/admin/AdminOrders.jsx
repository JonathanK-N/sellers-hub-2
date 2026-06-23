import { useEffect, useState } from "react";
import { Search, Download, Eye, RefreshCw } from "lucide-react";
import api from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";
import { formatPrice, timeAgo } from "../../lib/format";

const STATUS_COLORS = {
  confirmed:        "bg-blue-50 text-blue-700",
  preparing:        "bg-amber-50 text-amber-700",
  ready_for_pickup: "bg-purple-50 text-purple-700",
  out_for_delivery: "bg-indigo-50 text-indigo-700",
  delivered:        "bg-[#E1F5EE] text-[#1D9E75]",
  collected:        "bg-[#E1F5EE] text-[#1D9E75]",
  cancelled:        "bg-red-50 text-red-600",
};
const STATUS_LABELS = {
  confirmed: "Confirmée", preparing: "En préparation", ready_for_pickup: "Prêt retrait",
  out_for_delivery: "En livraison", delivered: "Livrée", collected: "Retirée", cancelled: "Annulée",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/admin/orders").then(({ data }) => setOrders(data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = !q || o.id.includes(q) || o.buyer_name?.toLowerCase().includes(q) || o.seller_name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchMode = modeFilter === "all" || o.delivery_mode === modeFilter;
    return matchSearch && matchStatus && matchMode;
  });

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10 flex items-center justify-between">
        <div className="pl-10 lg:pl-0">
          <h1 className="font-display font-black text-xl text-[#085041]">Commandes</h1>
          <p className="text-xs text-gray-500">{orders.length} commandes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg"><RefreshCw size={16} className="text-gray-500" /></button>
          <a href="/api/admin/export/orders" className="flex items-center gap-1.5 text-xs font-semibold text-[#085041] border border-[#085041] px-3 py-1.5 rounded-lg hover:bg-[#E1F5EE]">
            <Download size={14} /> CSV
          </a>
        </div>
      </header>

      <main className="p-4 lg:p-8 max-w-7xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ID, acheteur, vendeur…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none bg-white focus:ring-2 focus:ring-[#1D9E75]">
            <option value="all">Tous statuts</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none bg-white focus:ring-2 focus:ring-[#1D9E75]">
            <option value="all">Tous modes</option>
            <option value="delivery">Livraison</option>
            <option value="collect">Retrait</option>
          </select>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Acheteur</th>
                  <th className="px-4 py-3 text-left">Vendeur</th>
                  <th className="px-4 py-3 text-left">Mode</th>
                  <th className="px-4 py-3 text-left">Total</th>
                  <th className="px-4 py-3 text-left">Paiement</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Chargement…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Aucune commande</td></tr>
                ) : filtered.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`admin-order-${o.id}`}>
                    <td className="px-4 py-3"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{o.id.slice(0, 8)}</code></td>
                    <td className="px-4 py-3 text-gray-700">{o.buyer_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{o.seller_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{o.delivery_mode === "delivery" ? "🚚 Livraison" : "🏪 Retrait"}</td>
                    <td className="px-4 py-3 font-semibold text-[#085041]">{formatPrice(o.amount_due ?? o.total_amount, o.currency)}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold uppercase bg-[#E1F5EE] text-[#085041] px-2 py-0.5 rounded-full">
                        {o.payment_method === "cash" ? "Cash" : o.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{timeAgo(o.created_at)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(o)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-[#085041]">
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal détail commande */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-display font-black text-lg text-[#085041]">Commande #{selected.id.slice(0, 8)}</h2>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_COLORS[selected.status] || "bg-gray-100"}`}>
                  {STATUS_LABELS[selected.status] || selected.status}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Acheteur" value={selected.buyer_name || selected.buyer_id?.slice(0, 8)} />
                <Info label="Vendeur" value={selected.seller_name || selected.seller_id?.slice(0, 8)} />
                <Info label="Mode" value={selected.delivery_mode === "delivery" ? "Livraison" : "Retrait boutique"} />
                <Info label="Paiement" value={selected.payment_method === "cash" ? "Espèces" : selected.payment_method} />
                <Info label="Devise client" value={selected.checkout_currency || selected.currency} />
                <Info label="Total" value={formatPrice(selected.amount_due ?? selected.total_amount, selected.currency)} />
              </div>

              {selected.delivery_neighborhood && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="font-semibold text-gray-700 mb-1">Adresse</div>
                  <div>{selected.delivery_neighborhood}</div>
                  {selected.delivery_landmark && <div className="text-gray-500">{selected.delivery_landmark}</div>}
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="font-semibold text-gray-700 mb-2">Articles</div>
                <div className="space-y-1">
                  {(selected.items || []).map((it, i) => (
                    <div key={i} className="flex justify-between text-gray-700">
                      <span>{it.name} × {it.quantity}</span>
                      <span className="font-medium">{formatPrice(it.subtotal, selected.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="font-semibold text-gray-700 mb-2">Timeline</div>
                <div className="space-y-1">
                  {(selected.timeline || []).map((t, i) => (
                    <div key={i} className="flex gap-2 text-xs text-gray-600">
                      <span className="font-medium">{t.status}</span>
                      <span className="text-gray-400">{new Date(t.timestamp).toLocaleString("fr-FR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Info({ label, value }) {
  return <div><div className="text-xs text-gray-500">{label}</div><div className="font-semibold text-gray-900">{value || "—"}</div></div>;
}
