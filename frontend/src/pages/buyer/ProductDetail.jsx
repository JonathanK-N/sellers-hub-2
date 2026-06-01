import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, MapPin, Star, Truck, Store, Plus, Minus, MessageSquare, Crown } from "lucide-react";
import api from "../../lib/api";
import { formatPrice, formatDistance, photoUrl, timeAgo } from "../../lib/format";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";

export default function ProductDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [p, setP] = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    api.get(`/products/${id}`).then(({ data }) => setP(data));
    api.get(`/products/${id}/reviews`).then(({ data }) => setReviews(data)).catch(() => {});
  }, [id]);

  if (!p) return <div className="mobile-shell flex items-center justify-center text-gray-500 pt-24">Chargement…</div>;

  const photos = p.photos?.length ? p.photos : [null];
  const handleAdd = () => {
    if (user?.role !== "buyer") {
      toast.error("Seuls les acheteurs peuvent commander.");
      return;
    }
    addItem(p, qty);
    toast.success("Ajouté au panier");
  };

  return (
    <div className="mobile-shell">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link to="/buyer/home" className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <span className="font-display font-bold text-sm text-gray-900 truncate flex-1">{p.name}</span>
      </header>

      <div className="bg-gray-100 aspect-square relative">
        {photos[photoIdx] ? (
          <img src={photoUrl(photos[photoIdx])} alt={p.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl font-black text-gray-300 font-display">A</div>
        )}
        {photos.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setPhotoIdx(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === photoIdx ? "bg-white w-6" : "bg-white/50"}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-4 bg-white">
        <h1 className="font-display font-black text-2xl text-gray-900 leading-tight">{p.name}</h1>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display font-black text-2xl text-[#085041]">
            {formatPrice(p.price, p.currency)}
          </span>
          {p.stock > 0 ? (
            <span className="text-xs text-[#1D9E75] font-semibold">En stock ({p.stock})</span>
          ) : (
            <span className="text-xs text-[#E24B4A] font-semibold">Rupture</span>
          )}
        </div>
        <p className="text-sm text-gray-700 mt-3 leading-relaxed whitespace-pre-line">{p.description || "—"}</p>
      </div>

      <div className="px-4 mt-1">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center">
            <Store size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-gray-900 truncate">{p.seller_name}</span>
              {p.seller_verified && <ShieldCheck size={14} className="text-[#1D9E75] shrink-0" />}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
              {p.seller_rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star size={12} className="text-[#EF9F27] fill-[#EF9F27]" />
                  {p.seller_rating.toFixed(1)}
                </span>
              )}
              {p.seller_neighborhood && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {p.seller_neighborhood}
                </span>
              )}
            </div>
          </div>
          {p.distance_km != null && (
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-full">
              {formatDistance(p.distance_km)}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 mt-3 space-y-2">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Livraison</h3>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Truck size={16} className="text-[#1D9E75]" /> Livraison à domicile disponible
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700 mt-1.5">
            <Store size={16} className="text-[#1D9E75]" /> Retrait en boutique (Click & Collect)
          </div>
        </div>

        {user?.role === "buyer" && (
          <button
            data-testid="chat-seller-product-btn"
            onClick={() => nav(`/messages/${user.id}__${p.seller_id}`, { state: { other_name: p.seller_name } })}
            className="w-full bg-white border border-[#1D9E75] text-[#1D9E75] hover:bg-[#E1F5EE] rounded-lg py-2.5 font-semibold flex items-center justify-center gap-2 text-sm"
          >
            <MessageSquare size={16} /> Poser une question au vendeur
          </button>
        )}

        {reviews.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Avis ({reviews.length})</h3>
            <div className="space-y-3">
              {reviews.slice(0, 5).map((r) => (
                <div key={r.id} className="border-b last:border-b-0 border-gray-100 pb-3 last:pb-0">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map((n) => (
                        <Star key={n} size={12} className={n <= r.rating ? "text-[#EF9F27] fill-[#EF9F27]" : "text-gray-200"} />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">{r.buyer_name} · {timeAgo(r.created_at)}</span>
                  </div>
                  {r.comment && <p className="text-sm text-gray-700 mt-1">{r.comment}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {user?.role === "buyer" && p.stock > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 px-4 py-3 pb-5 z-50 flex items-center gap-3 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg">
            <button
              data-testid="qty-decrease"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-9 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50"
            >
              <Minus size={16} />
            </button>
            <span className="w-8 text-center font-semibold text-gray-900">{qty}</span>
            <button
              data-testid="qty-increase"
              onClick={() => setQty((q) => Math.min(p.stock, q + 1))}
              className="w-9 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50"
            >
              <Plus size={16} />
            </button>
          </div>
          <button
            data-testid="add-to-cart-btn"
            onClick={handleAdd}
            className="flex-1 bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold transition-colors"
          >
            Ajouter au panier
          </button>
        </div>
      )}
    </div>
  );
}
