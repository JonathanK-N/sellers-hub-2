import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search, ShieldCheck, MapPin, LogIn, UserPlus, Store,
  LayoutGrid, Smartphone, Shirt, UtensilsCrossed, Home as HomeIcon,
  Sun, Wheat, ArrowRight, Truck, BadgeCheck, Sparkles,
} from "lucide-react";
import api from "../lib/api";
import ProductCard from "../components/ProductCard";

const CATEGORIES = [
  { value: "all", label: "Tout", icon: LayoutGrid },
  { value: "Électronique", label: "Électronique", icon: Smartphone },
  { value: "Vêtements", label: "Vêtements", icon: Shirt },
  { value: "Alimentation", label: "Alimentation", icon: UtensilsCrossed },
  { value: "Maison", label: "Maison", icon: HomeIcon },
  { value: "Énergie / Solaire", label: "Solaire", icon: Sun },
  { value: "Agriculture", label: "Agriculture", icon: Wheat },
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
          className="sticky top-0 z-40 bg-[#0b0b0d] text-white px-4 py-3 flex items-center justify-between shadow-md"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-[#f97316] flex items-center justify-center font-black text-white">
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
              className="text-xs font-semibold bg-[#f97316] hover:bg-[#ea580c] transition-colors rounded-full px-3 py-1.5"
            >
              S'inscrire
            </Link>
          </div>
        </header>

        {/* CATEGORY STRIP */}
        <div className="bg-[#17171a] px-4 py-2 flex gap-4 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = cat === c.value;
            return (
              <button
                key={c.value}
                data-testid={`guest-category-${c.value}`}
                onClick={() => setCat(c.value)}
                className={`flex items-center gap-1.5 whitespace-nowrap text-xs font-medium pb-1.5 border-b-2 transition-colors ${
                  active
                    ? "text-[#f97316] border-[#f97316]"
                    : "text-gray-300 border-transparent hover:text-white"
                }`}
              >
                <Icon size={14} />
                {c.label}
              </button>
            );
          })}
        </div>

        {/* HERO */}
        <section className="px-4 mt-4">
          <div className="rounded-2xl overflow-hidden bg-[#0b0b0d] text-white p-5 relative">
            <img
              src="https://images.unsplash.com/photo-1625989744655-9bff7a23dac4?crop=entropy&cs=srgb&fm=jpg&w=800&q=70"
              alt="Marché africain"
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
            <div className="relative">
              <h1 className="font-display font-black text-2xl leading-tight tracking-tight">
                Le marché de l'Afrique francophone, près de chez vous.
              </h1>
              <p className="text-gray-200 mt-2 text-sm leading-relaxed">
                Parcourez les boutiques et produits librement. Connectez-vous pour commander ou contacter un vendeur.
              </p>

              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="flex items-center gap-1 bg-white/10 backdrop-blur rounded-full px-2.5 py-1 text-[11px] font-medium">
                  <Truck size={11} /> Livraison locale
                </span>
                <span className="flex items-center gap-1 bg-white/10 backdrop-blur rounded-full px-2.5 py-1 text-[11px] font-medium">
                  <ShieldCheck size={11} /> Paiement sécurisé
                </span>
                <span className="flex items-center gap-1 bg-white/10 backdrop-blur rounded-full px-2.5 py-1 text-[11px] font-medium">
                  <BadgeCheck size={11} /> Vendeurs vérifiés
                </span>
              </div>

              <button
                onClick={() => nav("/buyer/search")}
                data-testid="hero-explore-btn"
                className="mt-4 inline-flex items-center gap-2 bg-white text-[#0b0b0d] rounded-full px-4 py-2.5 text-sm font-bold hover:bg-gray-100 transition-colors"
              >
                Explorer les produits <ArrowRight size={15} />
              </button>
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
              className="w-full bg-white border border-gray-200 rounded-full py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#f97316]"
            />
          </div>
        </form>

        {/* TRUST BAR */}
        <section className="px-4 mt-4">
          <div className="grid grid-cols-3 gap-2">
            <TrustItem icon={ShieldCheck} label="Paiement sécurisé" />
            <TrustItem icon={MapPin} label="Livraison locale" />
            <TrustItem icon={Store} label="Vendeurs vérifiés" />
          </div>
        </section>

        {/* PRODUITS */}
        <section className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#0b0b0d] text-[#f97316] flex items-center justify-center shrink-0">
                <Sparkles size={16} />
              </span>
              <h2 className="font-display font-bold text-lg text-gray-900">
                Découvrez les boutiques
              </h2>
            </div>
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
                className="bg-[#f97316] hover:bg-[#ea580c] text-white rounded-full py-3 px-4 font-semibold transition-colors flex justify-center items-center gap-2"
              >
                <UserPlus size={18} /> Créer mon compte
              </Link>
              <Link
                to="/auth/login"
                data-testid="cta-login"
                className="bg-gray-100 hover:bg-gray-200 text-[#0b0b0d] rounded-full py-3 px-4 font-semibold transition-colors flex justify-center items-center gap-2"
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
              <div key={c.name} className="rounded-lg bg-white border border-gray-100 p-2 hover:border-[#f97316] transition-colors">
                <div className="text-xl">{c.flag}</div>
                <div className="text-[10px] text-gray-600 mt-1 leading-tight">{c.name}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-8 bg-[#0b0b0d] text-gray-300 rounded-t-2xl px-5 pt-6 pb-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#f97316] flex items-center justify-center font-black text-white text-sm">
              A
            </div>
            <span className="font-display font-black text-white">AfriMarket</span>
          </div>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            Le marché de l'Afrique francophone. Achetez et vendez en toute confiance.
          </p>

          <div className="grid grid-cols-2 gap-4 mt-5 text-xs">
            <div>
              <div className="text-white font-semibold mb-2">AfriMarket</div>
              <ul className="space-y-1.5 text-gray-400">
                <li><Link to="/auth/register" className="hover:text-[#f97316]">Devenir vendeur</Link></li>
                <li><Link to="/buyer/search" className="hover:text-[#f97316]">Toutes les boutiques</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-white font-semibold mb-2">Aide</div>
              <ul className="space-y-1.5 text-gray-400">
                <li><Link to="/auth/login" className="hover:text-[#f97316]">Se connecter</Link></li>
                <li><Link to="/auth/register" className="hover:text-[#f97316]">Créer un compte</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap gap-1.5">
            {["Mobile Money", "CinetPay", "Cash à la livraison"].map((m) => (
              <span key={m} className="text-[10px] bg-white/10 rounded-full px-2.5 py-1">{m}</span>
            ))}
          </div>

          <p className="text-[10px] text-gray-500 mt-5">
            © {new Date().getFullYear()} AfriMarket. Tous droits réservés.
          </p>
        </footer>
      </div>
    </div>
  );
}

function TrustItem({ icon: Icon, label }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex flex-col items-center gap-1.5 text-center">
      <div className="w-8 h-8 rounded-lg bg-[#0b0b0d] text-[#f97316] flex items-center justify-center">
        <Icon size={16} />
      </div>
      <span className="text-[10px] font-medium text-gray-700 leading-tight">{label}</span>
    </div>
  );
}
