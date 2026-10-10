import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Star, Truck, Store, ShieldCheck } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import TopBar from "../../components/TopBar";
import BottomNav from "../../components/BottomNav";
import { formatPrice, timeAgo } from "../../lib/format";

const STATUS_LABELS = {
  confirmed: { label: "Confirmée", color: "bg-blue-50 text-blue-700" },
  preparing: { label: "En préparation", color: "bg-amber-50 text-amber-700" },
  assigned: { label: "Livreur assigné", color: "bg-purple-50 text-purple-700" },
  picked_up: { label: "Colis récupéré", color: "bg-purple-50 text-purple-700" },
  out_for_delivery: { label: "En livraison", color: "bg-purple-50 text-purple-700" },
  ready_for_pickup: { label: "Prêt pour retrait", color: "bg-purple-50 text-purple-700" },
  delivered: { label: "Livrée", color: "bg-emerald-50 text-emerald-700" },
  collected: { label: "Retirée", color: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Annulée", color: "bg-red-50 text-red-700" },
};

const DELIVERY_STATUS_LABELS = {
  confirmed: "Commande confirmée",
  preparing: "Le vendeur prépare votre commande",
  assigned: "Un livreur a été assigné",
  picked_up: "Colis récupéré par le livreur",
  out_for_delivery: "Votre livreur est en route",
  ready_for_pickup: "Prêt — vous pouvez le retirer",
  delivered: "Livré",
  collected: "Retiré en boutique",
  cancelled: "Annulée",
};

function RateSellerModal({ order, onClose, onRated }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (rating === 0) {
      toast.error("Sélectionnez une note");
      return;
    }
    setBusy(true);
    try {
      await api.post("/reviews", { order_id: order.id, rating, comment });
      toast.success("Merci pour votre avis !");
      onRated();
      onClose();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-bold text-lg text-gray-900">Notez {order.seller_name || "ce vendeur"}</h3>
        <p className="text-xs text-gray-500 mt-1">Votre avis aide les autres acheteurs.</p>
        <div className="flex justify-center gap-2 my-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} data-testid={`rate-seller-star-${n}`} onClick={() => setRating(n)}>
              <Star size={32} className={n <= rating ? "text-afri-accent fill-afri-accent" : "text-gray-200"} />
            </button>
          ))}
        </div>
        <textarea
          data-testid="rate-seller-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Votre commentaire (optionnel)"
          rows={3}
          className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-afri-primary resize-none mb-3"
        />
        <button
          data-testid="submit-seller-rating-btn"
          disabled={busy}
          onClick={submit}
          className="w-full bg-afri-primary hover:bg-afri-primary-hover text-white rounded-lg py-3 font-semibold disabled:opacity-50"
        >
          {busy ? "Envoi…" : "Valider l'avis"}
        </button>
      </div>
    </div>
  );
}

export default function BuyerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rateTarget, setRateTarget] = useState(null);

  const load = () => {
    api.get("/orders/my").then(({ data }) => setOrders(data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="mobile-shell">
      <TopBar title="Mes commandes" showCart={false} />

      <div className="px-4 mt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            Aucune commande pour l'instant.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const status = STATUS_LABELS[o.status] || { label: o.status, color: "bg-gray-100 text-gray-700" };
              return (
                <div key={o.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" data-testid={`order-row-${o.id}`}>
                  <Link to={`/buyer/orders/${o.id}`} className="block p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                      <span className="text-xs text-gray-500">{timeAgo(o.created_at)}</span>
                    </div>

                    {/* Boutique */}
                    <div className="mt-2.5 text-sm font-semibold text-gray-900">
                      {o.seller_name}
                    </div>

                    {/* Article(s) */}
                    <div className="mt-1 text-sm text-gray-600 line-clamp-2">
                      {o.items.map((it) => it.name).join(", ")}
                    </div>

                    {/* Etat livraison + livreur */}
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                      {o.delivery_mode === "delivery" ? <Truck size={13} /> : <Store size={13} />}
                      <span>{DELIVERY_STATUS_LABELS[o.status] || o.status}</span>
                      {o.deliverer_name && (
                        <span className="text-gray-400">· Livreur : {o.deliverer_name}</span>
                      )}
                    </div>

                    {/* Montant + escrow */}
                    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <ShieldCheck size={12} className={o.escrow_status === "released" ? "text-green-600" : "text-gray-400"} />
                        {o.escrow_status === "released" ? "Payé" : "En escrow"}
                      </div>
                      <span className="font-display font-bold text-afri-secondary">
                        {formatPrice(o.amount_due ?? o.total_amount, o.currency)}
                      </span>
                    </div>
                  </Link>

                  {o.can_review_seller && (
                    <button
                      data-testid={`rate-seller-btn-${o.id}`}
                      onClick={() => setRateTarget(o)}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-afri-accent bg-[#FEF3E2] py-2.5 border-t border-amber-100"
                    >
                      <Star size={13} /> Laisser un avis
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rateTarget && (
        <RateSellerModal
          order={rateTarget}
          onClose={() => setRateTarget(null)}
          onRated={load}
        />
      )}

      <BottomNav role="buyer" />
    </div>
  );
}
