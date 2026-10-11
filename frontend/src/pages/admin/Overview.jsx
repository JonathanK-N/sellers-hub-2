import { useEffect, useState } from "react";
import { Users, Store, ShoppingBag, ShieldCheck, TrendingUp, Package, Crown, RefreshCw, AlertTriangle } from "lucide-react";
import api from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";
import { formatPrice, timeAgo } from "../../lib/format";

const COUNTRY_NAMES = { CD: "RD Congo", CM: "Cameroun", CI: "Côte d'Ivoire", SN: "Sénégal", BJ: "Bénin" };
const COUNTRY_FLAGS = { CD: "🇨🇩", CM: "🇨🇲", CI: "🇨🇮", SN: "🇸🇳", BJ: "🇧🇯" };

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/admin/overview"),
      api.get("/admin/orders"),
      api.get("/admin/geo/alerts"),
    ]).then(([{ data: d }, { data: o }, { data: a }]) => {
      setData(d);
      setOrders(o.slice(0, 8));
      setAlerts(a);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10 flex items-center justify-between">
        <div className="pl-10 lg:pl-0">
          <h1 className="font-display font-black text-xl lg:text-2xl text-afri-secondary">Vue d'ensemble</h1>
          <p className="text-xs text-gray-500 mt-0.5">AfriMarket · Administration</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg"><RefreshCw size={16} className={`text-gray-500 ${loading ? "animate-spin" : ""}`} /></button>
      </header>

      <main className="p-4 lg:p-8 max-w-7xl space-y-5">
        {!data ? (
          <div className="text-gray-500 py-12 text-center">Chargement…</div>
        ) : (
          <>
            {/* KPIs */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Stat icon={Users} label="Utilisateurs" value={data.users_count} />
              <Stat icon={Users} label="Acheteurs" value={data.buyers_count} />
              <Stat icon={Store} label="Vendeurs" value={data.sellers_count} />
              <Stat icon={Package} label="Produits" value={data.products_count} />
              <Stat icon={ShoppingBag} label="Commandes" value={data.orders_count} />
              <Stat icon={ShieldCheck} label="KYC en attente" value={data.open_kyc} highlight={data.open_kyc > 0} />
            </section>

            {/* Revenus */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-afri-soft text-afri-primary flex items-center justify-center"><TrendingUp size={20} /></div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Commission totale</div>
                    <div className="font-display font-black text-3xl text-afri-secondary mt-1">{formatPrice(data.total_commission, "FC")}</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#FAEEDA] text-[#BA7517] flex items-center justify-center"><Crown size={20} /></div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Revenus Premium</div>
                    <div className="font-display font-black text-3xl text-afri-secondary mt-1">{formatPrice(data.premium_revenue || 0, "FC")}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{data.premium_active || 0} boutiques Premium actives</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Alertes */}
            {alerts.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-500" /> Alertes ({alerts.length})
                </h3>
                <div className="space-y-2">
                  {alerts.map((a, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
                      a.level === "danger" ? "bg-red-50 text-red-700" :
                      a.level === "warning" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                    }`}>
                      <AlertTriangle size={16} className="shrink-0" />
                      <span className="flex-1">{a.title}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Commandes récentes */}
            {orders.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">Dernières commandes</h3>
                <div className="space-y-2">
                  {orders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{o.id.slice(0, 8)}</code>
                        <div className="text-sm text-gray-700">{o.buyer_name || "—"} → {o.seller_name || "—"}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-afri-secondary text-sm">{formatPrice(o.amount_due ?? o.total_amount, o.currency)}</span>
                        <span className="text-xs text-gray-400">{timeAgo(o.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Performance par pays */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">Performance par pays</h3>
              <div className="space-y-3">
                {Object.keys(COUNTRY_NAMES).map((code) => {
                  const stats = data.by_country?.[code] || { commission: 0, orders: 0 };
                  return (
                    <div key={code} className="flex items-center gap-3" data-testid={`country-row-${code}`}>
                      <span className="text-2xl">{COUNTRY_FLAGS[code]}</span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-900">{COUNTRY_NAMES[code]}</div>
                        <div className="text-xs text-gray-500">{stats.orders} commandes</div>
                      </div>
                      <div className="font-display font-bold text-afri-secondary">{formatPrice(stats.commission, "FC")}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, highlight }) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 ${highlight ? "border-afri-accent" : "border-gray-200"}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${highlight ? "bg-amber-50 text-afri-accent" : "bg-afri-soft text-afri-primary"}`}>
        <Icon size={18} />
      </div>
      <div className="font-display font-black text-2xl text-afri-secondary mt-2">{value ?? "—"}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
