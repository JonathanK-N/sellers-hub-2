import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, User, ShoppingBag, Star, Calendar } from "lucide-react";
import api from "../../lib/api";
import { formatPrice, timeAgo } from "../../lib/format";

export default function BuyerProfile() {
  const { buyerId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Récupère les commandes partagées entre ce vendeur et cet acheteur
    api.get(`/seller/buyer-profile/${buyerId}`)
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [buyerId]);

  if (loading) return <div className="mobile-shell pt-24 text-center text-gray-400">Chargement…</div>;
  if (!data) return <div className="mobile-shell pt-24 text-center text-gray-400">Profil introuvable.</div>;

  const { buyer, orders, total_orders, total_spent } = data;

  return (
    <div className="mobile-shell pb-12">
      <header className="sticky top-0 z-40 bg-[#085041] text-white px-4 py-3 flex items-center gap-3">
        <Link to="/seller/orders" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-black text-xl">Profil acheteur</h1>
      </header>

      <div className="px-4 mt-5">
        {/* Avatar + nom */}
        <div className="flex flex-col items-center text-center py-5">
          <div className="w-20 h-20 rounded-full bg-[#E1F5EE] flex items-center justify-center mb-3">
            <User size={36} className="text-[#085041]" />
          </div>
          <h2 className="font-display font-black text-xl text-gray-900">{buyer.name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">Client depuis {timeAgo(buyer.created_at)}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="text-2xl font-black text-[#085041]">{total_orders}</div>
            <div className="text-xs text-gray-500 mt-0.5">commande{total_orders > 1 ? "s" : ""} avec vous</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="text-2xl font-black text-[#085041]">{formatPrice(total_spent, "FC")}</div>
            <div className="text-xs text-gray-500 mt-0.5">total dépensé</div>
          </div>
        </div>

        {/* Historique commandes */}
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <ShoppingBag size={16} className="text-[#1D9E75]" /> Historique des commandes
        </h3>
        {orders.length === 0
          ? <p className="text-sm text-gray-400 text-center py-6">Aucune commande pour l'instant.</p>
          : (
            <div className="space-y-3">
              {orders.map(o => (
                <Link key={o.id} to={`/seller/orders/${o.id}`} className="block bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {o.items?.map(i => i.name).join(", ")}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <Calendar size={11} /> {timeAgo(o.created_at)}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-bold text-[#085041]">{formatPrice(o.total_amount, "FC")}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        o.status === "delivered" ? "bg-green-100 text-green-700" :
                        o.status === "confirmed" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{o.status}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
