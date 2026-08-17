import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Phone, Lock, KeyRound } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function ForgotPassword() {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [countries, setCountries] = useState([]);
  const [dial, setDial] = useState("+243");
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState("request"); // request | reset
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/countries").then(({ data }) => setCountries(data)).catch(() => {});
  }, []);

  const fullPhone = () => `${dial}${phone.trim().replace(/[^0-9]/g, "").replace(/^0+/, "")}`;

  const requestCode = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/send-otp", { phone: fullPhone() });
      const otp_suffix = data.otp_dev ? ` (Demo: ${data.otp_dev})` : ''; toast.success(`Code envoyé.${otp_suffix}`);
      setStage("reset");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const doReset = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password", { phone: fullPhone(), code, new_password: newPassword });
      setSession(data.access_token, data.user);
      toast.success("Mot de passe réinitialisé !");
      const role = data.user.role;
      nav(role === "seller" ? "/seller/dashboard" : role === "deliverer" ? "/livreur" : "/buyer/home");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-shell bg-white">
      <Link to="/auth/login" className="absolute left-4 top-4 w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center z-10" data-testid="back-btn">
        <ArrowLeft size={20} />
      </Link>
      <header className="px-6 pt-8 pb-5 flex flex-col items-center text-center border-b border-gray-100">
        <div className="w-12 h-12 rounded-xl bg-[#0b0b0d] text-[#f97316] flex items-center justify-center font-black text-xl mb-3">
          A
        </div>
        <h1 className="font-display font-black text-xl text-gray-900">Mot de passe oublié</h1>
        <p className="text-sm text-gray-500 mt-1">Réinitialisez votre accès AfriMarket</p>
      </header>

      <div className="px-6 mt-6 space-y-4">
        {stage === "request" ? (
          <>
            <p className="text-sm text-gray-600">Entrez votre numéro pour recevoir un code de réinitialisation.</p>
            <div className="flex gap-2">
              <select value={dial} onChange={(e) => setDial(e.target.value)} className="px-3 py-3 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700 min-w-[100px] outline-none">
                {countries.map((c) => <option key={c.code} value={c.dial_code}>{c.flag} {c.dial_code}</option>)}
              </select>
              <div className="relative flex-1">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input data-testid="forgot-phone-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="812345678" inputMode="tel" className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#f97316] outline-none" />
              </div>
            </div>
            <button disabled={loading || !phone} onClick={requestCode} className="w-full bg-[#0b0b0d] hover:bg-black text-white rounded-lg py-3 font-semibold disabled:opacity-50">
              {loading ? "Envoi…" : "Recevoir le code"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">Entrez le code reçu et votre nouveau mot de passe.</p>
            <div className="relative">
              <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input data-testid="forgot-code-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code à 6 chiffres" inputMode="numeric" maxLength={6} className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 text-sm tracking-widest focus:ring-2 focus:ring-[#f97316] outline-none" />
            </div>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input data-testid="forgot-newpass-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nouveau mot de passe (6+ caractères)" className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#f97316] outline-none" />
            </div>
            <button disabled={loading || code.length !== 6 || newPassword.length < 6} onClick={doReset} className="w-full bg-[#0b0b0d] hover:bg-black text-white rounded-lg py-3 font-semibold disabled:opacity-50">
              {loading ? "…" : "Réinitialiser"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
