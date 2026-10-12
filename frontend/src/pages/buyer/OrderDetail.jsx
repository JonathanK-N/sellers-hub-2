import DirectPaymentPanel from "../../components/DirectPaymentPanel";
import WhatsAppContact from "../../components/WhatsAppContact";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Circle, ShieldCheck, Package, Truck, Store, Lock, Bike, AlertTriangle, MessageSquare, MapPin, Navigation, Wifi, WifiOff, Banknote } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import { formatPrice, photoUrl } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import ReviewPrompt from "../../components/ReviewPrompt";

const STEPS_DELIVERY = [
  { key: "confirmed", icon: CheckCircle2, label: "Commande confirmée" },
  { key: "preparing", icon: Package, label: "Vendeur prépare" },
  { key: "out_for_delivery", icon: Truck, label: "En livraison" },
  { key: "delivered", icon: CheckCircle2, label: "Livrée" },
];
const STEPS_COLLECT = [
  { key: "confirmed", icon: CheckCircle2, label: "Commande confirmée" },
  { key: "preparing", icon: Package, label: "Vendeur prépare" },
  { key: "ready_for_pickup", icon: Package, label: "Prêt pour retrait" },
  { key: "collected", icon: CheckCircle2, label: "Retirée" },
];

const TRACKING_STATUSES = ["assigned", "picked_up", "out_for_delivery"];

let _leafletLoadPromise = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (_leafletLoadPromise) return _leafletLoadPromise;

  _leafletLoadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.setAttribute("data-leaflet-css", "true");
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Leaflet failed to load"));
    document.body.appendChild(script);
  });

  return _leafletLoadPromise;
}

function TrackingMap({ tracking }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapRef.current || mapInstanceRef.current) return;

        const defaultCenter = [-4.3225, 15.3222]; // Kinshasa
        const center = tracking?.deliverer_location
          ? [tracking.deliverer_location.lat, tracking.deliverer_location.lng]
          : defaultCenter;

        const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView(center, 14);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(map);
        mapInstanceRef.current = map;

        if (tracking?.deliverer_location) {
          const icon = L.divIcon({
            html: `<div style="background:var(--afri-primary);width:36px;height:36px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:18px;">🛵</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            className: "",
          });
          markerRef.current = L.marker(center, { icon }).addTo(map)
            .bindPopup(`<b>${tracking.deliverer_name || "Livreur"}</b><br>En route vers vous`);
        }

        if (tracking?.delivery_neighborhood) {
          const destIcon = L.divIcon({
            html: `<div style="background:var(--afri-secondary);width:32px;height:32px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px;">🏠</div>`,
            iconSize: [32, 32], iconAnchor: [16, 16], className: "",
          });
          L.marker(defaultCenter, { icon: destIcon }).addTo(map)
            .bindPopup(`<b>Destination</b><br>${tracking.delivery_neighborhood}`);
        }

        // Force Leaflet to recalculate size since the container may have been hidden/sized late
        setTimeout(() => map.invalidateSize(), 100);

        setMapReady(true);
      })
      .catch(() => { if (!cancelled) setMapError(true); });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !tracking?.deliverer_location || !window.L) return;
    const { lat, lng } = tracking.deliverer_location;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const L = window.L;
      const icon = L.divIcon({
        html: `<div style="background:var(--afri-primary);width:36px;height:36px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:18px;">🛵</div>`,
        iconSize: [36, 36], iconAnchor: [18, 18], className: "",
      });
      markerRef.current = L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current)
        .bindPopup(`<b>${tracking.deliverer_name || "Livreur"}</b><br>En route vers vous`);
    }
    mapInstanceRef.current.panTo([lat, lng], { animate: true });
  }, [tracking?.deliverer_location?.lat, tracking?.deliverer_location?.lng]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-100 shadow-xs">
      <div ref={mapRef} style={{ height: 220, width: "100%", background: "#f3f4f6" }} />
      {!mapReady && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-afri-soft text-xs text-afri-secondary">
          Chargement de la carte…
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-xs text-gray-500 px-4 text-center">
          Carte indisponible. {tracking?.deliverer_name ? `${tracking.deliverer_name} est en route.` : ""}
        </div>
      )}
      {tracking?.deliverer_location && mapReady && (
        <div className={`absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${tracking.location_fresh ? "bg-afri-soft text-afri-secondary" : "bg-gray-100 text-gray-500"}`}>
          {tracking.location_fresh ? <Wifi size={10} /> : <WifiOff size={10} />}
          {tracking.location_fresh ? "En direct" : "Position ancienne"}
        </div>
      )}
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [order, setOrder] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [deliverers, setDeliverers] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [collectConfirmed, setCollectConfirmed] = useState(false);
  const [confirmingCollect, setConfirmingCollect] = useState(false);
  const currentOrderId = useRef(id);
  currentOrderId.current = id;

  const load = useCallback(() => api.get(`/orders/${id}`).then(({ data }) => { if (currentOrderId.current === id) setOrder(data); }), [id]);

  useEffect(() => { setCollectConfirmed(false); setConfirmingCollect(false); setBusy(false); setCode(""); setShowAssign(false); setDeliverers([]); load(); }, [load]);

  // Polling statut toutes les 15s
  useEffect(() => {
    const interval = setInterval(() => { load(); }, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Polling position GPS toutes les 10s si en livraison
  useEffect(() => {
    if (!order || !TRACKING_STATUSES.includes(order.status)) return;
    const fetchTracking = () =>
      api.get(`/orders/${id}/tracking`).then(({ data }) => setTracking(data)).catch(() => {});
    fetchTracking();
    const interval = setInterval(fetchTracking, 10000);
    return () => clearInterval(interval);
  }, [id, order?.status]);

  const loadDeliverers = async () => {
    try {
      const { data } = await api.get("/deliverers/available");
      setDeliverers(data);
      setShowAssign(true);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const assign = async (delivererId) => {
    setBusy(true);
    try {
      await api.post(`/orders/${id}/assign`, { deliverer_id: delivererId });
      toast.success("Livreur assigné");
      setShowAssign(false);
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  if (!order || order.id !== id) return <div className="mobile-shell pt-24 text-center text-gray-500">Chargement…</div>;

  const steps = order.delivery_mode === "delivery" ? STEPS_DELIVERY : STEPS_COLLECT;
  const STATUS_TO_STEP = {
    assigned: "out_for_delivery",
    picked_up: "out_for_delivery",
    out_for_delivery: "out_for_delivery",
  };
  const effectiveStatus = STATUS_TO_STEP[order.status] || order.status;
  const currentIdx = Math.max(0, steps.findIndex((s) => s.key === effectiveStatus));

  const advance = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/orders/${id}/advance`);
      if (currentOrderId.current !== id) return;
      setOrder(data);
      toast.success("Statut mis à jour");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const confirmDelivery = async () => {
    setBusy(true);
    try {
      await api.post(`/orders/${id}/confirm-delivery`, { code });
      if (currentOrderId.current !== id) return;
      toast.success(order.payment_method === "direct" ? "Livraison confirmée — paiement hors plateforme." : "Livraison confirmée. Paiement libéré !");
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const confirmCollect = async () => {
    setConfirmingCollect(true);
    try {
      await api.post(`/orders/${id}/confirm-collect`);
      if (currentOrderId.current !== id) return;
      setCollectConfirmed(true);
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setConfirmingCollect(false);
    }
  };

  const isBuyer = user?.role === "buyer";
  const isSeller = user?.role === "seller";
  const showTracking = order.delivery_mode === "delivery" && TRACKING_STATUSES.includes(order.status);

  return (
    <div className="mobile-shell">
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <header className="sticky top-0 z-40 bg-afri-secondary text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <Link to={isSeller ? "/seller/orders" : "/buyer/orders"} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-display font-black text-xl">Commande</h1>
          <p className="text-[10px] text-emerald-200 uppercase">#{order.id.slice(0, 8)}</p>
        </div>
        {showTracking && (
          <div className="ml-auto flex items-center gap-1 bg-afri-primary px-2 py-1 rounded-full text-[10px] font-semibold animate-pulse">
            <Navigation size={10} /> En livraison
          </div>
        )}
      </header>

      <div className="px-4 mt-4 space-y-3">
        <DirectPaymentPanel key={order.id} order={order} role={user?.role} onChanged={load}/>
        {isBuyer && <WhatsAppContact contact={order.seller_whatsapp} reference={order.public_reference || "AF-" + order.id.slice(0,8).toUpperCase()}/>}
        {/* Escrow banner — masqué pour paiement en espèces (escrow non applicable) */}
        {!["cash", "direct"].includes(order.payment_method) && (
        <div className={`rounded-xl p-4 flex items-center gap-3 ${order.escrow_status === "released" ? "bg-emerald-100 border-emerald-300" : "bg-afri-soft border-afri-primary/30"} border`}>
          <div className="w-9 h-9 rounded-full bg-afri-primary text-white flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div className="text-xs text-afri-secondary flex-1">
            <p className="font-semibold">
              {order.escrow_status === "released"
                ? `${formatPrice(order.total_amount, order.currency)} libéré au vendeur`
                : order.escrow_status === "awaiting_payment" ? "Paiement en attente"
                : `${formatPrice(order.amount_due ?? order.total_amount, order.currency)} bloqué en escrow`}
            </p>
            <p className="opacity-80">
              {order.escrow_status === "released"
                ? "Paiement effectué avec succès."
                : order.escrow_status === "awaiting_payment" ? "Aucun paiement n’est encore confirmé."
                : "Sera libéré dès confirmation de réception."}
            </p>
          </div>
        </div>
        )}

        {/* Carte GPS tracking */}
        {showTracking && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-afri-soft text-afri-primary flex items-center justify-center">
                <MapPin size={14} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {tracking?.deliverer_name ? `${tracking.deliverer_name} est en route` : "Suivi en temps réel"}
                </p>
                <p className="text-[10px] text-gray-500">
                  {tracking?.deliverer_location
                    ? `Position mise à jour · ${tracking.location_fresh ? "En direct" : "Dernière position connue"}`
                    : "En attente de la position du livreur…"}
                </p>
              </div>
            </div>
            <TrackingMap tracking={tracking} />
          </section>
        )}

        {/* Timeline */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-xs p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">Suivi</h3>
          <ol className="space-y-4">
            {steps.map((s, i) => {
              const done = i <= currentIdx;
              const Icon = done ? CheckCircle2 : Circle;
              const event = order.timeline.find((t) => t.status === s.key);
              return (
                <li key={s.key} className="flex items-start gap-3" data-testid={`timeline-step-${s.key}`}>
                  <Icon size={20} className={done ? "text-afri-primary" : "text-gray-300"} />
                  <div className="flex-1">
                    <div className={`text-sm font-semibold ${done ? "text-gray-900" : "text-gray-400"}`}>
                      {s.label}
                    </div>
                    {event && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {new Date(event.timestamp).toLocaleString("fr-FR")}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Items */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-xs p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Articles</h3>
          <div className="space-y-3">
            {order.items.map((it, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {it.photo ? <img src={photoUrl(it.photo)} alt={it.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-gray-300 font-display">A</div>}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">{it.name}</div>
                  <div className="text-xs text-gray-500">x{it.quantity} · {formatPrice(it.price, order.currency)}</div>
                </div>
                <div className="font-semibold text-sm text-afri-secondary">{formatPrice(it.subtotal, order.currency)}</div>
              </div>
            ))}
          </div>
          {order.delivery_fee > 0 && (
            <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between text-sm text-gray-500">
              <span>Frais de livraison</span>
              <span>{formatPrice(order.delivery_fee, order.currency)}</span>
            </div>
          )}
          <div className={`${order.delivery_fee > 0 ? "mt-1" : "border-t border-gray-100 mt-3 pt-3"} flex justify-between font-display font-bold text-base text-afri-secondary`}>
            <span>Total</span>
            <span>{formatPrice(order.amount_due ?? order.total_amount, order.currency)}</span>
          </div>
        </section>

        {/* Acheteur — instruction retrait boutique */}
        {isBuyer && order.delivery_mode === "collect" && ["ready_for_pickup","confirmed","preparing"].includes(order.status) && (
          <section className="bg-afri-soft border border-afri-primary/30 rounded-xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-afri-primary text-white flex items-center justify-center shrink-0">
              <Store size={18} />
            </div>
            <div className="text-sm text-afri-secondary">
              <p className="font-semibold">Présentez-vous en boutique</p>
              <p className="mt-0.5 text-xs leading-relaxed text-afri-secondary/80">
                Le vendeur confirmera la remise après sa déclaration de réception du paiement convenu hors plateforme.
              </p>
              {order.pickup_slot && (
                <p className="mt-1 text-xs font-bold">Créneau : {order.pickup_slot}</p>
              )}
            </div>
          </section>
        )}

        {/* Vendeur — bouton confirmer remise cash */}
        {isSeller && order.delivery_mode === "collect" && ["ready_for_pickup","confirmed","preparing"].includes(order.status) && !collectConfirmed && (
          <section className="bg-white rounded-xl border-2 border-afri-primary shadow-xs p-4" data-testid="confirm-collect-section">
            <h3 className="text-sm font-bold text-afri-secondary mb-1">Remise en boutique</h3>
            <p className="text-xs text-gray-500 mb-4">
              {order.payment_method === "direct" ? "Confirmez après remise de la commande et déclaration de réception du paiement hors plateforme." : "Appuyez après avoir remis la commande à l'acheteur et reçu le paiement en espèces."}
            </p>
            <button
              data-testid="confirm-collect-btn"
              disabled={confirmingCollect || (order.payment_method === "direct" && (order.status !== "ready_for_pickup" || order.payment_status !== "seller_declared_received" || order.dispute_status === "open"))}
              onClick={confirmCollect}
              className="w-full bg-afri-primary hover:bg-afri-primary-hover active:scale-95 text-white rounded-xl py-4 font-bold text-base transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md"
            >
              {confirmingCollect ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Confirmation…
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  {order.payment_method === "direct" ? "Confirmer la remise, sans crédit AfriMarket" : "Confirmer la remise — cash reçu"}
                </>
              )}
            </button>
          </section>
        )}

        {/* Vendeur — écran succès animé */}
        {isSeller && order.delivery_mode === "collect" && (collectConfirmed || order.status === "collected") && (
          <section
            className="bg-white rounded-xl border-2 border-afri-primary shadow-xs p-6 flex flex-col items-center text-center gap-3"
            style={{ animation: "fadeInScale 0.4s cubic-bezier(0.34,1.56,0.64,1) both" }}
            data-testid="collect-confirmed-banner"
          >
            <div
              className="w-16 h-16 rounded-full bg-afri-soft flex items-center justify-center"
              style={{ animation: "popIn 0.5s 0.15s cubic-bezier(0.34,1.56,0.64,1) both", opacity: 0 }}
            >
              <CheckCircle2 size={36} className="text-green-600" />
            </div>
            <h3 className="font-display font-black text-xl text-afri-secondary">Remise confirmée !</h3>
            <p className="text-sm text-gray-600">
              Commande <span className="font-bold">#{order.id.slice(0,8).toUpperCase()}</span> remise à l'acheteur.
            </p>
            <p className="text-sm font-bold text-afri-primary">{order.payment_method === "direct" ? "Paiement hors plateforme déclaré par le vendeur" : "✓ Paiement cash encaissé"}</p>
          </section>
        )}

        {/* Chat with seller (buyer) */}
        {(isBuyer || isSeller) && (
          <button
            data-testid="chat-with-seller-btn"
            onClick={() => nav(`/messages/${order.buyer_id}__${order.seller_id}`, { state: { other_name: isBuyer ? order.seller_name : order.buyer_name, order_id: order.id } })}
            className="w-full bg-white border border-afri-primary text-afri-primary hover:bg-afri-soft rounded-lg py-2.5 font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <MessageSquare size={16} /> {isBuyer ? "Discuter avec le vendeur" : "Discuter avec l’acheteur"}
          </button>
        )}

        {/* Buyer: confirmation code */}
        {isBuyer && order.delivery_mode === "delivery" && (order.escrow_status === "held" || order.payment_method === "direct") && (
          <section className="bg-white rounded-xl border-2 border-afri-accent shadow-xs p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-afri-accent mb-2">
              Code de confirmation
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Donnez ce code au livreur uniquement à la réception. Cela libérera le paiement.
            </p>
            <div className="text-4xl font-display font-black tracking-[0.5rem] text-center bg-[#FEF3E2] py-4 rounded-lg text-afri-secondary" data-testid="confirmation-code-display">
              {order.confirmation_code}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-600 mb-2">Vous êtes le livreur ? Saisissez le code :</p>
              <div className="flex gap-2">
                <input
                  data-testid="confirm-code-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6 chiffres"
                  maxLength={6}
                  className="flex-1 border border-gray-300 rounded-lg p-2.5 text-center font-bold tracking-widest outline-hidden focus:ring-2 focus:ring-afri-primary"
                />
                <button
                  data-testid="confirm-delivery-btn"
                  disabled={busy || code.length !== 6}
                  onClick={confirmDelivery}
                  className="bg-afri-primary hover:bg-afri-primary-hover text-white px-4 rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  Valider
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Seller: assign deliverer (home delivery only) */}
        {isSeller && order.delivery_mode === "delivery" && ["confirmed", "preparing"].includes(order.status) && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-xs p-4">
            <div className="flex items-center gap-2 mb-1">
              <Bike size={18} className="text-afri-primary" />
              <h3 className="text-sm font-semibold text-gray-900">Livreur</h3>
            </div>
            {order.deliverer_name ? (
              <p className="text-sm text-gray-600">
                Assigné à <span className="font-semibold text-gray-900">{order.deliverer_name}</span>. Il gère la suite de la livraison.
              </p>
            ) : !showAssign ? (
              <>
                <p className="text-xs text-gray-500 mb-3">Assignez un livreur pour récupérer et livrer ce colis.</p>
                <button
                  data-testid="load-deliverers-btn"
                  onClick={loadDeliverers}
                  className="w-full border border-afri-primary text-afri-primary rounded-lg py-2.5 font-semibold text-sm hover:bg-afri-soft"
                >
                  Assigner un livreur
                </button>
              </>
            ) : deliverers.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun livreur disponible dans votre zone.</p>
            ) : (
              <div className="space-y-2">
                {deliverers.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => assign(d.id)}
                    disabled={busy}
                    data-testid={`assign-deliverer-${d.id}`}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-afri-primary disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-afri-soft text-afri-primary flex items-center justify-center">
                        <Bike size={15} />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-gray-900">{d.name}</div>
                        <div className="text-xs text-gray-500">{d.vehicle} · {d.active_deliveries} en cours</div>
                      </div>
                    </div>
                    <span className="text-xs text-afri-primary font-medium">Choisir</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Seller advance */}
        {isSeller && ["confirmed", "preparing"].includes(order.status) && !(order.delivery_mode === "delivery" && order.deliverer_id && order.status === "preparing") && (
          <button
            data-testid="advance-order-btn"
            disabled={busy || (order.payment_method === "direct" && (order.payment_status !== "seller_declared_received" || order.dispute_status === "open"))}
            onClick={advance}
            className="w-full bg-afri-primary hover:bg-afri-primary-hover text-white rounded-lg py-3 font-semibold transition-colors disabled:opacity-50"
          >
            {order.status === "confirmed" ? "Marquer en préparation" : (order.delivery_mode === "delivery" ? "Marquer en livraison" : "Prêt pour retrait")}
          </button>
        )}

        {/* Delivery info */}
        {order.delivery_mode === "delivery" && order.delivery_neighborhood && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-xs p-4 text-sm">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Adresse</h3>
            <p className="text-gray-900 font-medium">{order.delivery_neighborhood}</p>
            {order.delivery_landmark && <p className="text-gray-600">{order.delivery_landmark}</p>}
            {order.delivery_address && <p className="text-gray-500 text-xs mt-1">{order.delivery_address}</p>}
          </section>
        )}

        {/* Payment */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-xs p-4 flex items-center gap-3">
          {order.payment_method === "cash" ? (
            <Banknote size={18} className="text-afri-primary" />
          ) : (
            <Lock size={18} className="text-gray-400" />
          )}
          <div className="text-sm">
            <div className="font-semibold text-gray-900">
              {order.payment_method === "direct" ? "Paiement direct avec le vendeur" : order.payment_method === "cash" ? "Paiement en espèces" : order.payment_method}
            </div>
            <div className="text-xs text-gray-500">
              {order.payment_method === "direct" ? "Hors plateforme — non vérifié par AfriMarket" : order.payment_method === "cash" ? "À la livraison / au retrait" : "Mobile Money"}
            </div>
          </div>
        </section>

        {/* Review prompt (buyer, post-delivery) */}
        {isBuyer && (order.status === "delivered" || order.status === "collected") && (order.escrow_status === "released" || order.payment_method === "direct") && (
          <ReviewPrompt orderId={order.id} sellerName={order.seller_name} />
        )}

        {/* Open dispute button */}
        {isBuyer && order.escrow_status !== "refunded" && (
          <button
            data-testid="open-dispute-btn"
            onClick={() => nav(`/buyer/dispute/${order.id}`)}
            className="w-full text-sm text-[#E24B4A] border border-[#E24B4A]/30 hover:bg-red-50 rounded-lg py-2.5 font-semibold flex items-center justify-center gap-2"
          >
            <AlertTriangle size={16} /> Ouvrir un litige
          </button>
        )}
      </div>
    </div>
  );
}
