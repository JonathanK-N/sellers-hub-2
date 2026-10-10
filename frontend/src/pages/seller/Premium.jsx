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
      <header className="sticky top-0 z-40 bg-afri-secondary text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <Link to="/seller/dashboard" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-black text-xl">Boutique Premium</h1>
      </header>

      <div className="px-4 mt-5">
        <div className="rounded-2xl p-6 text-center" style={{ background: "linear-gradient(135deg, var(--afri-accent) 0%, #BA7517 100%)" }}>
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
            <Sparkles size={16} className="text-afri-accent" /> Vos avantages Premium
          </h3>
          <div className="space-y-2.5">
            {plan.benefits.map((b, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-afri-soft text-afri-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={12} />
                </div>
                <span className="text-sm text-gray-700">{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bloc paiement désactivé — CinetPay Mobile Money en cours d'intégration */}
        {!plan.active && (
          <div className="mt-5 rounded-2xl overflow-hidden border border-afri-accent/30 shadow-sm">
            {/* Image d'ambiance */}
            <div className="relative h-36 bg-gradient-to-br from-afri-accent/20 to-[#BA7517]/10 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <Crown size={100} className="text-afri-accent" />
              </div>
              <div className="relative text-center px-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-afri-accent animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-afri-accent animate-pulse" style={{ animationDelay: "0.2s" }} />
                  <div className="w-2 h-2 rounded-full bg-afri-accent animate-pulse" style={{ animationDelay: "0.4s" }} />
                </div>
                <p className="font-display font-black text-lg text-[#BA7517]">Disponible très prochainement</p>
                <p className="text-xs text-[#BA7517]/70 mt-1">Le paiement Mobile Money arrive bientôt sur AfriMarket</p>
              </div>
            </div>

            {/* Info paiement */}
            <div className="bg-[#FFFBF0] px-4 py-4">
              <p className="text-xs text-center text-gray-600 leading-relaxed">
                Le paiement Premium via{" "}
                <span className="font-semibold text-[#BA7517]">MTN MoMo, Airtel Money et Orange Money</span>{" "}
                sera disponible très prochainement.
              </p>
              <p className="text-xs text-center text-gray-400 mt-2">
                Vous serez notifié dès que cette fonctionnalité sera activée.
              </p>
            </div>
          </div>
        )}
      </div>

      <BottomNav role="seller" />
    </div>
  );
}
