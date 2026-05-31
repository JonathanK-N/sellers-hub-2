import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import TopBar from "../../components/TopBar";
import BottomNav from "../../components/BottomNav";
import { formatPrice, timeAgo } from "../../lib/format";

export default function SellerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/orders/my").then(({ data }) => setOrders(data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="mobile-shell">
      <TopBar title="Commandes reçues" showCart={false} />

      <div className="px-4 mt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            Aucune commande reçue.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Link
                key={o.id}
                to={`/buyer/orders/${o.id}`}
                data-testid={`seller-order-${o.id}`}
                className="block bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-[#1D9E75] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    {o.status}
                  </span>
                  <span className="text-xs text-gray-500">{timeAgo(o.created_at)}</span>
                </div>
                <div className="mt-2 font-semibold text-sm text-gray-900 line-clamp-1">
                  {o.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">{o.delivery_mode === "delivery" ? "Livraison" : "Retrait"}</span>
                  <span className="font-display font-bold text-[#085041]">
                    {formatPrice(o.total_amount, o.currency)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <BottomNav role="seller" />
    </div>
  );
}
