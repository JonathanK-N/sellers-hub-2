import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Bell, BellOff, Check, CheckCheck } from "lucide-react";
import api, { formatApiError } from "../lib/api";
import { timeAgo } from "../lib/format";
import { enablePushNotifications, disablePushNotifications, notificationPermission, hasRegisteredToken } from "../lib/push";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [prefs, setPrefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pushOn, setPushOn] = useState(hasRegisteredToken());
  const [showPrefs, setShowPrefs] = useState(false);

  const load = () => {
    api.get("/notifications").then(({ data }) => setItems(data)).catch(() => {}).finally(() => setLoading(false));
  };
  const loadPrefs = () => api.get("/notifications/preferences").then(({ data }) => setPrefs(data)).catch(() => {});

  useEffect(() => { load(); loadPrefs(); }, []);

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("Tout marqué comme lu");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const togglePush = async () => {
    if (pushOn) {
      await disablePushNotifications();
      setPushOn(false);
      toast.success("Notifications push désactivées");
    } else {
      const res = await enablePushNotifications();
      if (res.ok) {
        setPushOn(true);
        toast.success(res.simulated ? "Notifications activées (mode démo)" : "Notifications push activées");
      } else {
        const msgs = {
          unsupported: "Votre navigateur ne supporte pas les notifications",
          denied: "Permission refusée. Activez les notifications dans les réglages du navigateur.",
          token_failed: "Impossible d'obtenir le jeton de notification",
        };
        toast.error(msgs[res.reason] || "Activation impossible");
      }
    }
  };

  const togglePref = async (type, enabled) => {
    setPrefs((prev) => prev.map((p) => (p.type === type ? { ...p, enabled } : p)));
    try {
      await api.patch("/notifications/preferences", { type, enabled });
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
      loadPrefs();
    }
  };

  const perm = notificationPermission();
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="mobile-shell pb-10">
      <header className="sticky top-0 z-40 bg-[#085041] text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <Link to="/buyer/home" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-black text-xl flex-1">Notifications</h1>
        {unread > 0 && (
          <button onClick={markAllRead} data-testid="mark-all-read" className="text-xs text-emerald-100 hover:text-white flex items-center gap-1">
            <CheckCheck size={15} /> Tout lire
          </button>
        )}
      </header>

      <div className="px-4 mt-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${pushOn ? "bg-[#E1F5EE] text-[#1D9E75]" : "bg-gray-100 text-gray-400"}`}>
                {pushOn ? <Bell size={18} /> : <BellOff size={18} />}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">Notifications push</div>
                <div className="text-xs text-gray-500">
                  {perm === "denied" ? "Bloquées par le navigateur" : pushOn ? "Activées sur cet appareil" : "Désactivées"}
                </div>
              </div>
            </div>
            <button
              onClick={togglePush}
              data-testid="toggle-push"
              className={`relative w-12 h-7 rounded-full transition-colors ${pushOn ? "bg-[#1D9E75]" : "bg-gray-300"}`}
            >
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${pushOn ? "left-6" : "left-1"}`} />
            </button>
          </div>

          <button
            onClick={() => setShowPrefs((s) => !s)}
            className="text-xs text-[#1D9E75] font-medium mt-3"
          >
            {showPrefs ? "Masquer les préférences" : "Gérer les types de notifications"}
          </button>

          {showPrefs && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              {prefs.map((p) => (
                <div key={p.type} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{p.label}</span>
                  <button
                    onClick={() => togglePref(p.type, !p.enabled)}
                    data-testid={`pref-${p.type}`}
                    className={`relative w-10 h-6 rounded-full transition-colors ${p.enabled ? "bg-[#1D9E75]" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${p.enabled ? "left-5" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 mt-5">
        {loading ? (
          <p className="text-sm text-gray-500 py-8 text-center">Chargement…</p>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
            <Bell size={28} className="text-gray-300 mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Aucune notification pour l'instant.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                data-testid={`notif-${n.id}`}
                className={`w-full text-left rounded-xl border p-4 transition-colors ${
                  n.read ? "bg-white border-gray-100" : "bg-[#E1F5EE] border-[#9FE1CB]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? "bg-transparent" : "bg-[#1D9E75]"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">{n.title}</span>
                      <span className="text-[11px] text-gray-400 shrink-0">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{n.body}</p>
                  </div>
                  {n.read && <Check size={14} className="text-gray-300 mt-1 shrink-0" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
