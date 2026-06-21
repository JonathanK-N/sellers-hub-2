import { useEffect, useMemo, useState } from "react";
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
  const [sellerInfo, setSellerInfo] = useState({}); // { seller_id: { delivery_service, self_delivery_fee } }

  // Quels modes sont disponibles compte tenu de TOUS les produits du panier.
  // Un mode est "disponible" si au moins un produit du panier le supporte.
  const availableModes = useMemo(() => {
    const allModes = new Set();
    items.forEach((it) => {
      const modes = it.delivery_modes?.length ? it.delivery_modes : ["delivery", "collect"];
      modes.forEach((m) => allModes.add(m));
    });
    return allModes;
  }, [items]);

  const deliveryAvailable = availableModes.has("delivery");
  const collectAvailable = availableModes.has("collect");

  useEffect(() => {
    // Si le mode actuellement sélectionné n'est plus disponible, basculer automatiquement.
    if (mode === "delivery" && !deliveryAvailable && collectAvailable) setMode("collect");
    if (mode === "collect" && !collectAvailable && deliveryAvailable) setMode("delivery");
  }, [deliveryAvailable, collectAvailable]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get("/countries").then(({ data }) => {
      const c = data.find((c) => c.code === user?.country_code);
      if (c) {
        setOperators(c.mobile_money_operators);
        setPayment(c.mobile_money_operators[0]);
      }
    });
  }, [user?.country_code]);

  // Charger les infos de livraison (delivery_service + self_delivery_fee) de chaque vendeur du panier
  useEffect(() => {
    const sellerIds = [...new Set(items.map((i) => i.seller_id).filter(Boolean))];
    if (sellerIds.length === 0) return;
    Promise.all(
      sellerIds.map((sid) =>
        api.get(`/seller/public/${sid}`).then(({ data }) => [sid, data.seller]).catch(() => [sid, null])
      )
    ).then((pairs) => {
      const map = {};
      pairs.forEach(([sid, seller]) => {
        if (seller) {
          map[sid] = {
            delivery_service: seller.delivery_service || "self",
            self_delivery_fee: seller.self_delivery_fee || 7500,
          };
        }
      });
      setSellerInfo(map);
    });
  }, [items]);

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
      const groupId = data.order_group_id;
      const n = data.seller_count || (data.orders ? data.orders.length : 1);

      let paymentUrl = null;
      try {
        const initRes = await api.post("/payments/init", { order_group_id: groupId });
        paymentUrl = initRes.data?.payment_url || null;
      } catch {
        // sandbox fallback
      }

      clear();

      if (paymentUrl) {
        toast.success("Redirection vers le paiement sécurisé…");
        window.location.href = paymentUrl;
        return;
      }

      if (n > 1) {
        toast.success(`${n} commande${n > 1 ? "s" : ""} créée${n > 1 ? "s" : ""}. Paiement unique bloqué en escrow.`);
        nav(`/buyer/order-group/${groupId}`);
      } else {
        toast.success("Commande créée. Paiement bloqué en escrow.");
        nav(`/buyer/orders/${data.orders[0].id}`);
      }
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  // Calcul des frais de livraison: somme par vendeur distinct dont au moins un
  // produit (compatible avec le mode choisi) sera livré. Reflete au plus pres
  // ce que le backend va facturer (un frais par sous-commande "delivery").
  const deliveryFee = useMemo(() => {
    if (mode !== "delivery") return 0;
    const sellersToCharge = new Set();
    items.forEach((it) => {
      const modes = it.delivery_modes?.length ? it.delivery_modes : ["delivery", "collect"];
      if (modes.includes("delivery")) sellersToCharge.add(it.seller_id);
    });
    let fee = 0;
    sellersToCharge.forEach((sid) => {
      const info = sellerInfo[sid];
      if (!info) return;
      fee += info.delivery_service === "afrimarket" ? 16000 : (info.self_delivery_fee || 7500);
    });
    return fee;
  }, [mode, items, sellerInfo]);

  const payableTotal = total + deliveryFee;

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
            <ModeBtn icon={Truck} label="Livraison" active={mode === "delivery"} disabled={!deliveryAvailable} onClick={() => deliveryAvailable && setMode("delivery")} testid="mode-delivery" />
            <ModeBtn icon={Store} label="Retrait" active={mode === "collect"} disabled={!collectAvailable} onClick={() => collectAvailable && setMode("collect")} testid="mode-collect" />
          </div>
          {!deliveryAvailable && (
            <p className="text-xs text-gray-500 mt-2 text-center">Un ou plusieurs produits de votre panier ne sont disponibles qu'au retrait en boutique.</p>
          )}
          {!collectAvailable && (
            <p className="text-xs text-gray-500 mt-2 text-center">Un ou plusieurs produits de votre panier ne sont disponibles qu'en livraison.</p>
          )}
          {items.some((it) => {
            const modes = it.delivery_modes?.length ? it.delivery_modes : ["delivery", "collect"];
            return !modes.includes(mode);
          }) && (
            <p className="text-xs text-[#BA7517] bg-[#FEF3E2] rounded-lg px-3 py-2 mt-2">
              Certains articles ne supportent pas ce mode et seront regroupés dans une commande séparée automatiquement.
            </p>
          )}
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
              {formatPrice(payableTotal, items[0]?.currency)} sera bloqué et libéré au vendeur uniquement à la confirmation de réception.
            </p>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-1.5 text-sm">
          <Row label="Sous-total" value={formatPrice(total, items[0]?.currency)} />
          {mode === "delivery" && deliveryFee > 0 && (
            <Row label="Frais de livraison" value={formatPrice(deliveryFee, items[0]?.currency)} muted />
          )}
          <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between font-display font-black text-lg text-[#085041]">
            <span>Total</span>
            <span data-testid="checkout-total">{formatPrice(payableTotal, items[0]?.currency)}</span>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 px-4 py-3 pb-5 z-50 flex items-center gap-3 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
        <button
          data-testid="checkout-pay-btn"
          disabled={loading}
          onClick={submit}
          className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Lock size={16} />
          {loading ? "Traitement…" : `Payer ${formatPrice(payableTotal, items[0]?.currency)}`}
        </button>
      </div>
    </div>
  );
}

function ModeBtn({ icon: Icon, label, active, disabled, onClick, testid }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      className={`flex flex-col items-center gap-2 py-4 rounded-lg border-2 transition-all ${
        disabled
          ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
          : active
          ? "border-[#1D9E75] bg-[#E1F5EE]"
          : "border-gray-200 bg-white"
      }`}
    >
      <Icon size={22} className={active && !disabled ? "text-[#1D9E75]" : "text-gray-500"} />
      <span className={`text-sm font-semibold ${active && !disabled ? "text-[#085041]" : "text-gray-700"}`}>
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
