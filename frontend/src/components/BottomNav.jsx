import { NavLink } from "react-router-dom";
import { Home, Search, ShoppingCart, Package, User } from "lucide-react";
import { useCart } from "../context/CartContext";

const buyerItems = [
  { to: "/buyer/home", icon: Home, label: "Accueil", testid: "bottom-nav-home" },
  { to: "/buyer/search", icon: Search, label: "Recherche", testid: "bottom-nav-search" },
  { to: "/buyer/cart", icon: ShoppingCart, label: "Panier", testid: "bottom-nav-cart" },
  { to: "/buyer/orders", icon: Package, label: "Commandes", testid: "bottom-nav-orders" },
  { to: "/buyer/profile", icon: User, label: "Profil", testid: "bottom-nav-profile" },
];

const sellerItems = [
  { to: "/seller/dashboard", icon: Home, label: "Tableau", testid: "bottom-nav-dashboard" },
  { to: "/seller/products", icon: Package, label: "Produits", testid: "bottom-nav-products" },
  { to: "/seller/orders", icon: ShoppingCart, label: "Commandes", testid: "bottom-nav-seller-orders" },
  { to: "/buyer/profile", icon: User, label: "Profil", testid: "bottom-nav-profile" },
];

export default function BottomNav({ role = "buyer" }) {
  const items = role === "seller" ? sellerItems : buyerItems;
  const { count } = useCart();

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 flex justify-around items-center h-16 px-2 z-50 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            data-testid={item.testid}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs transition-colors relative ${
                isActive ? "text-[#1D9E75] font-semibold" : "text-gray-500"
              }`
            }
          >
            <Icon size={22} />
            <span>{item.label}</span>
            {item.label === "Panier" && count > 0 && (
              <span className="absolute top-1 right-1/4 bg-[#EF9F27] text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                {count}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
