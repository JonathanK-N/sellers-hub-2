import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogOut, User, MapPin, Phone, Store, LayoutDashboard, Camera, ShieldCheck, ChevronRight, Truck } from "lucide-react";
import TopBar from "../../components/TopBar";
import BottomNav from "../../components/BottomNav";
import { useAuth } from "../../context/AuthContext";
import api, { formatApiError } from "../../lib/api";
import { photoUrl } from "../../lib/format";

export default function Profile() {
  const { user, logout, refresh } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  if (!user) return null;

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadPhoto(file);
    e.target.value = "";
  };

  const uploadPhoto = async (file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/auth/me/photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await refresh();
      toast.success("Photo de profil mise à jour");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mobile-shell">
      <TopBar title="Mon profil" showCart={false} />

      <div className="px-4 mt-4 space-y-3">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            data-testid="upload-avatar-btn"
            className="relative w-14 h-14 rounded-full bg-[#1D9E75] text-white flex items-center justify-center font-display font-black text-xl overflow-hidden shrink-0"
          >
            {user.profile_photo_url ? (
              <img src={photoUrl(user.profile_photo_url)} alt="Photo de profil" className="w-full h-full object-cover" />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
            <span className="absolute bottom-0 right-0 w-5 h-5 bg-[#085041] rounded-full flex items-center justify-center border-2 border-white">
              <Camera size={11} className="text-white" />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} data-testid="avatar-file-input" />
          <div className="flex-1">
            <div className="font-display font-bold text-gray-900">{user.name}</div>
            <div className="text-xs text-gray-500">{user.phone}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#E1F5EE] text-[#1D9E75]">
                {user.role === "buyer" ? "Acheteur" : user.role === "seller" ? "Vendeur" : "Admin"}
              </span>
              {user.role === "buyer" && user.buyer_verified && (
                <span data-testid="buyer-verified-badge" className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EF9F27]/15 text-[#BA7517]">
                  <ShieldCheck size={10} /> Vérifié
                </span>
              )}
            </div>
          </div>
        </section>

        {user.role === "buyer" && !user.buyer_verified && (
          <button
            data-testid="goto-buyer-kyc"
            onClick={() => nav("/buyer/kyc")}
            className="w-full bg-white border border-[#1D9E75] rounded-xl shadow-sm p-4 flex items-center gap-3 hover:bg-[#E1F5EE] transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-gray-900">Vérifier mon identité</div>
              <div className="text-xs text-gray-500">Obtenez le badge Vérifié, visible par les vendeurs</div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        )}

        {(user.role === "buyer" || user.role === "seller") && (
          <button
            data-testid="goto-become-deliverer"
            onClick={() => nav("/become-deliverer")}
            className="w-full bg-gradient-to-r from-[#085041] to-[#1D9E75] rounded-xl shadow-sm p-4 flex items-center gap-3 text-white hover:opacity-95 transition-opacity"
          >
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
              <Truck size={18} />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold">Devenir livreur AfriMarket</div>
              <div className="text-xs text-emerald-100">Générez des revenus en livrant des commandes</div>
            </div>
            <ChevronRight size={16} className="text-white/70" />
          </button>
        )}

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
