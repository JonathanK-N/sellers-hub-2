import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import TopBar from "../../components/TopBar";
import BottomNav from "../../components/BottomNav";
import { formatPrice, photoUrl } from "../../lib/format";

export default function SellerProducts() {
  const nav = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/seller/products").then(({ data }) => setProducts(data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!window.confirm("Supprimer ce produit ?")) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success("Supprimé");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  return (
    <div className="mobile-shell">
      <TopBar title="Mes produits" showCart={false} />

      <div className="px-4 mt-4">
        <button
          data-testid="add-product-btn"
          onClick={() => nav("/seller/products/new")}
          className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold transition-colors flex items-center justify-center gap-2 mb-4"
        >
          <Plus size={18} /> Ajouter un produit
        </button>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            Vous n'avez pas encore de produits.
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex gap-3" data-testid={`product-row-${p.id}`}>
                <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {p.photos?.[0] ? <img src={photoUrl(p.photos[0])} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-gray-300 font-display">A</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 line-clamp-1">{p.name}</div>
                  <div className="text-sm font-bold text-[#085041]">{formatPrice(p.price, p.currency)}</div>
                  <div className="text-[10px] uppercase font-bold mt-1 text-gray-500">
                    Stock : <span className={p.stock > 0 ? "text-[#1D9E75]" : "text-[#E24B4A]"}>{p.stock}</span>
                  </div>
                </div>
                <button
                  data-testid={`delete-product-${p.id}`}
                  onClick={() => del(p.id)}
                  className="text-[#E24B4A] p-2 hover:bg-red-50 rounded-lg self-start"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav role="seller" />
    </div>
  );
}
