import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { formatPrice, photoUrl } from "../../lib/format";

/**
 * Tiroir panier lateral (facon casakonnect) : glisse depuis la droite,
 * fermeture par croix / clic exterieur / Echap.
 */
export default function CartDrawer({ onClose }) {
  const nav = useNavigate();
  const {
    items, updateQty, removeItem, count,
    totalFC, totalUSD, checkoutCurrency,
  } = useCart();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const go = (path) => { onClose(); nav(path); };

  const effectiveFC = (i) => (i.currency === "USD" && i.price_fc ? i.price_fc : i.price);

  return (
    <div
      className="fixed inset-0 z-[100] afri-fade"
      role="dialog"
      aria-modal="true"
      aria-label="Panier"
      data-testid="cart-drawer"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        data-testid="cart-drawer-backdrop"
      />

      <aside className="absolute right-0 top-0 h-full w-full sm:max-w-md bg-white shadow-2xl flex flex-col afri-slide-in">
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-display font-bold text-base text-gray-900 flex items-center gap-2">
            <ShoppingCart size={18} />
            Mon panier ({count})
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le panier"
            data-testid="cart-drawer-close"
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
            <ShoppingCart size={56} className="text-gray-200" strokeWidth={1.5} />
            <p className="font-semibold text-gray-900">Votre panier est vide</p>
            <p className="text-sm text-gray-500">Ajoutez des produits pour commencer</p>
            <button
              type="button"
              onClick={() => go("/buyer/search")}
              data-testid="cart-drawer-browse"
              className="mt-2 bg-afri-primary hover:bg-afri-primary-hover text-white rounded-full py-2.5 px-6 font-semibold transition-colors"
            >
              Parcourir les produits
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {items.map((i) => (
                <div
                  key={i.id}
                  data-testid={`cart-drawer-item-${i.id}`}
                  className="flex gap-3 items-center border border-gray-100 rounded-xl p-2.5"
                >
                  <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                    {i.photos?.[0] ? (
                      <img src={photoUrl(i.photos[0])} alt={i.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 font-black">A</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">{i.name}</p>
                    <p className="text-xs text-gray-500 line-clamp-1">{i.seller_name || "Boutique"}</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">
                      {formatPrice(effectiveFC(i) * i.quantity, "FC")}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => removeItem(i.id)}
                      aria-label={`Retirer ${i.name}`}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                    <div className="flex items-center border border-gray-200 rounded-lg">
                      <button
                        type="button"
                        onClick={() => updateQty(i.id, i.quantity - 1)}
                        aria-label="Diminuer"
                        className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{i.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(i.id, i.quantity + 1)}
                        aria-label="Augmenter"
                        className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <footer className="border-t border-gray-100 px-5 py-4 shrink-0 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-500">Total</span>
                <span className="font-display font-black text-xl text-gray-900" data-testid="cart-drawer-total">
                  {checkoutCurrency === "USD" ? formatPrice(totalUSD, "USD") : formatPrice(totalFC, "FC")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => go("/buyer/cart")}
                data-testid="cart-drawer-checkout"
                className="w-full bg-afri-primary hover:bg-afri-primary-hover text-white rounded-full py-3 font-semibold transition-colors"
              >
                Voir le panier et commander
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
