import { useEffect, useState } from "react";
import {
  Search as SearchIcon,
  MapPin,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Slider } from "../../components/ui/slider";
import { Switch } from "../../components/ui/switch";
import api from "../../lib/api";
import ProductCard from "../../components/ProductCard";
import BottomNav from "../../components/BottomNav";
import { useAuth } from "../../context/AuthContext";
import BannerCarousel from "../../components/BannerCarousel";

const PRESETS = [1, 5, 10, 25, 50];

export default function SearchPage({ guest = false }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const queryCountry = searchParams.get("country_code");
  const guestCountry = ["CD", "CM", "CI", "SN", "BJ"].includes(queryCountry)
    ? queryCountry
    : "CD";
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [radius, setRadius] = useState(25);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState("nearest");
  const [pos, setPos] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setPos(null),
      { timeout: 5000 },
    );
  }, []);

  useEffect(() => {
    const params = {
      country_code: user?.country_code || (guest ? guestCountry : undefined),
      radius_km: radius,
      verified_only: verifiedOnly,
      sort,
    };
    if (q) params.q = q;
    if (pos) {
      params.lat = pos.lat;
      params.lng = pos.lng;
    }
    setLoading(true);
    setError("");
    const t = setTimeout(() => {
      api
        .get("/products", { params })
        .then(({ data }) => setProducts(data))
        .catch(() => {
          setProducts([]);
          setError(
            "La recherche est momentanément indisponible. Réessayez lorsque la connexion est rétablie.",
          );
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [
    q,
    radius,
    verifiedOnly,
    sort,
    pos,
    user?.country_code,
    guest,
    guestCountry,
  ]);

  return (
    <div className="mobile-shell shell-wide">
      <header className="sticky top-0 z-40 bg-afri-secondary text-white px-4 md:px-8 py-3 flex items-center gap-3 shadow-md">
        <Link
          to={guest ? "/" : "/buyer/home"}
          className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center"
          data-testid="back-btn"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="relative flex-1">
          <SearchIcon
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            data-testid="search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-10 pr-3 py-2.5 rounded-full bg-white text-gray-900 text-sm outline-hidden"
          />
        </div>
      </header>

      {/* Banner search_top — juste sous la barre de recherche */}
      <BannerCarousel
        position="search_top"
        role={user?.role || "buyer"}
        className="mx-4 mt-3"
      />

      <section className="px-4 md:px-8 mt-4 space-y-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <MapPin size={16} className="text-afri-primary" />
              Rayon : {radius} km
            </div>
            <span className="text-xs text-gray-500">
              {products.length} résultat{products.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Slider
            data-testid="radius-slider"
            value={[radius]}
            onValueChange={(v) => setRadius(v[0])}
            min={1}
            max={50}
            step={1}
            className="mt-3"
          />
          <div className="mt-3 flex gap-1.5 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p}
                data-testid={`radius-preset-${p}`}
                onClick={() => setRadius(p)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  radius === p
                    ? "bg-afri-primary text-white border-afri-primary"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {p} km
              </button>
            ))}
          </div>

          {q && (
            <p className="text-xs text-gray-500 mt-3 bg-afri-soft rounded-lg px-3 py-2">
              La recherche par mot-clé ignore le rayon : tous les produits
              correspondants sont affichés, quel que soit l'emplacement du
              vendeur.
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-4 space-y-3">
          <Toggle
            label="Vendeurs vérifiés uniquement"
            icon={<ShieldCheck size={16} className="text-green-600" />}
            checked={verifiedOnly}
            onChange={setVerifiedOnly}
            testid="filter-verified-toggle"
          />

          <div>
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Tri
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {[
                { v: "nearest", l: "Plus proche" },
                { v: "rating", l: "Mieux noté" },
                { v: "price", l: "Prix bas" },
                { v: "newest", l: "Nouveauté" },
              ].map((o) => (
                <button
                  key={o.v}
                  data-testid={`sort-${o.v}`}
                  onClick={() => setSort(o.v)}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    sort === o.v
                      ? "bg-afri-primary text-white border-afri-primary"
                      : "bg-white text-gray-700 border-gray-200"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 md:px-8 mt-4">
        <h2 className="font-display font-bold text-base text-gray-900 mb-3">
          Résultats
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="afri-skeleton rounded-xl aspect-[3/4]" />
            ))}
          </div>
        ) : error ? (
          <p
            role="alert"
            className="text-center py-12 text-sm text-afri-secondary"
          >
            {error}
          </p>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            Aucun produit trouvé dans ce rayon.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 afri-stagger">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                guest={guest}
                className="afri-fade-up"
              />
            ))}
          </div>
        )}
      </section>

      {!guest && (
        <BottomNav role={user?.role === "seller" ? "seller" : "buyer"} />
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange, icon, testid }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-gray-700">
        {icon}
        {label}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        data-testid={testid}
      />
    </div>
  );
}
