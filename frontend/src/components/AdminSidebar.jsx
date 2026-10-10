import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Store, Package, ShoppingBag,
  ShieldCheck, UserCheck, AlertTriangle, ShieldAlert, Globe2,
  Bike, Truck, LogOut, Menu, X, Image,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const items = [
  { to: "/admin/overview",               icon: LayoutDashboard, label: "Vue d'ensemble",       testid: "admin-nav-overview" },
  { to: "/admin/users",                  icon: Users,           label: "Utilisateurs",          testid: "admin-nav-users" },
  { to: "/admin/sellers",                icon: Store,           label: "Vendeurs & Boutiques",  testid: "admin-nav-sellers" },
  { to: "/admin/products",               icon: Package,         label: "Produits",              testid: "admin-nav-products" },
  { to: "/admin/orders",                 icon: ShoppingBag,     label: "Commandes",             testid: "admin-nav-orders" },
  { to: "/admin/kyc",                    icon: ShieldCheck,     label: "KYC Vendeurs",          testid: "admin-nav-kyc" },
  { to: "/admin/buyer-kyc",              icon: UserCheck,       label: "KYC Acheteurs",         testid: "admin-nav-buyer-kyc" },
  { to: "/admin/disputes",               icon: AlertTriangle,   label: "Litiges",               testid: "admin-nav-disputes" },
  { to: "/admin/fraud",                  icon: ShieldAlert,     label: "Fraude",                testid: "admin-nav-fraud" },
  { to: "/admin/deliverers",             icon: Bike,            label: "Livreurs",              testid: "admin-nav-deliverers" },
  { to: "/admin/deliverer-applications", icon: Truck,           label: "Candidatures livreurs", testid: "admin-nav-deliverer-applications" },
  { to: "/admin/banners",                icon: Image,           label: "Affiches & Banners",    testid: "admin-nav-banners" },
  { to: "/admin/geo",                    icon: Globe2,          label: "Géographie",            testid: "admin-nav-geo" },
];

function SidebarContent({ onClose }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="flex flex-col h-full bg-afri-secondary text-white px-4 py-6">
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-afri-primary flex items-center justify-center font-black text-white text-lg font-display">A</div>
          <div>
            <div className="font-display font-black text-lg leading-tight">AfriMarket</div>
            <div className="text-xs text-emerald-200/80">Admin</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <NavLink key={it.to} to={it.to} data-testid={it.testid} onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-afri-primary text-white" : "text-emerald-100 hover:bg-white/10"
                }`
              }
            >
              <Icon size={18} />
              <span>{it.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-4 px-3 py-3 border-t border-white/10 text-xs text-emerald-100">
        <div className="font-semibold truncate">{user?.name}</div>
        <div className="opacity-70 truncate">{user?.phone}</div>
        <button onClick={() => { logout(); nav("/auth/login"); }} data-testid="admin-logout-btn"
          className="mt-3 flex items-center gap-2 text-emerald-100 hover:text-white">
          <LogOut size={16} /> Se déconnecter
        </button>
      </div>
    </div>
  );
}

export default function AdminSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Mobile hamburger */}
      <button onClick={() => setOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 bg-afri-secondary text-white rounded-lg flex items-center justify-center shadow-lg">
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-[260px] h-full shadow-2xl">
            <SidebarContent onClose={() => setOpen(false)} />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}

      {/* Desktop fixed */}
      <aside data-testid="admin-sidebar" className="hidden lg:block bg-afri-secondary text-white w-[250px] h-screen fixed top-0 left-0">
        <SidebarContent />
      </aside>
    </>
  );
}
