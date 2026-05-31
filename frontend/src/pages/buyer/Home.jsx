import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import api from "../../lib/api";
import TopBar from "../../components/TopBar";
import BottomNav from "../../components/BottomNav";
import ProductCard from "../../components/ProductCard";
import { useAuth } from "../../context/AuthContext";

const CATEGORIES = [
  { value: "all", label: "Tout" },
  { value: "Électronique", label: "Électronique" },
  { value: "Vêtements", label: "Vêtements" },
  { value: "Alimentation", label: "Alimentation" },
  { value: "Maison", label: "Maison" },
  { value: "Solaire", label: "Solaire" },
  { value: "Agriculture", label: "Agriculture" },
];

export default function BuyerHome() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [cat, setCat] = useState("all");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = {
      country_code: user?.country_code,
      sort: "newest",
    };
    if (cat !== "all") params.category = cat;
    api
      .get("/products", { params })
      .then(({ data }) => setProducts(data))
      .finally(() => setLoading(false));
  }, [cat, user?.country_code]);

  return (
    <div className="mobile-shell">
      <TopBar title="AfriMarket" />

      <div className="px-4 pt-3">
        <button
          onClick={() => nav("/buyer/search")}
          data-testid="home-search-btn"
          className="w-full bg-gray-100 hover:bg-gray-200 transition-colors rounded-full py-3 pl-10 pr-4 text-sm text-left text-gray-500 relative"
        >
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" />
          Rechercher un produit ou vendeur…
        </button>
      </div>

      <div className="mt-3 px-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            data-testid={`category-${c.value}`}
            onClick={() => setCat(c.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${
              cat === c.value
                ? "bg-[#1D9E75] text-white border-[#1D9E75]"
                : "bg-white text-gray-700 border-gray-200 hover:border-[#1D9E75]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <section className="px-4 mt-4">
        <div className="rounded-xl bg-gradient-to-r from-[#085041] to-[#1D9E75] text-white p-4 flex items-center gap-3 overflow-hidden relative">
          <div className="w-12 h-12 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <Sparkles size={22} />
          </div>
          <div className="relative">
            <h3 className="font-display font-bold text-base leading-tight">
              Livraison gratuite dès 50 000 {user?.currency}
            </h3>
            <p className="text-xs text-emerald-100 mt-0.5">
              Sur tous les produits dans votre quartier
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-lg text-gray-900">
            Produits près de vous
          </h2>
          <span className="text-xs text-gray-500">{products.length} résultats</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-100 rounded-xl aspect-[3/4] animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            Aucun produit disponible pour cette catégorie.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      <BottomNav role={user?.role === "seller" ? "seller" : "buyer"} />
    </div>
  );
}
