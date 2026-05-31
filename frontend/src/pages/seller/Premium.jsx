import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Crown, Check, Sparkles } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import { formatPrice } from "../../lib/format";
import BottomNav from "../../components/BottomNav";

export default function SellerPremium() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/premium/plan").then(({ data }) => setPlan(data)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const subscribe = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/premium/subscribe", {});
      if (data.payment_url) {
        toast.success("Redirection vers le paiement…");
        window.location.href = data.payment_url;
        return;
      }
      toast.success("Premium activé !");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="mobile-shell pt-24 text-center text-gray-500">Chargement…</div>;
  if (!plan) return <div className="mobile-shell pt-24 text-center text-gray-500">Boutique requise.</div>;

  const expiresLabel = plan.expires_at
    ? new Date(plan.expires_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="mobile-shell pb-24">
      <header className="sticky top-0 z-40 bg-[#085041] text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <Link to="/seller/dashboard" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-black text-xl">Boutique Premium</h1>
      </header>

      <div className="px-4 mt-5">
        <div className="rounded-2xl p-6 text-center" style={{ background: "linear-gradient(135deg, #EF9F27 0%, #BA7517 100%)" }}>
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto">
            <Crown size={32} className="text-white" />
          </div>
          {plan.active ? (
            <>
              <h2 className="font-display font-black text-2xl text-white mt-3">Premium actif</h2>
              <p className="text-white/90 text-sm mt-1">Votre boutique bénéficie de tous les avantages.</p>
              {expiresLabel && (
                <div className="inline-block bg-white/20 rounded-full px-4 py-1.5 mt-3 text-white text-sm font-medium">
                  Valide jusqu'au {expiresLabel}
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="font-display font-black text-2xl text-white mt-3">Passez Premium</h2>
              <div className="text-white mt-2">
                <span className="font-display font-black text-3xl">{formatPrice(plan.price, plan.currency)}</span>
                <span className="text-white/90 text-sm"> / mois</span>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mt-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-[#EF9F27]" /> Vos avantages Premium
          </h3>
          <div className="space-y-2.5">
            {plan.benefits.map((b, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={12} />
                </div>
                <span className="text-sm text-gray-700">{b}</span>
              </div>
            ))}
          </div>
        </div>

        {!plan.active && (
          <p className="text-xs text-gray-400 text-center mt-4 px-4">
            Abonnement mensuel renouvelable. Vous pouvez résilier à tout moment ; vos avantages restent actifs jusqu'à la fin de la période payée.
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 px-4 py-3 pb-5 z-50 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
        <button
          onClick={subscribe}
          disabled={busy}
          data-testid="subscribe-premium-btn"
          className="w-full text-white rounded-lg py-3 font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: "#EF9F27" }}
        >
          <Crown size={18} />
          {busy ? "Traitement…" : plan.active ? `Renouveler — ${formatPrice(plan.price, plan.currency)}` : `S'abonner — ${formatPrice(plan.price, plan.currency)}/mois`}
        </button>
      </div>

      <BottomNav role="seller" />
    </div>
  );
}
