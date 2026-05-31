import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import api from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";

export default function AdminSellers() {
  const [sellers, setSellers] = useState([]);
  useEffect(() => { api.get("/admin/sellers").then(({ data }) => setSellers(data)); }, []);

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10">
        <h1 className="font-display font-black text-xl lg:text-2xl text-[#085041]">Vendeurs</h1>
      </header>
      <main className="p-6 lg:p-10 max-w-7xl">
        {sellers.length === 0 ? (
          <div className="text-gray-500 text-sm">Aucun vendeur enregistré.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sellers.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4" data-testid={`seller-card-${s.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center font-display font-black text-xl">
                    {s.shop_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-900 truncate">{s.shop_name}</span>
                      {s.badge_verified && <ShieldCheck size={14} className="text-[#1D9E75]" />}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{s.owner_name} · {s.owner_phone}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-600">
                  <div>Catégorie : <span className="font-medium text-gray-900">{s.category}</span></div>
                  <div>Pays : <span className="font-medium text-gray-900">{s.country_code}</span></div>
                  <div>Quartier : <span className="font-medium text-gray-900">{s.neighborhood || "—"}</span></div>
                </div>
                <div className="mt-2">
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${s.kyc_status === "level3" ? "bg-[#E1F5EE] text-[#1D9E75]" : "bg-amber-50 text-amber-700"}`}>
                    KYC {s.kyc_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
