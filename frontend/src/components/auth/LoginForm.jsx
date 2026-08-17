import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Phone, Lock, Eye, EyeOff } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

/**
 * Formulaire de connexion reutilisable.
 * Utilise tel quel dans la page /auth/login et dans le modal superpose.
 *
 * @param {() => void}        onSuccess  appele apres connexion (fermer le modal)
 * @param {(m:string)=>void}  onSwitch   bascule vers "register" (dans le modal)
 */
export default function LoginForm({ onSuccess, onSwitch }) {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [countries, setCountries] = useState([]);
  const [dial, setDial] = useState("+243");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/countries").then(({ data }) => setCountries(data)).catch(() => {});
  }, []);

  const buildPhone = () => {
    const local = phone.trim().replace(/[^0-9]/g, "").replace(/^0+/, "");
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
      if (onSuccess) onSuccess();
      nav(role === "seller" ? "/seller/dashboard" : role === "deliverer" ? "/livreur" : "/buyer/home");
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (detail === "VERIFY_REQUIRED") {
        toast.message("Vérifiez d'abord votre numéro.");
        if (onSuccess) onSuccess();
        nav(`/auth/verify?phone=${encodeURIComponent(full)}&from=login`);
      } else {
        toast.error(formatApiError(detail));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
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
              className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#f97316] focus:border-transparent outline-none"
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
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && phone && password && submit()}
            placeholder="••••••••"
            className="w-full pl-10 pr-10 py-3 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#f97316] focus:border-transparent outline-none"
          />
          <button
            type="button"
            data-testid="toggle-login-password-visibility"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <Link
          to="/auth/forgot"
          onClick={onSuccess}
          className="text-xs text-[#f97316] font-medium mt-1.5 inline-block"
          data-testid="link-forgot"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      <button
        data-testid="login-submit-btn"
        disabled={loading || !phone || !password}
        onClick={submit}
        className="w-full bg-[#0b0b0d] hover:bg-black text-white rounded-lg py-3 px-4 font-semibold transition-colors disabled:opacity-50"
      >
        {loading ? "Connexion…" : "Se connecter"}
      </button>

      <p className="text-center text-xs text-gray-500 mt-4">
        Pas encore inscrit ?{" "}
        {onSwitch ? (
          <button
            type="button"
            onClick={() => onSwitch("register")}
            className="text-[#f97316] font-semibold"
            data-testid="link-to-register"
          >
            Créer un compte
          </button>
        ) : (
          <Link to="/auth/register" className="text-[#f97316] font-semibold" data-testid="link-to-register">
            Créer un compte
          </Link>
        )}
      </p>
    </div>
  );
}
