import { useNavigate } from "react-router-dom";
import { LogOut, User, MapPin, Phone, Store, LayoutDashboard } from "lucide-react";
import TopBar from "../../components/TopBar";
import BottomNav from "../../components/BottomNav";
import { useAuth } from "../../context/AuthContext";

export default function Profile() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user) return null;

  return (
    <div className="mobile-shell">
      <TopBar title="Mon profil" showCart={false} />

      <div className="px-4 mt-4 space-y-3">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[#1D9E75] text-white flex items-center justify-center font-display font-black text-xl">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-gray-900">{user.name}</div>
            <div className="text-xs text-gray-500">{user.phone}</div>
            <span className="inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#E1F5EE] text-[#1D9E75]">
              {user.role === "buyer" ? "Acheteur" : user.role === "seller" ? "Vendeur" : "Admin"}
            </span>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          <Row icon={MapPin} label="Pays" value={user.country_code} />
          <Row icon={Phone} label="Téléphone" value={user.phone} />
          <Row icon={User} label="Niveau KYC" value={`Niveau ${user.kyc_level}`} />
        </section>

        {user.role === "seller" && (
          <button
            data-testid="goto-seller-dashboard"
            onClick={() => nav("/seller/dashboard")}
            className="w-full bg-[#085041] text-white rounded-lg py-3 px-4 font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Store size={18} /> Mon espace vendeur
          </button>
        )}
        {user.role === "admin" && (
          <button
            data-testid="goto-admin-dashboard"
            onClick={() => nav("/admin/overview")}
            className="w-full bg-[#085041] text-white rounded-lg py-3 px-4 font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <LayoutDashboard size={18} /> Espace administrateur
          </button>
        )}

        <button
          data-testid="logout-btn"
          onClick={() => { logout(); nav("/"); }}
          className="w-full bg-white border border-[#E24B4A] text-[#E24B4A] rounded-lg py-3 px-4 font-semibold transition-colors flex items-center justify-center gap-2 hover:bg-red-50"
        >
          <LogOut size={18} /> Se déconnecter
        </button>
      </div>

      <BottomNav role={user.role === "seller" ? "seller" : "buyer"} />
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <Icon size={18} className="text-gray-400" />
      <div className="flex-1">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-semibold text-gray-900">{value}</div>
      </div>
    </div>
  );
}
