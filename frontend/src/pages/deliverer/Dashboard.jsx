import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import api, { formatApiError } from "../../lib/api";
import { formatPrice, timeAgo, photoUrl } from "../../lib/format";
import {
  Bike, Package, MapPin, Navigation, CheckCircle2, LogOut, TrendingUp, Clock, Camera,
} from "lucide-react";

const STATUS_FLOW = {
  assigned: { label: "À récupérer", color: "bg-[#E6F1FB] text-[#0C447C]", next: "picked-up", nextLabel: "Colis récupéré" },
  picked_up: { label: "Récupéré", color: "bg-[#FAEEDA] text-[#633806]", next: "en-route", nextLabel: "Je suis en route" },
  out_for_delivery: { label: "En livraison", color: "bg-[#FAEEDA] text-[#633806]", next: "confirm", nextLabel: "Confirmer livraison" },
  delivered: { label: "Livré", color: "bg-[#E1F5EE] text-[#085041]", next: null },
};

export default function DelivererDashboard() {
  const { user, logout, refresh } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [codeFor, setCodeFor] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(null);
  const fileRef = useRef(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [wallet, setWallet] = useState(null);

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadPhoto(file);
    e.target.value = "";
  };

  const uploadPhoto = async (file) => {
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/auth/me/photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await refresh();
      toast.success("Photo de profil mise à jour");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const load = () => {
    api.get("/deliverer/deliveries").then(({ data }) => setDeliveries(data)).catch(() => {});
    api.get("/deliverer/earnings").then(({ data }) => setEarnings(data)).catch(() => {});
    api.get("/seller/wallet/deliverer/balance").then(({ data }) => setWallet(data)).catch(() => {});
  };

  useEffect(() => {
    api.get("/deliverer/me").catch(() => {});
    load();
    setLoading(false);
  }, []);

  const advance = async (order, action) => {
    if (action === "confirm") {
      setCodeFor(order.id);
      return;
    }
    setBusy(order.id);
    try {
      await api.post(`/deliverer/orders/${order.id}/${action}`);
      toast.success("Statut mis à jour");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy(null);
    }
  };

  const submitCode = async (orderId) => {
    setBusy(orderId);
    try {
      await api.post(`/deliverer/orders/${orderId}/confirm`, { code: code.trim() });
      toast.success("Livraison confirmée, paiement libéré");
      setCodeFor(null);
      setCode("");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy(null);
    }
  };

  const active = deliveries.filter((d) => d.status !== "delivered");
  const done = deliveries.filter((d) => d.status === "delivered");
  const gpsWatchRef = useRef(null);

  useEffect(() => {
    const activeOrder = active[0];
    if (!activeOrder || !["assigned", "picked_up", "out_for_delivery"].includes(activeOrder.status)) {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
      return;
    }
    if (gpsWatchRef.current !== null) return;
    if (!navigator.geolocation) return;
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        api.post(`/deliverer/orders/${activeOrder.id}/location`, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }).catch(() => {});
      },
      (err) => { console.warn("GPS error:", err.message); },
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 10000 }
    );
    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    };
  }, [active]);



  return (
    <div className="mobile-shell pb-10">
      <header className="sticky top-0 z-40 bg-[#085041] text-white px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingPhoto}
              data-testid="upload-avatar-btn"
              className="relative w-9 h-9 rounded-lg bg-[#1D9E75] flex items-center justify-center overflow-hidden shrink-0"
            >
              {user?.profile_photo_url ? (
                <img src={photoUrl(user.profile_photo_url)} alt="Photo de profil" className="w-full h-full object-cover" />
              ) : (
                <Bike size={20} />
              )}
              <span className="absolute bottom-0 right-0 w-4 h-4 bg-[#085041] rounded-full flex items-center justify-center border border-white">
                <Camera size={9} className="text-white" />
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} data-testid="avatar-file-input" />
            <div>
              <div className="font-display font-black text-lg leading-tight flex items-center gap-2">Livreur{active.length > 0 && ["assigned","picked_up","out_for_delivery"].includes(active[0]?.status) && <span className="text-[9px] bg-[#1D9E75] px-1.5 py-0.5 rounded-full font-semibold animate-pulse">GPS</span>}</div>
              <div className="text-xs text-emerald-200/80">{user?.name}</div>
            </div>
          </div>
          <button onClick={() => { logout(); window.location.href = "/auth/login"; }} className="text-emerald-100 hover:text-white" data-testid="deliverer-logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {earnings && (
        <div className="px-4 mt-4 grid grid-cols-3 gap-2">
          <StatMini icon={Package} label="Aujourd'hui" value={earnings.completed_today} />
          <StatMini icon={TrendingUp} label="Gains" value={formatPrice(earnings.earnings_today, earnings.currency)} small />
          <StatMini icon={CheckCircle2} label="Total" value={earnings.completed_all} />
        </div>
      )}


      {wallet && (
        <div className="mx-4 mt-3 bg-[#085041] rounded-xl p-4 text-white">
          <p className="text-xs text-emerald-200 uppercase tracking-wide font-semibold mb-1">Wallet — Mes gains</p>
          <p className="text-3xl font-display font-black">
            {wallet.balance?.toLocaleString("fr-FR")} <span className="text-base font-normal opacity-80">{wallet.currency || "CDF"}</span>
          </p>
          <p className="text-xs text-emerald-200 mt-1">{wallet.completed_deliveries} livraison{wallet.completed_deliveries !== 1 ? "s" : ""} effectuée{wallet.completed_deliveries !== 1 ? "s" : ""}</p>
          <p className="text-[10px] text-emerald-300/70 mt-1">11 500 CDF par livraison AfriMarket confirmée</p>
        </div>
      )}

      <div className="px-4 mt-5">
        <h2 className="text-sm font-bold text-gray-900 mb-2">Livraisons en cours</h2>
        {loading ? (
          <p className="text-sm text-gray-500 py-8 text-center">Chargement…</p>
        ) : active.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-500">
            Aucune livraison assignée pour l'instant.
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((d) => {
              const flow = STATUS_FLOW[d.status] || {};
              return (
                <div key={d.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" data-testid={`delivery-${d.id}`}>
                  <div className="flex items-center justify-between px-4 py-2 bg-[#F1EFE8] border-b border-gray-100">
                    <span className="text-sm font-semibold text-gray-900">#{d.id.slice(0, 8)}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${flow.color}`}>{flow.label}</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#E6F1FB] text-[#0C447C] flex items-center justify-center shrink-0">
                        <Package size={14} />
                      </div>
                      <div className="text-sm">
                        <div className="text-gray-500 text-xs">Récupérer chez</div>
                        <div className="font-semibold text-gray-900">{d.seller_name}</div>
                        <div className="text-xs text-gray-500">{d.pickup_neighborhood || d.pickup_address || "—"}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center shrink-0">
                        <MapPin size={14} />
                      </div>
                      <div className="text-sm">
                        <div className="text-gray-500 text-xs">Livrer à</div>
                        <div className="font-semibold text-gray-900">{d.delivery_neighborhood || "—"}</div>
                        <div className="text-xs text-gray-500">{d.delivery_landmark || ""}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                      <span className="text-xs text-gray-400">{timeAgo(d.created_at)}</span>
                      <span className="font-display font-black text-[#085041]">{formatPrice(d.total_amount, d.currency)}</span>
                    </div>

                    {codeFor === d.id ? (
                      <div className="space-y-2">
                        <input
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Code à 6 chiffres du client"
                          data-testid={`confirm-code-${d.id}`}
                          className="w-full border border-gray-300 rounded-lg p-3 text-center text-lg tracking-widest font-mono focus:ring-2 focus:ring-[#1D9E75] outline-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => { setCodeFor(null); setCode(""); }} className="py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 font-semibold">
                            Annuler
                          </button>
                          <button
                            onClick={() => submitCode(d.id)}
                            disabled={busy === d.id || code.length !== 6}
                            data-testid={`submit-code-${d.id}`}
                            className="py-2.5 rounded-lg bg-[#1D9E75] text-white text-sm font-semibold disabled:opacity-50"
                          >
                            Valider
                          </button>
                        </div>
                      </div>
                    ) : flow.next ? (
                      <button
                        onClick={() => advance(d, flow.next)}
                        disabled={busy === d.id}
                        data-testid={`advance-${d.id}`}
                        className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-2.5 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {flow.next === "en-route" ? <Navigation size={16} /> : flow.next === "confirm" ? <CheckCircle2 size={16} /> : <Package size={16} />}
                        {flow.nextLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {done.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
            <Clock size={14} className="text-gray-400" /> Historique
          </h2>
          <div className="space-y-2">
            {done.slice(0, 10).map((d) => (
              <div key={d.id} className="bg-white rounded-lg border border-gray-100 px-4 py-3 flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium text-gray-900">#{d.id.slice(0, 8)}</span>
                  <span className="text-xs text-gray-500 ml-2">{d.delivery_neighborhood}</span>
                </div>
                <span className="text-xs text-[#1D9E75] font-medium flex items-center gap-1">
                  <CheckCircle2 size={13} /> Livré
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatMini({ icon: Icon, label, value, small }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
      <Icon size={16} className="text-[#1D9E75] mx-auto" />
      <div className={`font-display font-black text-[#085041] mt-1 ${small ? "text-sm" : "text-xl"}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}
