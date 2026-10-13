import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/public_api";

const CartContext = createContext(null);
const STORAGE_KEY = "afri_cart";
const CURRENCY_KEY = "afri_checkout_currency";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Devise choisie par l'acheteur pour payer : "FC" | "USD"
  const [checkoutCurrency, setCheckoutCurrencyState] = useState(
    () => localStorage.getItem(CURRENCY_KEY) || "FC",
  );

  // Taux live depuis le backend (rafraîchi à l'ouverture du panier)
  const [fxRate, setFxRate] = useState(null);

  // Ouverture du tiroir panier lateral. L'etat vit ici, mais le rendu se fait
  // dans <CartDrawerMount /> a l'interieur du Router (le tiroir navigue).
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    // Fetch du taux une seule fois au montage
    api
      .get("/fx/rate")
      .then(({ data }) => setFxRate(data.rate))
      .catch(() => {});
  }, []);

  const setCheckoutCurrency = (c) => {
    setCheckoutCurrencyState(c);
    localStorage.setItem(CURRENCY_KEY, c);
  };

  const addItem = (product, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + qty } : i,
        );
      }
      return [...prev, { ...product, quantity: qty }];
    });
  };

  const updateQty = (id, qty) =>
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, qty) } : i)),
    );
  const removeItem = (id) =>
    setItems((prev) => prev.filter((i) => i.id !== id));
  const clear = () => setItems([]);

  // Prix effectif en FC pour chaque article (source of truth pour calculs internes)
  const effectivePriceFC = (item) =>
    item.currency === "USD" && item.price_fc ? item.price_fc : item.price;

  // Total en FC (base de calcul)
  const totalFC = items.reduce(
    (sum, i) => sum + effectivePriceFC(i) * i.quantity,
    0,
  );

  // Total en USD (division par taux live ou taux stocké)
  const totalUSD =
    fxRate && fxRate > 0
      ? totalFC / fxRate
      : items.reduce((sum, i) => {
          // fallback : utiliser price USD direct si disponible, sinon estimer
          const priceUSD =
            i.currency === "USD"
              ? i.price
              : i.price_fc
                ? i.price
                : i.price / 2800;
          return sum + priceUSD * i.quantity;
        }, 0);

  // total exposé = selon la devise choisie
  const total = checkoutCurrency === "USD" ? totalUSD : totalFC;
  const totalCurrency = checkoutCurrency;

  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  const groupedBySeller = items.reduce((acc, i) => {
    const key = i.seller_id;
    if (!acc[key]) {
      acc[key] = {
        seller_id: i.seller_id,
        seller_name: i.seller_name || "Boutique",
        items: [],
        subtotal: 0,
      };
    }
    acc[key].items.push(i);
    acc[key].subtotal += effectivePriceFC(i) * i.quantity;
    return acc;
  }, {});
  const sellerGroups = Object.values(groupedBySeller);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQty,
        removeItem,
        clear,
        total,
        totalFC,
        totalUSD,
        totalCurrency,
        count,
        sellerGroups,
        checkoutCurrency,
        setCheckoutCurrency,
        fxRate,
        cartOpen,
        openCart: () => setCartOpen(true),
        closeCart: () => setCartOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
