import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Store, ChevronRight, Lock, Package, CreditCard, Loader2 } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import { formatPrice, timeAgo } from "../../lib/format";
import BottomNav from "../../components/BottomNav";

const STATUS_LABELS = {
  confirmed: "Confirmée",
  preparing: "En préparation",
  out_for_delivery: "En livraison",
  ready_for_pickup: "Prête pour retrait",
  delivered: "Livrée",
  collected: "Retirée",
  cancelled: "Annulée",
};

const STATUS_COLORS = {
  confirmed: "bg-[#E6F1FB] text-[#0C447C]",
  preparing: "bg-[#FAEEDA] text-[#633806]",
  out_for_delivery: "bg-[#FAEEDA] text-[#633806]",
  ready_for_pickup: "bg-[#FAEEDA] text-[#633806]",
  delivered: "bg-[#E1F5EE] text-[#085041]",
  collected: "bg-[#E1F5EE] text-[#085041]",
  cancelled: "bg-[#FCEBEB] text-[#791F1F]",
};

export default function OrderGroup() {
  const { groupId } = useParams();
  const nav = useNavigate();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    setPaying(true);
    try {
      const { data } = await api.post("/payments/init", {
        order_group_id: group.id,
      });
      if (data.simulated) {
        nav(`/payment/success?order_group_id=${group.id}`);
      } else if (data.payment_url) {
        window.location.href = data.payment_url;
      }
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    api
      .get(`/order-groups/${groupId}`)
      .then(({ data }) => setGroup(data))
      .catch((e) => setError(formatApiError(e.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, [groupId]);

  if (loading) {
    return <div className="mobile-shell pt-24 text-center text-gray-500">Chargement…</div>;
  }
  if (error || !group) {
    return (
      <div className="mobile-shell pt-24 px-6 text-center">
        <p className="text-gray-500">{error || "Groupe introuvable."}</p>
        <Link to="/buyer/orders" className="text-[#1D9E75] font-semibold mt-2 inline-block">
          Mes commandes
        </Link>
      </div>
    );
  }

  const currency = group.currency || "FC";

  return (
    <div className="mobile-shell">
      <header className="sticky top-0 z-40 bg-[#085041] text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <Link to="/buyer/orders" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-black text-xl">Récapitulatif</h1>
      </header>

      <div className="px-4 mt-4 space-y-3">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 text-gray-900">
            <Package size={18} className="text-[#1D9E75]" />
            <span className="font-semibold text-sm">
              {group.seller_count} commande{group.seller_count > 1 ? "s" : ""} chez {group.seller_count} vendeur{group.seller_count > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Passée {timeAgo(group.created_at)} · Paiement unique via {group.payment_method}</p>
        </section>

        <section className="bg-[#E1F5EE] border border-[#1D9E75]/30 rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1D9E75] text-white flex items-center justify-center shrink-0">
            <Lock size={18} />
          </div>
          <div className="text-xs text-[#085041]">
            <p className="font-semibold">Paiement réparti en escrow</p>
            <p className="mt-0.5 leading-relaxed">
              Le total de {formatPrice(group.grand_total, currency)} est bloqué. Chaque vendeur est payé séparément à la confirmation de sa propre livraison.
            </p>
          </div>
        </section>

        {!["paid", "captured_in_escrow"].includes(group.payment_status) && (
          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full flex items-center justify-center gap-2 bg-[#1D9E75] hover:bg-[#168260] disabled:opacity-60 text-white rounded-xl py-3.5 font-semibold transition-colors"
          >
            {paying ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CreditCard size={18} />
            )}
            {paying ? "Redirection vers CinetPay…" : `Payer ${formatPrice(group.grand_total, currency)} via CinetPay`}
          </button>
        )}

        <div className="space-y-3">
          {group.orders.map((o) => (
            <Link
              key={o.id}
              to={`/buyer/orders/${o.id}`}
              data-testid={`group-order-${o.id}`}
              className="block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:border-[#1D9E75]/40 transition-colors"
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-[#F1EFE8] border-b border-gray-100">
                <div className="w-6 h-6 rounded-full bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center">
                  <Store size={13} />
                </div>
                <span className="text-sm font-semibold text-gray-900 flex-1 line-clamp-1">{o.seller_name}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] || "bg-gray-100 text-gray-600"}`}>
                  {STATUS_LABELS[o.status] || o.status}
                </span>
              </div>
              <div className="p-3">
                <div className="text-xs text-gray-500 mb-2">
                  {o.items.length} article{o.items.length > 1 ? "s" : ""} · {o.delivery_mode === "delivery" ? "Livraison" : "Retrait"}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-display font-black text-base text-[#085041]">
                    {formatPrice(o.amount_due ?? o.total_amount, currency)}
                  </span>
                  <span className="text-[#1D9E75] flex items-center gap-1 text-sm font-medium">
                    Suivre <ChevronRight size={16} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex justify-between font-display font-black text-lg text-[#085041]">
          <span>Total payé</span>
          <span data-testid="group-total">{formatPrice(group.grand_total, currency)}</span>
        </section>
      </div>

      <BottomNav role="buyer" />
    </div>
  );
}
