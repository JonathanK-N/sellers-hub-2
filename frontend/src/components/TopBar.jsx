import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ShoppingCart, Bell } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import MessagesIndicator from "./MessagesIndicator";

export default function TopBar({ title = "AfriMarket", showCart = true }) {
  const { count } = useCart();
  const { user } = useAuth();
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await api.get("/notifications/unread-count");
        if (!cancelled) setNotifCount(data.count);
      } catch {}
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user]);

  return (
    <header
      data-testid="top-header"
      className="sticky top-0 z-40 bg-[#085041] text-white px-4 py-3 flex justify-between items-center shadow-md"
    >
      <Link to="/buyer/home" className="flex items-center gap-2" data-testid="logo-link">
        <div className="w-8 h-8 rounded-md bg-[#1D9E75] flex items-center justify-center font-black text-white">
          A
        </div>
        <span className="font-display font-black text-lg tracking-tight">{title}</span>
      </Link>
      <div className="flex items-center gap-1">
        <MessagesIndicator />
        <Link
          to="/notifications"
          aria-label="Notifications"
          data-testid="notifications-btn"
          className="relative w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center"
        >
          <Bell size={20} />
          {notifCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#EF9F27] text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 text-white">
              {notifCount}
            </span>
          )}
        </Link>
        {showCart && (
          <Link
            to="/buyer/cart"
            data-testid="cart-icon-link"
            className="relative w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center"
          >
            <ShoppingCart size={20} />
            {count > 0 && (
              <span
                data-testid="cart-badge"
                className="absolute -top-1 -right-1 bg-[#EF9F27] text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
              >
                {count}
              </span>
            )}
          </Link>
        )}
      </div>
    </header>
  );
}
