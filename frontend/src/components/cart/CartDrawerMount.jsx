import { useCart } from "../../context/CartContext";
import CartDrawer from "./CartDrawer";

/**
 * Monte le tiroir panier a l'interieur du Router (le tiroir utilise useNavigate).
 * L'etat d'ouverture vient de CartContext, qui lui est monte plus haut.
 */
export default function CartDrawerMount() {
  const { cartOpen, closeCart } = useCart();
  if (!cartOpen) return null;
  return <CartDrawer onClose={closeCart} />;
}
