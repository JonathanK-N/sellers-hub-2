import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShieldCheck, MapPin, LogIn, UserPlus, Store } from "lucide-react";
import api from "../lib/api";
import ProductCard from "../components/ProductCard";

const CATEGORIES = [
  { value: "all", label: "Tout" },
  { value: "Électronique", label: "Électronique" },
  { value: "Vêtements", label: "Vêtements" },
  { value: "Alimentation", label: "Alimentation" },
  { value: "Maison", label: "Maison" },
  { value: "Énergie / Solaire", label: "Solaire" },
  { value: "Agriculture", label: "Agriculture" },
];

export default function Landing() {
  const nav = useNavigate();
  const [cat, setCat] = useState("all");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = { country_code: "CD", sort: "newest" };
    if (cat !== "all") params.category = cat;
    api
      .get("/products", { params })
      .then(({ data }) => setProducts(data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [cat]);

  const submitSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    nav(`/explore/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-shell !pb-10">
        {/* HEADER */}
        <header
          data-testid="guest-top-header"
          className="sticky top-0 z-40 bg-[#085041] text-white px-4 py-3 flex items-center justify-between shadow-md"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-[#1D9E75] flex items-center justify-center font-black text-white">
              A
            </div>
            <span className="font-display font-black text-lg tracking-tight">AfriMarket</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/auth/login"
              data-testid="guest-login-btn"
              className="text-xs font-semibold bg-white/10 hover:bg-white/20 transition-colors rounded-full px-3 py-1.5"
            >
              Se connecter
            </Link>
            <Link
              to="/auth/register"
              data-testid="guest-register-btn"
              className="text-xs font-semibold bg-[#1D9E75] hover:bg-[#168260] transition-colors rounded-full px-3 py-1.5"
            >
              S'inscrire
            </Link>
          </div>
        </header>

        {/* HERO */}
        <section className="px-4 mt-4">
          <div className="rounded-2xl overflow-hidden bg-[#085041] text-white p-5 relative">
            <img
              src="https://images.unsplash.com/photo-1625989744655-9bff7a23dac4?crop=entropy&cs=srgb&fm=jpg&w=800&q=70"
              alt="Marché africain"
              className="absolute inset-0 w-full h-full object-cover opacity-25"
            />
            <div className="relative">
              <h1 className="font-display font-black text-2xl leading-tight tracking-tight">
                Le marché de l'Afrique francophone, près de chez vous.
              </h1>
              <p className="text-emerald-100 mt-2 text-sm leading-relaxed">
                Parcourez les boutiques et produits librement. Connectez-vous pour commander ou contacter un vendeur.
              </p>
            </div>
          </div>
        </section>

        {/* RECHERCHE */}
        <form onSubmit={submitSearch} className="px-4 mt-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              data-testid="guest-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un produit ou une boutique…"
              className="w-full bg-white border border-gray-200 rounded-full py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]"
            />
          </div>
        </form>

        {/* CATEGORIES */}
        <div className="mt-3 px-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              data-testid={`guest-category-${c.value}`}
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

        {/* TRUST BAR */}
        <section className="px-4 mt-4">
          <div className="grid grid-cols-3 gap-2">
            <TrustItem icon={ShieldCheck} label="Paiement sécurisé" />
            <TrustItem icon={MapPin} label="Livraison locale" />
            <TrustItem icon={Store} label="Vendeurs vérifiés" />
          </div>
        </section>

        {/* PRODUITS */}
        <section className="px-4 mt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg text-gray-900">
              Découvrez les boutiques
            </h2>
            <span className="text-xs text-gray-500">{products.length} produits</span>
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
                <ProductCard key={p.id} product={p} guest />
              ))}
            </div>
          )}
        </section>

        {/* CTA FINAL */}
        <section className="px-4 mt-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <h3 className="font-display font-bold text-lg text-gray-900">
              Prêt à commander ou vendre ?
            </h3>
            <p className="text-sm text-gray-500 mt-1.5 mb-4">
              Créez votre compte gratuitement en quelques secondes.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                to="/auth/register"
                data-testid="cta-register"
                className="bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 px-4 font-semibold transition-colors flex justify-center items-center gap-2"
              >
                <UserPlus size={18} /> Créer mon compte
              </Link>
              <Link
                to="/auth/login"
                data-testid="cta-login"
                className="bg-[#E1F5EE] hover:bg-[#c8ece0] text-[#085041] rounded-lg py-3 px-4 font-semibold transition-colors flex justify-center items-center gap-2"
              >
                <LogIn size={18} /> Se connecter
              </Link>
            </div>
          </div>
        </section>

        {/* PAYS */}
        <section className="px-4 mt-6">
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { flag: "🇨🇩", name: "RD Congo" },
              { flag: "🇨🇲", name: "Cameroun" },
              { flag: "🇨🇮", name: "Côte d'Ivoire" },
              { flag: "🇸🇳", name: "Sénégal" },
              { flag: "🇧🇯", name: "Bénin" },
            ].map((c) => (
              <div key={c.name} className="rounded-lg bg-white border border-gray-100 p-2">
                <div className="text-xl">{c.flag}</div>
                <div className="text-[10px] text-gray-600 mt-1 leading-tight">{c.name}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function TrustItem({ icon: Icon, label }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex flex-col items-center gap-1.5 text-center">
      <div className="w-8 h-8 rounded-full bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center">
        <Icon size={16} />
      </div>
      <span className="text-[10px] font-medium text-gray-700 leading-tight">{label}</span>
    </div>
  );
}
