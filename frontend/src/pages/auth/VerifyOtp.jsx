import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function VerifyOtp() {
  const [params] = useSearchParams();
  const phone = params.get("phone") || "";
  const from = params.get("from") || "login";
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(30);

  useEffect(() => {
    const t = setInterval(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const resend = async () => {
    try {
      const { data } = await api.post("/auth/send-otp", { phone });
      const otp_suffix2 = data.otp_dev ? ` (Demo: ${data.otp_dev})` : ''; toast.success(`Nouveau code envoyé.${otp_suffix2}`);
      setResendIn(30);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-otp", { phone, code });
      setSession(data.access_token, data.user);
      toast.success(`Bienvenue, ${data.user.name} !`);
      const role = data.user.role;
      if (role === "admin") nav("/admin/overview");
      else if (role === "seller") {
        // Check seller setup
        try {
          const { data: shop } = await api.get("/seller/me");
          if (!shop) nav("/seller/setup");
          else nav("/seller/dashboard");
        } catch {
          nav("/seller/setup");
        }
      } else nav("/buyer/home");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-shell bg-white">
      <Link
        to={from === "register" ? "/auth/register" : "/auth/login"}
        className="absolute left-4 top-4 w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center z-10"
        data-testid="back-btn"
      >
        <ArrowLeft size={20} />
      </Link>
      <header className="px-6 pt-8 pb-5 flex flex-col items-center text-center border-b border-gray-100">
        <div className="w-12 h-12 rounded-xl bg-afri-secondary text-afri-primary flex items-center justify-center font-black text-xl mb-3">
          A
        </div>
        <h1 className="font-display font-black text-xl text-afri-secondary">Vérification</h1>
        <p className="text-sm text-gray-500 mt-1">Sécurisez votre compte AfriMarket</p>
      </header>

      <div className="px-6 mt-6 space-y-4">
        <p className="text-sm text-gray-600">
          Un code à 6 chiffres a été envoyé au <span className="font-semibold">{phone}</span>.
        </p>

        <input
          data-testid="otp-input"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          maxLength={6}
          inputMode="numeric"
          placeholder="000000"
          className="w-full text-center text-3xl tracking-[1rem] font-display font-bold py-4 rounded-lg border-2 border-gray-200 focus:border-afri-primary focus:ring-2 focus:ring-afri-primary/20 outline-hidden"
        />

        <button
          data-testid="otp-verify-btn"
          disabled={loading || code.length !== 6}
          onClick={submit}
          className="w-full bg-afri-primary var(--afri-primary-hover) text-white rounded-lg py-3 px-4 font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? "Vérification…" : "Vérifier le code"}
        </button>

        <div className="text-center">
          {resendIn > 0 ? (
            <p className="text-xs text-gray-500">Renvoyer le code dans {resendIn}s</p>
          ) : (
            <button
              data-testid="otp-resend-btn"
              onClick={resend}
              className="text-sm text-afri-primary font-semibold hover:underline"
            >
              Renvoyer le code
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
