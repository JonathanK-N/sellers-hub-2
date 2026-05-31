import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, RefreshCw, Ban, AlertTriangle, EyeOff, UserX } from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from "recharts";
import api, { formatApiError } from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";
import { timeAgo } from "../../lib/format";

const LEVEL_STYLES = {
  danger: "bg-red-50 text-red-700 border-red-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};

const LEVEL_LABEL = {
  danger: "Critique",
  warning: "Élevé",
  info: "À surveiller",
};

const STATUS_LABEL = {
  open: "Ouvert",
  dismissed: "Ignoré",
  warned: "Averti",
  actioned: "Traité",
};

function scoreColor(score) {
  if (score >= 90) return "#E24B4A";
  if (score >= 70) return "#EF9F27";
  return "#378ADD";
}

export default function AdminFraud() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [acting, setActing] = useState(null);

  const load = () => {
    api.get("/admin/fraud/stats").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/admin/fraud/alerts").then(({ data }) => setAlerts(data)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const runScan = async () => {
    setScanning(true);
    try {
      const { data } = await api.post("/admin/fraud/scan");
      toast.success(`${data.scanned} comptes analysés, ${data.flagged} signalés`);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setScanning(false);
    }
  };

  const act = async (userId, action) => {
    setActing(userId + action);
    try {
      await api.post(`/admin/fraud/${userId}/action`, { action });
      const labels = { ignore: "Alerte ignorée", warn: "Utilisateur averti", suspend: "Compte suspendu", ban: "Compte banni" };
      toast.success(labels[action]);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10 flex items-center justify-between">
        <div>
          <h1 className="font-display font-black text-xl lg:text-2xl text-[#085041]">Détection de fraude</h1>
          <p className="text-xs text-gray-500 mt-0.5">Scoring automatique des comptes à risque</p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          data-testid="fraud-scan-btn"
          className="flex items-center gap-2 bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={scanning ? "animate-spin" : ""} />
          {scanning ? "Analyse…" : "Lancer un scan"}
        </button>
      </header>

      <main className="p-6 lg:p-10 max-w-7xl space-y-6">
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Alertes totales" value={stats.total_alerts} />
            <StatCard label="Alertes ouvertes" value={stats.open_alerts} accent="#EF9F27" />
            <StatCard label="Critiques" value={stats.danger_alerts} accent="#E24B4A" />
            <StatCard label="Comptes suspendus" value={stats.suspended_users} accent="#A32D2D" />
          </div>
        )}

        {stats?.trend && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Alertes sur 7 jours</h3>
            <div style={{ width: "100%", height: 140 }}>
              <ResponsiveContainer>
                <BarChart data={stats.trend}>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} stroke="#9ca3af" />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats.trend.map((d, i) => (
                      <Cell key={i} fill={d.count > 0 ? "#1D9E75" : "#D3D1C7"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Comptes signalés</h3>
          {alerts.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-500 bg-white rounded-xl border border-gray-100">
              Aucune alerte. Lancez un scan pour analyser les comptes.
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((a) => (
                <div
                  key={a.user_id}
                  data-testid={`fraud-alert-${a.user_id}`}
                  className={`bg-white rounded-xl border-l-4 shadow-sm p-5 ${LEVEL_STYLES[a.level] || LEVEL_STYLES.info}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      <svg width="56" height="56" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="24" fill="none" stroke="#f1f1f1" strokeWidth="6" />
                        <circle
                          cx="28" cy="28" r="24" fill="none"
                          stroke={scoreColor(a.score)} strokeWidth="6" strokeLinecap="round"
                          strokeDasharray={`${(a.score / 100) * 150.8} 150.8`}
                          transform="rotate(-90 28 28)"
                        />
                        <text x="28" y="33" textAnchor="middle" fontSize="16" fontWeight="700" fill={scoreColor(a.score)}>
                          {a.score}
                        </text>
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{a.user_name || "Inconnu"}</span>
                        <span className="text-xs text-gray-500">{a.user_phone}</span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${LEVEL_STYLES[a.level]}`}>
                          {LEVEL_LABEL[a.level] || a.level}
                        </span>
                        {a.user_role && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {a.user_role}
                          </span>
                        )}
                        {a.user_suspended && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Suspendu
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-400 mt-0.5">
                        {a.user_country} · signalé {timeAgo(a.created_at)} · {STATUS_LABEL[a.status] || a.status}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {(a.signals || []).map((s, i) => (
                          <span key={i} className="text-[11px] bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-gray-700">
                            {s.label} <span className="text-gray-400">(+{s.weight})</span>
                          </span>
                        ))}
                      </div>

                      {a.status === "open" && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <ActionBtn icon={EyeOff} label="Ignorer" onClick={() => act(a.user_id, "ignore")} busy={acting === a.user_id + "ignore"} variant="ghost" />
                          <ActionBtn icon={AlertTriangle} label="Avertir" onClick={() => act(a.user_id, "warn")} busy={acting === a.user_id + "warn"} variant="warn" />
                          <ActionBtn icon={UserX} label="Suspendre" onClick={() => act(a.user_id, "suspend")} busy={acting === a.user_id + "suspend"} variant="suspend" />
                          <ActionBtn icon={Ban} label="Bannir" onClick={() => act(a.user_id, "ban")} busy={acting === a.user_id + "ban"} variant="ban" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-display font-black mt-1" style={{ color: accent || "#085041" }}>
        {value}
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, busy, variant }) {
  const styles = {
    ghost: "border-gray-200 text-gray-600 hover:bg-gray-50",
    warn: "border-amber-200 text-amber-700 hover:bg-amber-50",
    suspend: "border-orange-200 text-orange-700 hover:bg-orange-50",
    ban: "border-red-200 text-red-700 hover:bg-red-50",
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${styles[variant]}`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}
