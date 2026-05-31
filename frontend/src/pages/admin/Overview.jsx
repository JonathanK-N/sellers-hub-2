import { useEffect, useState } from "react";
import { Users, Store, ShoppingBag, ShieldCheck, TrendingUp, Package } from "lucide-react";
import api from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";
import { formatPrice } from "../../lib/format";

const COUNTRY_NAMES = { CD: "RD Congo", CM: "Cameroun", CI: "Côte d'Ivoire", SN: "Sénégal", BJ: "Bénin" };
const COUNTRY_FLAGS = { CD: "🇨🇩", CM: "🇨🇲", CI: "🇨🇮", SN: "🇸🇳", BJ: "🇧🇯" };

export default function AdminOverview() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/admin/overview").then(({ data }) => setData(data));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />

      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10">
        <h1 className="font-display font-black text-xl lg:text-2xl text-[#085041]">Vue d'ensemble</h1>
        <p className="text-xs text-gray-500 mt-0.5">AfriMarket · Administration</p>
      </header>

      <main className="p-6 lg:p-10 max-w-7xl space-y-6">
        {!data ? (
          <div className="text-gray-500">Chargement…</div>
        ) : (
          <>
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Stat icon={Users} label="Utilisateurs" value={data.users_count} />
              <Stat icon={Users} label="Acheteurs" value={data.buyers_count} />
              <Stat icon={Store} label="Vendeurs" value={data.sellers_count} />
              <Stat icon={Package} label="Produits" value={data.products_count} />
              <Stat icon={ShoppingBag} label="Commandes" value={data.orders_count} />
              <Stat icon={ShieldCheck} label="KYC en attente" value={data.open_kyc} highlight={data.open_kyc > 0} />
            </section>

            <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Commission totale (escrow libéré)</div>
                  <div className="font-display font-black text-3xl text-[#085041] mt-1">
                    {formatPrice(data.total_commission, "FC")}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">
                Performance par pays
              </h3>
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
                      <div className="font-display font-bold text-[#085041]">
                        {formatPrice(stats.commission, "FC")}
                      </div>
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
    <div className={`bg-white rounded-xl border shadow-sm p-4 ${highlight ? "border-[#EF9F27]" : "border-gray-200"}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${highlight ? "bg-amber-50 text-[#EF9F27]" : "bg-[#E1F5EE] text-[#1D9E75]"}`}>
        <Icon size={18} />
      </div>
      <div className="font-display font-black text-2xl text-[#085041] mt-2">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
