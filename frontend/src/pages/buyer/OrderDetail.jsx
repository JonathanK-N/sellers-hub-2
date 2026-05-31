import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Circle, ShieldCheck, Package, Truck, Lock } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import { formatPrice, photoUrl } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";

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

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [order, setOrder] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/orders/${id}`).then(({ data }) => setOrder(data));
  useEffect(() => { load(); }, [id]);

  if (!order) return <div className="mobile-shell pt-24 text-center text-gray-500">Chargement…</div>;

  const steps = order.delivery_mode === "delivery" ? STEPS_DELIVERY : STEPS_COLLECT;
  const currentIdx = Math.max(0, steps.findIndex((s) => s.key === order.status));

  const advance = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/orders/${id}/advance`);
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
      toast.success("Livraison confirmée. Paiement libéré !");
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const isBuyer = user?.role === "buyer";
  const isSeller = user?.role === "seller";

  return (
    <div className="mobile-shell">
      <header className="sticky top-0 z-40 bg-[#085041] text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <Link to={isSeller ? "/seller/orders" : "/buyer/orders"} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-display font-black text-xl">Commande</h1>
          <p className="text-[10px] text-emerald-200 uppercase">#{order.id.slice(0, 8)}</p>
        </div>
      </header>

      <div className="px-4 mt-4 space-y-3">
        {/* Escrow banner */}
        <div className={`rounded-xl p-4 flex items-center gap-3 ${order.escrow_status === "released" ? "bg-emerald-100 border-emerald-300" : "bg-[#E1F5EE] border-[#1D9E75]/30"} border`}>
          <div className="w-9 h-9 rounded-full bg-[#1D9E75] text-white flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div className="text-xs text-[#085041] flex-1">
            <p className="font-semibold">
              {order.escrow_status === "released"
                ? `${formatPrice(order.total_amount, order.currency)} libéré au vendeur`
                : `${formatPrice(order.total_amount, order.currency)} bloqué en escrow`}
            </p>
            <p className="opacity-80">
              {order.escrow_status === "released"
                ? "Paiement effectué avec succès."
                : "Sera libéré dès confirmation de réception."}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">Suivi</h3>
          <ol className="space-y-4">
            {steps.map((s, i) => {
              const done = i <= currentIdx;
              const Icon = done ? CheckCircle2 : Circle;
              const event = order.timeline.find((t) => t.status === s.key);
              return (
                <li key={s.key} className="flex items-start gap-3" data-testid={`timeline-step-${s.key}`}>
                  <Icon size={20} className={done ? "text-[#1D9E75]" : "text-gray-300"} />
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
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
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
                <div className="font-semibold text-sm text-[#085041]">{formatPrice(it.subtotal, order.currency)}</div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between font-display font-bold text-base text-[#085041]">
            <span>Total</span>
            <span>{formatPrice(order.total_amount, order.currency)}</span>
          </div>
        </section>

        {/* QR code for Click & Collect (buyer view) */}
        {isBuyer && order.delivery_mode === "collect" && order.qr_code && order.escrow_status === "held" && (
          <section className="bg-white rounded-xl border-2 border-[#1D9E75] shadow-sm p-4 text-center" data-testid="qr-code-section">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#1D9E75] mb-2">
              Présentez ce QR au vendeur
            </h3>
            <div className="inline-block bg-white p-3 rounded-lg">
              <QRCodeSVG value={order.qr_code} size={200} fgColor="#085041" />
            </div>
            <p className="text-xs text-gray-600 mt-3 leading-relaxed">
              Le vendeur scanne ce code à votre arrivée. Le paiement sera libéré automatiquement.
            </p>
            {order.pickup_slot && (
              <p className="text-xs text-[#085041] mt-2 font-semibold">Créneau : {order.pickup_slot}</p>
            )}
          </section>
        )}

        {/* Seller QR scanner shortcut */}
        {isSeller && order.delivery_mode === "collect" && order.status === "ready_for_pickup" && order.escrow_status === "held" && (
          <button
            data-testid="goto-scanner-btn"
            onClick={() => nav("/seller/scan")}
            className="w-full bg-[#085041] hover:bg-[#063b30] text-white rounded-lg py-3 font-semibold flex items-center justify-center gap-2"
          >
            <ScanLine size={18} /> Scanner QR retrait
          </button>
        )}

        {/* Chat with seller (buyer) */}
        {isBuyer && (
          <button
            data-testid="chat-with-seller-btn"
            onClick={() => nav(`/messages/${order.buyer_id}__${order.seller_id}`, { state: { other_name: order.seller_name } })}
            className="w-full bg-white border border-[#1D9E75] text-[#1D9E75] hover:bg-[#E1F5EE] rounded-lg py-2.5 font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <MessageSquare size={16} /> Discuter avec le vendeur
          </button>
        )}

        {/* Buyer: confirmation code */}
        {isBuyer && order.delivery_mode === "delivery" && order.escrow_status === "held" && (
          <section className="bg-white rounded-xl border-2 border-[#EF9F27] shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#EF9F27] mb-2">
              Code de confirmation
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Donnez ce code au livreur uniquement à la réception. Cela libérera le paiement.
            </p>
            <div className="text-4xl font-display font-black tracking-[0.5rem] text-center bg-[#FEF3E2] py-4 rounded-lg text-[#085041]" data-testid="confirmation-code-display">
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
                  className="flex-1 border border-gray-300 rounded-lg p-2.5 text-center font-bold tracking-widest outline-none focus:ring-2 focus:ring-[#1D9E75]"
                />
                <button
                  data-testid="confirm-delivery-btn"
                  disabled={busy || code.length !== 6}
                  onClick={confirmDelivery}
                  className="bg-[#1D9E75] hover:bg-[#168260] text-white px-4 rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  Valider
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Seller advance */}
        {isSeller && ["confirmed", "preparing"].includes(order.status) && (
          <button
            data-testid="advance-order-btn"
            disabled={busy}
            onClick={advance}
            className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold transition-colors disabled:opacity-50"
          >
            {order.status === "confirmed" ? "Marquer en préparation" : (order.delivery_mode === "delivery" ? "Marquer en livraison" : "Prêt pour retrait")}
          </button>
        )}

        {/* Delivery info */}
        {order.delivery_mode === "delivery" && order.delivery_neighborhood && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-sm">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Adresse</h3>
            <p className="text-gray-900 font-medium">{order.delivery_neighborhood}</p>
            {order.delivery_landmark && <p className="text-gray-600">{order.delivery_landmark}</p>}
            {order.delivery_address && <p className="text-gray-500 text-xs mt-1">{order.delivery_address}</p>}
          </section>
        )}

        {/* Payment */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <Lock size={18} className="text-gray-400" />
          <div className="text-sm">
            <div className="font-semibold text-gray-900">{order.payment_method}</div>
            <div className="text-xs text-gray-500">Mobile Money (simulé)</div>
          </div>
        </section>

        {/* Review prompt (buyer, post-delivery) */}
        {isBuyer && (order.status === "delivered" || order.status === "collected") && order.escrow_status === "released" && (
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
