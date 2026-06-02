import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Phone, Lock } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [countries, setCountries] = useState([]);
  const [dial, setDial] = useState("+243");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/countries").then(({ data }) => setCountries(data)).catch(() => {});
  }, []);

  const buildPhone = () => {
    let local = phone.trim().replace(/[^0-9]/g, "").replace(/^0+/, "");
    return `${dial}${local}`;
  };

  const submit = async () => {
    const full = buildPhone();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { phone: full, password });
      setSession(data.access_token, data.user);
      const role = data.user.role;
      toast.success("Connecté !");
      nav(role === "seller" ? "/seller/dashboard" : role === "deliverer" ? "/livreur" : "/buyer/home");
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (detail === "VERIFY_REQUIRED") {
        toast.message("Vérifiez d'abord votre numéro.");
        nav(`/auth/verify?phone=${encodeURIComponent(full)}&from=login`);
      } else {
        toast.error(formatApiError(detail));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-shell bg-white">
      <header className="px-5 pt-5 pb-2 flex items-center gap-3">
        <Link to="/" className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-black text-xl text-[#085041]">Connexion</h1>
      </header>

      <div className="px-5 mt-6 space-y-4">
        <p className="text-sm text-gray-600">Connectez-vous avec votre numéro et votre mot de passe.</p>

        <div>
          <label className="text-sm font-medium text-gray-700">Numéro de téléphone</label>
          <div className="mt-1.5 flex gap-2">
            <select
              data-testid="login-dial-select"
              value={dial}
              onChange={(e) => setDial(e.target.value)}
              className="px-3 py-3 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700 min-w-[100px] outline-none"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.dial_code}>{c.flag} {c.dial_code}</option>
              ))}
            </select>
            <div className="relative flex-1">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                data-testid="login-phone-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="812345678"
                inputMode="tel"
                className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Mot de passe</label>
          <div className="relative mt-1.5">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              data-testid="login-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && phone && password && submit()}
              placeholder="••••••••"
              className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none"
            />
          </div>
          <Link to="/auth/forgot" className="text-xs text-[#1D9E75] font-medium mt-1.5 inline-block" data-testid="link-forgot">
            Mot de passe oublié ?
          </Link>
        </div>

        <button
          data-testid="login-submit-btn"
          disabled={loading || !phone || !password}
          onClick={submit}
          className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 px-4 font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>

        <p className="text-center text-xs text-gray-500 mt-4">
          Pas encore inscrit ?{" "}
          <Link to="/auth/register" className="text-[#1D9E75] font-semibold" data-testid="link-to-register">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
