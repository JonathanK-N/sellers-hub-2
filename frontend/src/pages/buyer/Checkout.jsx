import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Truck, Store, ShieldCheck, Lock } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { formatPrice } from "../../lib/format";

export default function Checkout() {
  const { items, total, clear } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("delivery");
  const [neighborhood, setNeighborhood] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [pickupSlot, setPickupSlot] = useState("Aujourd'hui 14:00-16:00");
  const [payment, setPayment] = useState("MTN MoMo");
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/countries").then(({ data }) => {
      const c = data.find((c) => c.code === user?.country_code);
      if (c) {
        setOperators(c.mobile_money_operators);
        setPayment(c.mobile_money_operators[0]);
      }
    });
  }, [user?.country_code]);

  if (items.length === 0) {
    return (
      <div className="mobile-shell pt-24 px-6 text-center">
        <p className="text-gray-500">Votre panier est vide.</p>
        <Link to="/buyer/home" className="text-[#1D9E75] font-semibold mt-2 inline-block">
          Découvrir les produits
        </Link>
      </div>
    );
  }

  const submit = async () => {
    if (mode === "delivery" && !neighborhood) {
      toast.error("Indiquez votre quartier");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
        delivery_mode: mode,
        delivery_neighborhood: mode === "delivery" ? neighborhood : null,
        delivery_landmark: mode === "delivery" ? landmark : null,
        delivery_address: mode === "delivery" ? city : null,
        pickup_slot: mode === "collect" ? pickupSlot : null,
        payment_method: payment,
      };
      const { data } = await api.post("/orders", payload);
      clear();
      toast.success("Commande créée. Paiement bloqué en escrow.");
      nav(`/buyer/orders/${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const commission = total * 0.07;

  return (
    <div className="mobile-shell">
      <header className="sticky top-0 z-40 bg-[#085041] text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <Link to="/buyer/cart" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-black text-xl">Paiement</h1>
      </header>

      <div className="px-4 mt-4 space-y-3">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Mode</h3>
          <div className="grid grid-cols-2 gap-2">
            <ModeBtn icon={Truck} label="Livraison" active={mode === "delivery"} onClick={() => setMode("delivery")} testid="mode-delivery" />
            <ModeBtn icon={Store} label="Retrait" active={mode === "collect"} onClick={() => setMode("collect")} testid="mode-collect" />
          </div>
        </section>

        {mode === "delivery" && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Adresse de livraison</h3>
            <Input label="Quartier" value={neighborhood} onChange={setNeighborhood} placeholder="Ex: Gombe, Bonapriso…" testid="checkout-neighborhood-input" />
            <Input label="Repère" value={landmark} onChange={setLandmark} placeholder="Près de l'église, en face de…" testid="checkout-landmark-input" />
            <Input label="Ville (optionnel)" value={city} onChange={setCity} placeholder="Ex: Kinshasa" testid="checkout-city-input" />
          </section>
        )}

        {mode === "collect" && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Créneau de retrait</h3>
            <select
              data-testid="pickup-slot-select"
              value={pickupSlot}
              onChange={(e) => setPickupSlot(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] outline-none"
            >
              <option>Aujourd'hui 14:00-16:00</option>
              <option>Aujourd'hui 16:00-18:00</option>
              <option>Demain 09:00-11:00</option>
              <option>Demain 14:00-16:00</option>
            </select>
          </section>
        )}

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Mobile Money</h3>
          <div className="grid grid-cols-1 gap-2">
            {operators.map((op) => (
              <button
                key={op}
                data-testid={`payment-${op.replace(/\s+/g, "-")}`}
                onClick={() => setPayment(op)}
                className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                  payment === op ? "border-[#1D9E75] bg-[#E1F5EE]" : "border-gray-200 bg-white"
                }`}
              >
                <span className="text-sm font-semibold text-gray-900">{op}</span>
                <span className="text-xs text-gray-500">Mobile Money</span>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-[#E1F5EE] border border-[#1D9E75]/30 rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1D9E75] text-white flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div className="text-xs text-[#085041]">
            <p className="font-semibold">Paiement sécurisé (Escrow)</p>
            <p className="mt-0.5 leading-relaxed">
              {formatPrice(total, items[0]?.currency)} sera bloqué et libéré au vendeur uniquement à la confirmation de réception.
            </p>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-1.5 text-sm">
          <Row label="Sous-total" value={formatPrice(total, items[0]?.currency)} />
          <Row label="Frais plateforme (7%)" value={formatPrice(commission, items[0]?.currency)} muted />
          <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between font-display font-black text-lg text-[#085041]">
            <span>Total</span>
            <span data-testid="checkout-total">{formatPrice(total, items[0]?.currency)}</span>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 px-4 py-3 pb-5 z-50 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
        <button
          data-testid="checkout-pay-btn"
          disabled={loading}
          onClick={submit}
          className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Lock size={16} />
          {loading ? "Traitement…" : `Payer ${formatPrice(total, items[0]?.currency)}`}
        </button>
      </div>
    </div>
  );
}

function ModeBtn({ icon: Icon, label, active, onClick, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`flex flex-col items-center gap-2 py-4 rounded-lg border-2 transition-all ${
        active ? "border-[#1D9E75] bg-[#E1F5EE]" : "border-gray-200 bg-white"
      }`}
    >
      <Icon size={22} className={active ? "text-[#1D9E75]" : "text-gray-500"} />
      <span className={`text-sm font-semibold ${active ? "text-[#085041]" : "text-gray-700"}`}>
        {label}
      </span>
    </button>
  );
}

function Input({ label, value, onChange, placeholder, testid }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700">{label}</label>
      <input
        data-testid={testid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 border border-gray-300 rounded-lg p-3 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none"
      />
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-gray-500" : "text-gray-700"}>{label}</span>
      <span className={muted ? "text-gray-500" : "text-gray-900 font-medium"}>{value}</span>
    </div>
  );
}
