import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, Store } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { formatPrice, photoUrl } from "../../lib/format";
import BottomNav from "../../components/BottomNav";

export default function Cart() {
  const { items, updateQty, removeItem, total, sellerGroups } = useCart();
  const nav = useNavigate();
  const currency = items[0]?.currency || "FC";
  const multiSeller = sellerGroups.length > 1;

  return (
    <div className="mobile-shell">
      <header className="sticky top-0 z-40 bg-[#085041] text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <Link to="/buyer/home" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-black text-xl">Mon panier</h1>
      </header>

      {items.length === 0 ? (
        <div className="px-6 mt-20 text-center">
          <div className="w-20 h-20 rounded-full bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center mx-auto">
            <ShoppingBag size={32} />
          </div>
          <h2 className="font-display font-bold text-lg text-gray-900 mt-4">Votre panier est vide</h2>
          <p className="text-sm text-gray-500 mt-1">Découvrez les produits près de chez vous.</p>
          <Link
            to="/buyer/home"
            data-testid="empty-cart-shop-btn"
            className="inline-block mt-6 bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 px-6 font-semibold transition-colors"
          >
            Découvrir les produits
          </Link>
        </div>
      ) : (
        <>
          {multiSeller && (
            <div className="px-4 mt-4">
              <div className="bg-[#E6F1FB] border border-[#B5D4F4] rounded-lg px-3 py-2 text-xs text-[#0C447C] flex items-center gap-2">
                <Store size={14} />
                Votre panier contient {sellerGroups.length} vendeurs. Chaque boutique génère une commande distincte, mais vous payez en une seule fois.
              </div>
            </div>
          )}

          <div className="px-4 mt-4 space-y-4 pb-36">
            {sellerGroups.map((group) => (
              <div key={group.seller_id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" data-testid={`cart-seller-${group.seller_id}`}>
                <div className="flex items-center gap-2 px-3 py-2 bg-[#F1EFE8] border-b border-gray-100">
                  <div className="w-6 h-6 rounded-full bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center">
                    <Store size={13} />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 flex-1 line-clamp-1">{group.seller_name}</span>
                  <span className="text-xs text-gray-500">{formatPrice(group.subtotal, currency)}</span>
                </div>
                <div className="p-3 space-y-3">
                  {group.items.map((it) => (
                    <div key={it.id} className="flex gap-3" data-testid={`cart-item-${it.id}`}>
                      <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                        {it.photos?.[0] ? (
                          <img src={photoUrl(it.photos[0])} alt={it.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-black text-gray-300 font-display">A</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{it.name}</h3>
                        <div className="text-sm font-bold text-[#085041] mt-0.5">
                          {formatPrice(it.price, it.currency)}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1 border border-gray-200 rounded-lg">
                            <button
                              data-testid={`cart-decrease-${it.id}`}
                              onClick={() => updateQty(it.id, it.quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-7 text-center text-xs font-semibold">{it.quantity}</span>
                            <button
                              data-testid={`cart-increase-${it.id}`}
                              onClick={() => updateQty(it.id, it.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <button
                            data-testid={`cart-remove-${it.id}`}
                            onClick={() => removeItem(it.id)}
                            className="text-[#E24B4A] hover:bg-red-50 rounded-lg p-1.5"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 px-4 py-3 z-50 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total</span>
              <span className="font-display font-black text-xl text-[#085041]" data-testid="cart-total">
                {formatPrice(total, currency)}
              </span>
            </div>
            <button
              data-testid="cart-checkout-btn"
              onClick={() => nav("/buyer/checkout")}
              className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold transition-colors"
            >
              Passer commande
            </button>
          </div>
        </>
      )}

      <BottomNav role="buyer" />
    </div>
  );
}
