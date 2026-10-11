import { useEffect, useState } from "react";
import { Search, Eye, ToggleLeft, ToggleRight, RefreshCw } from "lucide-react";
import api from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";
import { formatPrice, photoUrl, timeAgo } from "../../lib/format";
import { toast } from "sonner";

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/admin/products").then(({ data }) => setProducts(data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const toggle = async (p) => {
    try {
      await api.patch(`/products/${p.id}`, { is_active: !p.is_active });
      toast.success(p.is_active ? "Produit désactivé" : "Produit réactivé");
      load();
      setSelected((s) => s ? { ...s, is_active: !s.is_active } : s);
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || p.seller_name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10 flex items-center justify-between">
        <div className="pl-10 lg:pl-0">
          <h1 className="font-display font-black text-xl text-afri-secondary">Produits</h1>
          <p className="text-xs text-gray-500">{products.length} produits</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg"><RefreshCw size={16} className="text-gray-500" /></button>
      </header>

      <main className="p-4 lg:p-8 max-w-7xl space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Produit, boutique, catégorie…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-hidden focus:ring-2 focus:ring-afri-primary" />
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Chargement…</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Produit</th>
                    <th className="px-4 py-3 text-left">Boutique</th>
                    <th className="px-4 py-3 text-left">Catégorie</th>
                    <th className="px-4 py-3 text-left">Prix</th>
                    <th className="px-4 py-3 text-left">Stock</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Aucun produit</td></tr>
                  ) : filtered.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                            {p.photos?.[0] ? <img src={photoUrl(p.photos[0])} alt="" className="w-full h-full object-cover" /> :
                              <div className="w-full h-full flex items-center justify-center text-gray-300 font-black font-display">A</div>}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 truncate max-w-[160px]">{p.name}</div>
                            <div className="text-xs text-gray-500">{timeAgo(p.created_at)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p.seller_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{p.category}</td>
                      <td className="px-4 py-3 font-semibold text-afri-secondary">{formatPrice(p.price, p.currency)}</td>
                      <td className="px-4 py-3 text-gray-600">{p.stock}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          p.is_active ? "bg-afri-soft text-afri-primary" : "bg-red-50 text-red-600"}`}>
                          {p.is_active ? "Actif" : "Désactivé"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelected(p)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><Eye size={15} /></button>
                          <button onClick={() => toggle(p)} className={`p-1.5 hover:bg-gray-100 rounded-lg ${p.is_active ? "text-red-500" : "text-afri-primary"}`}>
                            {p.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal détail produit */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-display font-black text-lg text-afri-secondary">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {selected.photos?.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {selected.photos.slice(0, 3).map((ph, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img src={photoUrl(ph)} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Prix" value={formatPrice(selected.price, selected.currency)} />
                <Info label="Stock" value={selected.stock} />
                <Info label="Catégorie" value={selected.category} />
                <Info label="Boutique" value={selected.seller_name} />
                <Info label="Mode livraison" value={(selected.delivery_modes || []).join(", ")} />
                <Info label="Devise" value={selected.currency} />
              </div>
              {selected.description && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                  <div className="font-semibold mb-1">Description</div>
                  <p>{selected.description}</p>
                </div>
              )}
              <button onClick={() => { toggle(selected); }}
                className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                  selected.is_active ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-afri-soft text-afri-primary hover:bg-[#c8ede1]"}`}>
                {selected.is_active ? "Désactiver ce produit" : "Réactiver ce produit"}
              </button>
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
