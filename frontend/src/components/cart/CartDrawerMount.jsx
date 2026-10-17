import { lazy, Suspense } from "react";
import { useCart } from "../../context/CartContext";
const CartDrawer = lazy(() => import("./CartDrawer"));

/**
 * Monte le tiroir panier a l'interieur du Router (le tiroir utilise useNavigate).
 * L'etat d'ouverture vient de CartContext, qui lui est monte plus haut.
 */
export default function CartDrawerMount() {
  const { cartOpen, closeCart } = useCart();
  if (!cartOpen) return null;
  return <Suspense fallback={<div role="status" className="fixed right-0 top-0 z-50 bg-white p-4">Ouverture du panier…</div>}><CartDrawer onClose={closeCart} /></Suspense>;
}
