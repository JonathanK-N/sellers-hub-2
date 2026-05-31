import { useEffect, useState } from "react";
import { Search as SearchIcon, MapPin, ShieldCheck, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Slider } from "../../components/ui/slider";
import { Switch } from "../../components/ui/switch";
import api from "../../lib/api";
import ProductCard from "../../components/ProductCard";
import BottomNav from "../../components/BottomNav";
import { useAuth } from "../../context/AuthContext";

const PRESETS = [1, 5, 10, 25, 50];

export default function SearchPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [radius, setRadius] = useState(5);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState("nearest");
  const [pos, setPos] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setPos({ lat: 0, lng: 0 }),
      { timeout: 5000 }
    );
  }, []);

  useEffect(() => {
    const params = {
      country_code: user?.country_code,
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
    const t = setTimeout(() => {
      api
        .get("/products", { params })
        .then(({ data }) => setProducts(data))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, radius, verifiedOnly, sort, pos, user?.country_code]);

  return (
    <div className="mobile-shell">
      <header className="sticky top-0 z-40 bg-[#085041] text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <Link to="/buyer/home" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <div className="relative flex-1">
          <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            data-testid="search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-10 pr-3 py-2.5 rounded-full bg-white text-gray-900 text-sm outline-none"
          />
        </div>
      </header>

      <section className="px-4 mt-4 space-y-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <MapPin size={16} className="text-[#1D9E75]" />
              Rayon : {radius} km
            </div>
            <span className="text-xs text-gray-500">{products.length} vendeurs</span>
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
                    ? "bg-[#1D9E75] text-white border-[#1D9E75]"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {p} km
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-lg bg-gradient-to-br from-[#E1F5EE] to-emerald-50 border border-[#1D9E75]/20 h-32 relative overflow-hidden">
            {/* Mini-map mock */}
            <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,#1D9E75_1px,transparent_1px),linear-gradient(to_bottom,#1D9E75_1px,transparent_1px)] [background-size:24px_24px]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-[#1D9E75] border-2 border-white shadow ring-4 ring-[#1D9E75]/20" />
              </div>
            </div>
            {products.slice(0, 8).map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-[#1D9E75] border border-white"
                style={{
                  top: `${30 + (i * 13) % 70}%`,
                  left: `${20 + (i * 23) % 80}%`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
          <Toggle
            label="Vendeurs vérifiés uniquement"
            icon={<ShieldCheck size={16} className="text-[#1D9E75]" />}
            checked={verifiedOnly}
            onChange={setVerifiedOnly}
            testid="filter-verified-toggle"
          />

          <div>
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Tri</label>
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
                      ? "bg-[#085041] text-white border-[#085041]"
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

      <section className="px-4 mt-4">
        <h2 className="font-display font-bold text-base text-gray-900 mb-3">
          Résultats
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-100 rounded-xl aspect-[3/4] animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            Aucun produit trouvé dans ce rayon.
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

function Toggle({ label, checked, onChange, icon, testid }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-gray-700">
        {icon}
        {label}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} data-testid={testid} />
    </div>
  );
}
