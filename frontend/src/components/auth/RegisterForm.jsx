import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { User, Phone, ChevronRight, Lock, Eye, EyeOff } from "lucide-react";
import api, { formatApiError } from "../../lib/api";

/**
 * Formulaire d'inscription reutilisable (2 etapes).
 * Utilise tel quel dans la page /auth/register et dans le modal superpose.
 *
 * @param {() => void}        onSuccess  appele avant redirection (fermer le modal)
 * @param {(m:string)=>void}  onSwitch   bascule vers "login" (dans le modal)
 * @param {(s:number)=>void}  onStep     remonte l'etape courante au parent (titre du modal)
 */
export default function RegisterForm({ onSuccess, onSwitch, onStep }) {
  const nav = useNavigate();
  const [countries, setCountries] = useState([]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    role: new URLSearchParams(window.location.search).get("role") === "seller" ? "seller" : "buyer",
    country_code: "CD",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    api.get("/countries").then(({ data }) => setCountries(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (onStep) onStep(step);
  }, [step, onStep]);

  const current = countries.find((c) => c.code === form.country_code);

  const submit = async () => {
    setLoading(true);
    try {
      const dial = current?.dial_code || "+243";
      let local = form.phone.trim().replace(/[^0-9]/g, "");
      local = local.replace(/^0+/, "");
      const fullPhone = `${dial}${local}`;
      const payload = { ...form, phone: fullPhone };
      const { data } = await api.post("/auth/register", payload);
      const otp_suffix = data.otp_dev ? ` (Demo: ${data.otp_dev})` : "";
      toast.success(`Code envoyé.${otp_suffix}`);
      if (onSuccess) onSuccess();
      nav(`/auth/verify?phone=${encodeURIComponent(data.phone)}&from=register`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Nom complet</label>
            <div className="relative mt-1.5">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                data-testid="register-name-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Jean Mbo"
                className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-afri-primary focus:border-transparent outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Numéro de téléphone</label>
            <div className="mt-1.5 flex gap-2">
              <div className="px-3 py-3 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700 min-w-[70px] text-center">
                {current?.dial_code || "+243"}
              </div>
              <div className="relative flex-1">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  data-testid="register-phone-input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="ex: 812345678"
                  inputMode="tel"
                  className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-afri-primary focus:border-transparent outline-hidden"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Mot de passe</label>
            <div className="relative mt-1.5">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                data-testid="register-password-input"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Au moins 6 caractères"
                className="w-full pl-10 pr-10 py-3 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-afri-primary focus:border-transparent outline-hidden"
              />
              <button
                type="button"
                data-testid="toggle-register-password-visibility"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Je suis</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {["buyer", "seller", "deliverer"].map((r) => (
                <button
                  type="button"
                  key={r}
                  data-testid={`register-role-${r}`}
                  onClick={() => setForm({ ...form, role: r })}
                  className={`py-3 px-2 rounded-lg font-semibold text-sm border-2 transition-all ${
                    form.role === r
                      ? "border-afri-primary bg-afri-soft text-gray-900"
                      : "border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  {r === "buyer" ? "Acheter" : r === "seller" ? "Vendre" : "Livrer"}
                </button>
              ))}
            </div>
          </div>

          <button
            data-testid="register-step-next"
            disabled={!form.name || !form.phone || form.password.length < 6}
            onClick={() => setStep(2)}
            className="w-full bg-afri-primary var(--afri-primary-hover) text-white rounded-lg py-3 px-4 font-semibold transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
          >
            Suivant <ChevronRight size={18} />
          </button>
          <p className="text-center text-xs text-gray-500 mt-4">
            Déjà un compte ?{" "}
            {onSwitch ? (
              <button
                type="button"
                onClick={() => onSwitch("login")}
                className="text-afri-primary font-semibold"
                data-testid="link-to-login"
              >
                Se connecter
              </button>
            ) : (
              <Link to="/auth/login" className="text-afri-primary font-semibold" data-testid="link-to-login">
                Se connecter
              </Link>
            )}
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Pays</label>
            <div className="mt-1.5 grid grid-cols-1 gap-2">
              {countries.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  data-testid={`country-option-${c.code}`}
                  onClick={() => setForm({ ...form, country_code: c.code })}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                    form.country_code === c.code
                      ? "border-afri-primary bg-afri-soft"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <span className="text-2xl">{c.flag}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-sm">{c.name}</div>
                    <div className="text-xs text-gray-500">
                      {c.dial_code} · Devise : {c.currency_symbol}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {current && (
            <div className="rounded-lg bg-afri-soft border border-afri-primary/20 p-3 text-xs text-gray-800">
              <div className="font-semibold mb-1">Profil configuré :</div>
              <div>📍 Pays : {current.name}</div>
              <div>💰 Devise : {current.currency_symbol}</div>
              <div>📱 Paiements : {current.mobile_money_operators.join(", ")}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setStep(1)}
              data-testid="register-step-back"
              className="bg-white border border-gray-300 text-gray-700 rounded-lg py-3 px-4 font-semibold hover:bg-gray-50 transition-colors"
            >
              Retour
            </button>
            <button
              disabled={loading}
              onClick={submit}
              data-testid="register-submit-btn"
              className="bg-afri-primary var(--afri-primary-hover) text-white rounded-lg py-3 px-4 font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? "Envoi…" : "Recevoir le code"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
