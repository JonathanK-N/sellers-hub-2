import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Package, ShoppingBag, Star, TrendingUp, ShieldCheck, AlertCircle, Wallet, ScanLine } from "lucide-react";
import api from "../../lib/api";
import TopBar from "../../components/TopBar";
import BottomNav from "../../components/BottomNav";
import { formatPrice } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";

export default function SellerDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/seller/dashboard").then(({ data }) => {
      if (!data.shop) {
        nav("/seller/setup");
        return;
      }
      setData(data);
    });
  }, [nav]);

  if (!data) return <div className="mobile-shell pt-24 text-center text-gray-500">Chargement…</div>;

  return (
    <div className="mobile-shell">
      <TopBar title={data.shop?.shop_name || "Tableau"} showCart={false} />

      <div className="px-4 mt-4 space-y-3">
        {/* KYC notice */}
        {!data.shop.badge_verified && (
          <button
            onClick={() => nav("/seller/kyc")}
            className="w-full text-left rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-3 hover:bg-amber-100 transition-colors"
            data-testid="kyc-notice"
          >
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-semibold">Validez votre KYC pour devenir Vendeur Vérifié</p>
              <p className="opacity-80 mt-0.5">Limité à 10 produits sans KYC. Téléversez vos documents →</p>
            </div>
          </button>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={TrendingUp} label="Revenus" value={formatPrice(data.revenue, user?.currency)} />
          <Stat icon={ShoppingBag} label="Commandes" value={data.orders_total} sub={`${data.orders_pending} en cours`} />
          <Stat icon={Package} label="Produits actifs" value={data.products_active} sub={data.products_oos ? `${data.products_oos} en rupture` : null} />
          <Stat icon={Star} label="Note" value={data.rating ? data.rating.toFixed(1) : "—"} />
        </div>

        <button
          data-testid="add-product-quick-btn"
          onClick={() => nav("/seller/products/new")}
          className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Ajouter un produit
        </button>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Commandes récentes</h3>
          {data.recent_orders.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">Aucune commande pour l'instant.</p>
          ) : (
            <div className="space-y-2">
              {data.recent_orders.slice(0, 5).map((o) => (
                <button
                  key={o.id}
                  onClick={() => nav(`/buyer/orders/${o.id}`)}
                  data-testid={`recent-order-${o.id}`}
                  className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-[#1D9E75] transition-colors flex justify-between items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 truncate">{o.items[0]?.name}</div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">{o.status}</div>
                  </div>
                  <div className="font-display font-bold text-[#085041]">{formatPrice(o.total_amount, o.currency)}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${data.shop.badge_verified ? "bg-[#1D9E75]" : "bg-gray-200"} text-white flex items-center justify-center`}>
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">
              KYC : {data.shop.kyc_status === "level3" ? "Niveau 3 vérifié" : data.shop.kyc_status === "level2" ? "Niveau 2" : "Niveau 1 (téléphone)"}
            </div>
            <div className="text-xs text-gray-500">
              {data.shop.badge_verified ? "Badge Vendeur Vérifié activé" : "Validez votre identité pour gagner la confiance"}
            </div>
          </div>
        </section>
      </div>

      <BottomNav role="seller" />
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="w-9 h-9 rounded-lg bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center">
        <Icon size={18} />
      </div>
      <div className="font-display font-black text-xl text-[#085041] mt-2">{value}</div>
      <div className="text-xs text-gray-600">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className="bg-white rounded-xl border border-gray-100 shadow-sm py-3 flex flex-col items-center gap-1.5 text-xs font-semibold text-gray-700 hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors"
    >
      <Icon size={20} className="text-[#1D9E75]" />
      {label}
    </button>
  );
}
