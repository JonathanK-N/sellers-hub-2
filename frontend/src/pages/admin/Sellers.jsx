import { useEffect, useState } from "react";
import { ShieldCheck, Search, Eye, Crown, Package, Star } from "lucide-react";
import api from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";
import { photoUrl, timeAgo } from "../../lib/format";
import { toast } from "sonner";

export default function AdminSellers() {
  const [sellers, setSellers] = useState([]);
  const [products, setProducts] = useState({});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/admin/sellers").then(({ data }) => setSellers(data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (s) => {
    setSelected(s);
    setSellerProducts([]);
    try {
      const { data } = await api.get(`/admin/sellers/${s.id}/products`);
      setSellerProducts(data);
    } catch { setSellerProducts([]); }
  };

  const togglePremium = async (sellerId, current) => {
    try {
      await api.post(`/admin/sellers/${sellerId}/toggle-premium`, { premium: !current });
      toast.success(!current ? "Premium activé" : "Premium désactivé");
      load();
      setSelected((s) => s ? { ...s, premium: !current } : s);
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const filtered = sellers.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.shop_name?.toLowerCase().includes(q) || s.owner_name?.toLowerCase().includes(q) || s.owner_phone?.includes(q);
  });

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10 flex items-center justify-between">
        <div className="pl-10 lg:pl-0">
          <h1 className="font-display font-black text-xl text-gray-900">Vendeurs & Boutiques</h1>
          <p className="text-xs text-gray-500">{sellers.length} boutiques</p>
        </div>
      </header>

      <main className="p-4 lg:p-8 max-w-7xl space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Boutique, propriétaire, téléphone…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#f97316]" />
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Chargement…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid={`seller-card-${s.id}`}>
                {/* Banner */}
                <div className="h-20 bg-gradient-to-r from-[#0b0b0d] to-[#f97316] relative">
                  {s.banner_url && <img src={s.banner_url} alt="" className="w-full h-full object-cover" />}
                  {s.premium && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 bg-[#f97316] text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                      <Crown size={11} /> Premium
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start gap-3 -mt-8 mb-3">
                    <div className="w-14 h-14 rounded-xl border-2 border-white shadow-sm bg-orange-50 text-[#f97316] flex items-center justify-center font-display font-black text-xl overflow-hidden">
                      {s.logo_url ? <img src={s.logo_url} alt="" className="w-full h-full object-cover" /> : s.shop_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 pt-8 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-gray-900 truncate">{s.shop_name}</span>
                        {s.badge_verified && <ShieldCheck size={14} className="text-green-600 shrink-0" />}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{s.owner_name} · {s.owner_phone}</div>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div>Catégorie : <span className="font-medium text-gray-900">{s.category}</span></div>
                    <div>Pays : <span className="font-medium text-gray-900">{s.country_code}</span></div>
                    <div>Quartier : <span className="font-medium text-gray-900">{s.neighborhood || "—"}</span></div>
                    {s.rating > 0 && (
                      <div className="flex items-center gap-1">
                        <Star size={11} className="text-[#f97316] fill-[#f97316]" />
                        <span className="font-medium text-gray-900">{s.rating.toFixed(1)}</span>
                        <span className="text-gray-500">({s.review_count} avis)</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      s.kyc_status === "level3" ? "bg-orange-50 text-[#f97316]" :
                      s.kyc_status === "level2" ? "bg-blue-50 text-blue-700" :
                      "bg-amber-50 text-amber-700"
                    }`}>
                      KYC {s.kyc_status}
                    </span>
                    <button onClick={() => openDetail(s)} className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 hover:underline">
                      <Eye size={14} /> Voir détails
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal détail boutique */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="h-32 bg-gradient-to-r from-[#0b0b0d] to-[#f97316] relative rounded-t-2xl overflow-hidden">
              {selected.banner_url && <img src={selected.banner_url} alt="" className="w-full h-full object-cover" />}
              <button onClick={() => setSelected(null)} className="absolute top-3 right-3 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60">✕</button>
            </div>
            <div className="px-6 pb-6">
              <div className="flex items-end gap-4 -mt-8 mb-4">
                <div className="w-20 h-20 rounded-xl border-3 border-white shadow-md bg-orange-50 text-[#f97316] flex items-center justify-center font-display font-black text-2xl overflow-hidden">
                  {selected.logo_url ? <img src={selected.logo_url} alt="" className="w-full h-full object-cover" /> : selected.shop_name?.charAt(0)}
                </div>
                <div className="pb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display font-black text-xl text-gray-900">{selected.shop_name}</h2>
                    {selected.badge_verified && <ShieldCheck size={18} className="text-green-600" />}
                    {selected.premium && <Crown size={16} className="text-[#f97316]" />}
                  </div>
                  <p className="text-sm text-gray-500">{selected.owner_name} · {selected.owner_phone}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <Info label="Catégorie" value={selected.category} />
                <Info label="Pays" value={selected.country_code} />
                <Info label="Quartier" value={selected.neighborhood || "—"} />
                <Info label="KYC" value={selected.kyc_status} />
                <Info label="Note" value={selected.rating > 0 ? `${selected.rating.toFixed(1)} ⭐ (${selected.review_count} avis)` : "Pas encore noté"} />
                <Info label="Inscrit" value={timeAgo(selected.created_at)} />
                <Info label="Livraison" value={selected.delivery_service === "afrimarket" ? "Réseau AfriMarket" : "Auto-livraison"} />
              </div>

              {selected.long_description && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 mb-4">
                  <div className="font-semibold text-gray-800 mb-1">Description</div>
                  <p className="leading-relaxed">{selected.long_description}</p>
                </div>
              )}

              {selected.specialties?.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-gray-500 mb-2">Spécialités</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.specialties.map((sp) => (
                      <span key={sp} className="text-xs bg-orange-50 text-gray-900 px-2 py-0.5 rounded-full">{sp}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Produits de la boutique */}
              {sellerProducts.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                    <Package size={13} /> {sellerProducts.length} produits
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {sellerProducts.slice(0, 9).map((p) => (
                      <div key={p.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative">
                        {p.photos?.[0] ? (
                          <img src={photoUrl(p.photos[0])} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 font-black text-xl font-display">A</div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">{p.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => togglePremium(selected.id, selected.premium)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    selected.premium ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-[#FAEEDA] text-[#BA7517] hover:bg-amber-100"
                  }`}>
                  <Crown size={15} /> {selected.premium ? "Retirer Premium" : "Activer Premium"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900 text-sm">{value || "—"}</div>
    </div>
  );
}
