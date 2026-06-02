import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShieldCheck, Phone, Lock } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function AdminLogin() {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const full = phone.trim().startsWith("+") ? phone.trim().replace(/\s/g, "") : `+${phone.trim().replace(/[^0-9]/g, "")}`;
      const { data } = await api.post("/auth/admin/login", { phone: full, password });
      setSession(data.access_token, data.user);
      toast.success("Connexion administrateur réussie");
      nav("/admin/overview");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#085041] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center">
            <ShieldCheck size={28} />
          </div>
          <h1 className="font-display font-black text-2xl text-[#085041] mt-3">Administration</h1>
          <p className="text-sm text-gray-500 mt-1">Accès réservé aux administrateurs AfriMarket.</p>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Numéro administrateur</label>
            <div className="relative mt-1.5">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                data-testid="admin-phone-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+243000000001"
                inputMode="tel"
                className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Mot de passe</label>
            <div className="relative mt-1.5">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                data-testid="admin-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && phone && password && submit()}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none"
              />
            </div>
          </div>
          <button
            data-testid="admin-login-submit"
            disabled={loading || !phone || !password}
            onClick={submit}
            className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </div>
      </div>
    </div>
  );
}
