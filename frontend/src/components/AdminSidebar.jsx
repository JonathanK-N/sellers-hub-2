import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  ShoppingBag,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const items = [
  { to: "/admin/overview", icon: LayoutDashboard, label: "Vue d'ensemble", testid: "admin-nav-overview" },
  { to: "/admin/users", icon: Users, label: "Utilisateurs", testid: "admin-nav-users" },
  { to: "/admin/sellers", icon: Store, label: "Vendeurs", testid: "admin-nav-sellers" },
  { to: "/admin/orders", icon: ShoppingBag, label: "Commandes", testid: "admin-nav-orders" },
  { to: "/admin/kyc", icon: ShieldCheck, label: "KYC", testid: "admin-nav-kyc" },
];

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const handleLogout = () => {
    logout();
    nav("/auth/login");
  };

  return (
    <aside
      data-testid="admin-sidebar"
      className="hidden lg:flex bg-[#085041] text-white w-[250px] flex-col h-screen fixed top-0 left-0 px-4 py-6"
    >
      <div className="flex items-center gap-2 mb-8 px-2">
        <div className="w-10 h-10 rounded-lg bg-[#1D9E75] flex items-center justify-center font-black text-white text-lg font-display">
          A
        </div>
        <div>
          <div className="font-display font-black text-lg leading-tight">AfriMarket</div>
          <div className="text-xs text-emerald-200/80">Admin</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              data-testid={it.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#1D9E75] text-white"
                    : "text-emerald-100 hover:bg-white/10"
                }`
              }
            >
              <Icon size={18} />
              <span>{it.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-4 px-3 py-2 border-t border-white/10 text-xs text-emerald-100">
        <div className="font-semibold truncate">{user?.name}</div>
        <div className="opacity-70 truncate">{user?.phone}</div>
        <button
          onClick={handleLogout}
          data-testid="admin-logout-btn"
          className="mt-3 flex items-center gap-2 text-emerald-100 hover:text-white"
        >
          <LogOut size={16} /> Se déconnecter
        </button>
      </div>
    </aside>
  );
}
