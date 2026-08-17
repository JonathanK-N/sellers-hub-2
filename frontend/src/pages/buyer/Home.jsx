import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import api from "../../lib/api";
import TopBar from "../../components/TopBar";
import BottomNav from "../../components/BottomNav";
import ProductCard from "../../components/ProductCard";
import BannerCarousel from "../../components/BannerCarousel";
import { useAuth } from "../../context/AuthContext";

const CATEGORIES = [
  { value: "all",          label: "Tout" },
  { value: "Électronique", label: "Électronique" },
  { value: "Vêtements",    label: "Vêtements" },
  { value: "Alimentation", label: "Alimentation" },
  { value: "Maison",       label: "Maison" },
  { value: "Solaire",      label: "Solaire" },
  { value: "Agriculture",  label: "Agriculture" },
];

// Config promo par défaut (affiché pendant le chargement)
const DEFAULT_PROMO = {
  visible: false,   // masqué par défaut pendant le chargement
  title: "Livraison gratuite dès 50 000 FC",
  subtitle: "Sur tous les produits dans votre quartier",
};

export default function BuyerHome() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [cat, setCat] = useState("all");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promo, setPromo] = useState(DEFAULT_PROMO);
  const [homeMidBanners, setHomeMidBanners] = useState(null); // null=chargement

  const role = user?.role || "buyer";

  useEffect(() => {
    setLoading(true);
    const params = { country_code: user?.country_code, sort: "newest" };
    if (cat !== "all") params.category = cat;
    api.get("/products", { params })
      .then(({ data }) => setProducts(data))
      .finally(() => setLoading(false));
  }, [cat, user?.country_code]);

  // Charger config promo + banners home_mid en parallèle
  useEffect(() => {
    Promise.all([
      api.get("/admin/config/promo-banner/public").then(({ data }) => data).catch(() => DEFAULT_PROMO),
      api.get("/admin/banners/public", { params: { position: "home_mid", role } }).then(({ data }) => data).catch(() => []),
    ]).then(([promoConfig, midBanners]) => {
      setPromo(promoConfig);
      setHomeMidBanners(midBanners);
    });
  }, [role]);

  return (
    <div className="mobile-shell">
      <TopBar title="AfriMarket" />

      {/* Barre de recherche */}
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

      {/* Banner home_top */}
      <BannerCarousel position="home_top" role={role} className="mx-4 mt-3" />

      {/* Catégories */}
      <div className="mt-3 px-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            data-testid={`category-${c.value}`}
            onClick={() => setCat(c.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${
              cat === c.value
                ? "bg-[#f97316] text-white border-[#f97316]"
                : "bg-white text-gray-700 border-gray-200 hover:border-[#f97316]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Zone home_mid :
          Priorité 1 — bannière admin home_mid si elle existe
          Priorité 2 — bloc promo fixe si visible=true
          Priorité 3 — rien */}
      <section className="px-4 mt-3">
        {homeMidBanners === null ? (
          /* Chargement — afficher le promo par défaut pour éviter le saut */
          promo.visible && <PromoBlock title={promo.title} subtitle={promo.subtitle} />
        ) : homeMidBanners.length > 0 ? (
          <BannerCarousel position="home_mid" role={role} />
        ) : promo.visible ? (
          <PromoBlock title={promo.title} subtitle={promo.subtitle} />
        ) : null}
      </section>

      {/* Produits */}
      <section className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#0b0b0d] text-[#f97316] flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </span>
            <h2 className="font-display font-bold text-lg text-gray-900">
              Produits près de vous
            </h2>
          </div>
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

function PromoBlock({ title, subtitle }) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-[#0b0b0d] to-[#f97316] text-white p-4 flex items-center gap-3 overflow-hidden relative">
      <div className="w-12 h-12 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
        <Sparkles size={22} />
      </div>
      <div className="relative">
        <h3 className="font-display font-bold text-base leading-tight">{title}</h3>
        <p className="text-xs text-emerald-100 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}
