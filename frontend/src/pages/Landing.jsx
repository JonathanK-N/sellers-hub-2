import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthModal } from "../context/AuthModalContext";
import AnimatedContent from "../components/reactbits/AnimatedContent";
import CountUp from "../components/reactbits/CountUp";
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

// Conteneur centré, plein écran sur desktop, pleine largeur sur mobile
const WRAP = "max-w-7xl mx-auto px-4 md:px-8";

export default function Landing() {
  const { openAuth } = useAuthModal();
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
      {/* HEADER */}
      <header
        data-testid="guest-top-header"
        className="sticky top-0 z-40 bg-afri-secondary text-white shadow-md"
      >
        <div className={`${WRAP} py-3 flex items-center justify-between gap-4`}>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-md bg-afri-primary flex items-center justify-center font-black text-white">
              A
            </div>
            <span className="font-display font-black text-lg tracking-tight">AfriMarket</span>
          </div>

          {/* Recherche — visible dans le header à partir de md */}
          <form onSubmit={submitSearch} className="hidden md:block flex-1 max-w-xl">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un produit ou une boutique…"
                className="w-full bg-white/10 focus:bg-white text-white focus:text-gray-900 placeholder:text-gray-400 rounded-full py-2.5 pl-10 pr-4 text-sm outline-none transition-colors"
              />
            </div>
          </form>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openAuth("login")}
              data-testid="guest-login-btn"
              className="text-xs md:text-sm font-semibold bg-white/10 hover:bg-white/20 transition-colors rounded-full px-3 md:px-4 py-1.5 md:py-2"
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => openAuth("register")}
              data-testid="guest-register-btn"
              className="text-xs md:text-sm font-semibold bg-afri-primary hover:bg-afri-primary-hover transition-colors rounded-full px-3 md:px-4 py-1.5 md:py-2"
            >
              S'inscrire
            </button>
          </div>
        </div>

        {/* CATEGORY STRIP */}
        <div className="bg-afri-secondary border-t border-white/5">
          <div className={`${WRAP} py-2 flex gap-5 overflow-x-auto no-scrollbar`}>
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const active = cat === c.value;
              return (
                <button
                  key={c.value}
                  data-testid={`guest-category-${c.value}`}
                  onClick={() => setCat(c.value)}
                  className={`flex items-center gap-1.5 whitespace-nowrap text-xs md:text-sm font-medium pb-1.5 border-b-2 transition-colors ${
                    active
                      ? "text-afri-primary border-afri-primary"
                      : "text-gray-300 border-transparent hover:text-white"
                  }`}
                >
                  <Icon size={14} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className={`${WRAP} mt-4 md:mt-6`}>
        <div className="rounded-2xl overflow-hidden bg-afri-secondary text-white relative min-h-[300px] md:min-h-[420px] flex items-center p-6 md:p-14">
          <img
            src="https://images.unsplash.com/photo-1625989744655-9bff7a23dac4?crop=entropy&cs=srgb&fm=jpg&w=1600&q=70"
            alt="Marché africain"
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/85 via-black/50 to-black/10" />
          <div className="relative max-w-xl">
            <h1 className="font-display font-black text-2xl md:text-4xl lg:text-5xl leading-tight tracking-tight">
              Le marché de l'Afrique francophone, près de chez vous.
            </h1>
            <p className="text-gray-200 mt-3 text-sm md:text-base leading-relaxed">
              Parcourez les boutiques et produits librement. Connectez-vous pour commander ou contacter un vendeur.
            </p>

            <div className="flex flex-wrap gap-1.5 md:gap-2 mt-4">
              <span className="flex items-center gap-1 bg-white/10 backdrop-blur rounded-full px-2.5 md:px-3 py-1 md:py-1.5 text-[11px] md:text-xs font-medium">
                <Truck size={11} /> Livraison locale
              </span>
              <span className="flex items-center gap-1 bg-white/10 backdrop-blur rounded-full px-2.5 md:px-3 py-1 md:py-1.5 text-[11px] md:text-xs font-medium">
                <ShieldCheck size={11} /> Paiement sécurisé
              </span>
              <span className="flex items-center gap-1 bg-white/10 backdrop-blur rounded-full px-2.5 md:px-3 py-1 md:py-1.5 text-[11px] md:text-xs font-medium">
                <BadgeCheck size={11} /> Vendeurs vérifiés
              </span>
            </div>

            <button
              onClick={() => nav("/buyer/search")}
              data-testid="hero-explore-btn"
              className="mt-5 md:mt-7 inline-flex items-center gap-2 bg-white text-afri-secondary rounded-full px-5 md:px-6 py-2.5 md:py-3.5 text-sm md:text-base font-bold hover:bg-gray-100 transition-colors"
            >
              Explorer les produits <ArrowRight size={15} />
            </button>

            {/* Chiffres cles — comptage anime a l'apparition */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-5 md:mt-7 text-xs md:text-sm text-gray-300">
              <span className="flex items-center gap-1.5">
                <CountUp to={products.length} duration={1.4} className="font-bold text-white" />
                produits
              </span>
              <span className="text-gray-500">·</span>
              <span className="flex items-center gap-1.5">
                <CountUp to={5} duration={1.4} className="font-bold text-white" />
                pays couverts
              </span>
              <span className="text-gray-500">·</span>
              <span>Livraison locale</span>
            </div>
          </div>
        </div>
      </section>

      {/* RECHERCHE — visible sous le hero uniquement en dessous de md */}
      <form onSubmit={submitSearch} className={`${WRAP} mt-4 md:hidden`}>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            data-testid="guest-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit ou une boutique…"
            className="w-full bg-white border border-gray-200 rounded-full py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-afri-primary"
          />
        </div>
      </form>

      {/* TRUST BAR */}
      <AnimatedContent distance={50} duration={0.7} threshold={0.15}>
      <section className={`${WRAP} mt-4 md:mt-8`}>
        <div className="grid grid-cols-3 gap-2 md:gap-4 md:max-w-2xl">
          <TrustItem icon={ShieldCheck} label="Paiement sécurisé" />
          <TrustItem icon={MapPin} label="Livraison locale" />
          <TrustItem icon={Store} label="Vendeurs vérifiés" />
        </div>
      </section>
      </AnimatedContent>

      {/* PRODUITS */}
      <AnimatedContent distance={60} duration={0.8} threshold={0.12}>
      <section className={`${WRAP} mt-6 md:mt-10`}>
        <div className="flex items-center justify-between mb-3 md:mb-5">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-afri-secondary text-afri-primary flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </span>
            <h2 className="font-display font-bold text-lg md:text-2xl text-gray-900">
              Découvrez les boutiques
            </h2>
          </div>
          <span className="text-xs md:text-sm text-gray-500">{products.length} produits</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-gray-100 rounded-xl aspect-[3/4] animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            Aucun produit disponible pour cette catégorie.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} guest />
            ))}
          </div>
        )}
      </section>
      </AnimatedContent>

      {/* CTA FINAL */}
      <AnimatedContent distance={50} duration={0.7} threshold={0.15}>
      <section className={`${WRAP} mt-8 md:mt-14`}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-10 text-center md:max-w-2xl md:mx-auto">
          <h3 className="font-display font-bold text-lg md:text-2xl text-gray-900">
            Prêt à commander ou vendre ?
          </h3>
          <p className="text-sm md:text-base text-gray-500 mt-1.5 mb-4 md:mb-6">
            Créez votre compte gratuitement en quelques secondes.
          </p>
          <div className="flex flex-col md:flex-row gap-2 md:justify-center">
            <button
              type="button"
              onClick={() => openAuth("register")}
              data-testid="cta-register"
              className="bg-afri-primary hover:bg-afri-primary-hover text-white rounded-full py-3 px-6 font-semibold transition-colors flex justify-center items-center gap-2"
            >
              <UserPlus size={18} /> Créer mon compte
            </button>
            <button
              type="button"
              onClick={() => openAuth("login")}
              data-testid="cta-login"
              className="bg-gray-100 hover:bg-gray-200 text-afri-secondary rounded-full py-3 px-6 font-semibold transition-colors flex justify-center items-center gap-2"
            >
              <LogIn size={18} /> Se connecter
            </button>
          </div>
        </div>
      </section>
      </AnimatedContent>

      {/* PAYS */}
      <section className={`${WRAP} mt-6 md:mt-10`}>
        <div className="grid grid-cols-5 gap-2 md:gap-4 md:max-w-3xl">
          {[
            { flag: "🇨🇩", name: "RD Congo" },
            { flag: "🇨🇲", name: "Cameroun" },
            { flag: "🇨🇮", name: "Côte d'Ivoire" },
            { flag: "🇸🇳", name: "Sénégal" },
            { flag: "🇧🇯", name: "Bénin" },
          ].map((c) => (
            <div key={c.name} className="rounded-lg bg-white border border-gray-100 p-2 md:p-3 text-center hover:border-afri-primary transition-colors">
              <div className="text-xl md:text-2xl">{c.flag}</div>
              <div className="text-[10px] md:text-xs text-gray-600 mt-1 leading-tight">{c.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-10 md:mt-16 bg-afri-secondary text-gray-300">
        <div className={`${WRAP} pt-10 pb-8 md:pt-14 md:pb-10`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-afri-primary flex items-center justify-center font-black text-white text-sm">
                  A
                </div>
                <span className="font-display font-black text-white">AfriMarket</span>
              </div>
              <p className="text-xs text-gray-400 mt-3 leading-relaxed max-w-xs">
                Le marché de l'Afrique francophone. Achetez et vendez en toute confiance.
              </p>
            </div>
            <div>
              <div className="text-white font-semibold mb-2 text-sm">AfriMarket</div>
              <ul className="space-y-1.5 text-xs md:text-sm text-gray-400">
                <li><Link to="/auth/register" className="hover:text-afri-primary">Devenir vendeur</Link></li>
                <li><Link to="/buyer/search" className="hover:text-afri-primary">Toutes les boutiques</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-white font-semibold mb-2 text-sm">Aide</div>
              <ul className="space-y-1.5 text-xs md:text-sm text-gray-400">
                <li><button type="button" onClick={() => openAuth("login")} className="hover:text-afri-primary">Se connecter</button></li>
                <li><button type="button" onClick={() => openAuth("register")} className="hover:text-afri-primary">Créer un compte</button></li>
              </ul>
            </div>
            <div>
              <div className="text-white font-semibold mb-2 text-sm">Paiement</div>
              <div className="flex flex-wrap gap-1.5">
                {["Mobile Money", "CinetPay", "Cash à la livraison"].map((m) => (
                  <span key={m} className="text-[10px] bg-white/10 rounded-full px-2.5 py-1">{m}</span>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[10px] md:text-xs text-gray-500 mt-8 pt-6 border-t border-white/10">
            © {new Date().getFullYear()} AfriMarket. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}

function TrustItem({ icon: Icon, label }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-4 flex flex-col items-center gap-1.5 text-center">
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-afri-secondary text-afri-primary flex items-center justify-center">
        <Icon size={16} />
      </div>
      <span className="text-[10px] md:text-xs font-medium text-gray-700 leading-tight">{label}</span>
    </div>
  );
}
