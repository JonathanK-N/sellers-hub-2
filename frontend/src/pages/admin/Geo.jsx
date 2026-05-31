import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Power, Users, Store, TrendingUp, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import api, { formatApiError, API_BASE } from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";
import { formatPrice } from "../../lib/format";

const COLORS = { CD: "#1D9E75", CM: "#EF9F27", CI: "#085041", SN: "#3B82F6", BJ: "#8B5CF6" };

export default function AdminGeo() {
  const [overview, setOverview] = useState([]);
  const [growth, setGrowth] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const load = async () => {
    const [o, g, a] = await Promise.all([
      api.get("/admin/geo/overview"),
      api.get("/admin/geo/growth"),
      api.get("/admin/geo/alerts"),
    ]);
    setOverview(o.data);
    setGrowth(g.data);
    setAlerts(a.data);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (code, current) => {
    try {
      await api.patch(`/admin/countries/${code}`, { is_active: !current });
      toast.success(`Pays ${!current ? "activé" : "désactivé"}`);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const exportCsv = (kind) => {
    const token = localStorage.getItem("afri_token");
    fetch(`${API_BASE}/admin/export/${kind}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${kind}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const maxUsers = Math.max(1, ...overview.map((c) => c.users));

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10 flex justify-between items-center">
        <div>
          <h1 className="font-display font-black text-xl lg:text-2xl text-[#085041]">Géographie</h1>
          <p className="text-xs text-gray-500 mt-0.5">Performance par pays · 5 marchés</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv("users")} data-testid="export-users-csv" className="text-xs bg-white border border-gray-300 rounded-lg px-3 py-2 font-semibold flex items-center gap-1.5 hover:bg-gray-50">
            <Download size={14} /> Utilisateurs CSV
          </button>
          <button onClick={() => exportCsv("orders")} data-testid="export-orders-csv" className="text-xs bg-white border border-gray-300 rounded-lg px-3 py-2 font-semibold flex items-center gap-1.5 hover:bg-gray-50">
            <Download size={14} /> Commandes CSV
          </button>
        </div>
      </header>
      <main className="p-6 lg:p-10 max-w-7xl space-y-6">
        {/* Alerts */}
        {alerts.length > 0 && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map((a, i) => (
              <div key={i} data-testid={`alert-${i}`} className={`rounded-xl border-l-4 p-3 flex items-center gap-3 ${
                a.level === "danger" ? "bg-red-50 border-red-400" : a.level === "warning" ? "bg-amber-50 border-amber-400" : "bg-blue-50 border-blue-400"
              }`}>
                <AlertCircle size={18} className={
                  a.level === "danger" ? "text-red-500" : a.level === "warning" ? "text-amber-600" : "text-blue-500"
                } />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">{a.title}</div>
                  <div className="text-xs text-gray-600">{a.action}</div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Country grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {overview.map((c) => (
            <div key={c.code} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5" data-testid={`geo-country-${c.code}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{c.flag}</span>
                  <div>
                    <div className="font-display font-bold text-lg">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.code} · {c.currency}</div>
                  </div>
                </div>
                <button
                  data-testid={`toggle-country-${c.code}`}
                  onClick={() => toggle(c.code, c.is_active)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${c.is_active ? "bg-[#E1F5EE] text-[#1D9E75]" : "bg-gray-100 text-gray-500"}`}
                >
                  <Power size={11} /> {c.is_active ? "Actif" : "Inactif"}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 flex items-center gap-1"><Users size={11} /> Utilisateurs</span>
                    <span className="font-semibold">{c.users} ({c.users_pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (c.users / maxUsers) * 100)}%`, background: COLORS[c.code] }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Store size={12} className="text-gray-400" />
                    <span><span className="font-bold">{c.sellers}</span> vendeurs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp size={12} className="text-gray-400" />
                    <span><span className="font-bold">{c.orders}</span> ventes</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100 flex justify-between items-baseline">
                  <span className="text-xs text-gray-500 uppercase font-bold">Commission</span>
                  <span className="font-display font-black text-lg text-[#085041]">{formatPrice(c.commission, c.currency)}</span>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Growth chart */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Inscriptions sur 6 mois (par pays)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {Object.keys(COLORS).map((code) => (
                  <Bar key={code} dataKey={code} fill={COLORS[code]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>
    </div>
  );
}
