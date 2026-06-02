import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, User, Phone, ChevronRight, Lock } from "lucide-react";
import api, { formatApiError } from "../../lib/api";

export default function Register() {
  const nav = useNavigate();
  const [countries, setCountries] = useState([]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    role: "buyer",
    country_code: "CD",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/countries").then(({ data }) => setCountries(data)).catch(() => {});
  }, []);

  const current = countries.find((c) => c.code === form.country_code);

  const submit = async () => {
    setLoading(true);
    try {
      // Build the full international number with the country dial code, exactly
      // like the login flow does, so register and login produce the SAME phone.
      const dial = current?.dial_code || "+243";
      let local = form.phone.trim().replace(/[^0-9]/g, "");
      local = local.replace(/^0+/, ""); // drop leading 0 (local trunk prefix)
      const fullPhone = `${dial}${local}`;
      const payload = { ...form, phone: fullPhone };
      const { data } = await api.post("/auth/register", payload);
      toast.success(`Code envoyé. (Demo: ${data.otp_dev})`);
      nav(`/auth/verify?phone=${encodeURIComponent(data.phone)}&from=register`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
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
        <div>
          <h1 className="font-display font-black text-xl text-[#085041]">Créer un compte</h1>
          <p className="text-xs text-gray-500">Étape {step} sur 2</p>
        </div>
      </header>

      <div className="px-5 mt-6">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Nom complet</label>
              <div className="mt-1.5 relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  data-testid="register-name-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Jean Mbo"
                  className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Numéro de téléphone</label>
              <div className="mt-1.5 flex gap-2">
                <span className="px-3 py-3 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700 min-w-[80px] text-center">
                  {current?.dial_code || "+243"}
                </span>
                <div className="relative flex-1">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    data-testid="register-phone-input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="ex: 812345678"
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
                  data-testid="register-password-input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Au moins 6 caractères"
                  className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none"
                />
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
                        ? "border-[#1D9E75] bg-[#E1F5EE] text-[#085041]"
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
              className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 px-4 font-semibold transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
              Suivant <ChevronRight size={18} />
            </button>
            <p className="text-center text-xs text-gray-500 mt-4">
              Déjà un compte ?{" "}
              <Link to="/auth/login" className="text-[#1D9E75] font-semibold" data-testid="link-to-login">
                Se connecter
              </Link>
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
                        ? "border-[#1D9E75] bg-[#E1F5EE]"
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
              <div className="rounded-lg bg-[#E1F5EE] border border-[#1D9E75]/30 p-3 text-xs text-[#085041]">
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
                className="bg-white border border-[#1D9E75] text-[#1D9E75] rounded-lg py-3 px-4 font-semibold hover:bg-[#E1F5EE] transition-colors"
              >
                Retour
              </button>
              <button
                disabled={loading}
                onClick={submit}
                data-testid="register-submit-btn"
                className="bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 px-4 font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? "Envoi…" : "Recevoir le code"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
