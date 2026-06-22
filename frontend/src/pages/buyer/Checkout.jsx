import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Truck, Store, ShieldCheck, Banknote, Info } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { formatPrice } from "../../lib/format";

export default function Checkout() {
  const { items, totalFC, totalUSD, checkoutCurrency, fxRate, clear } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("delivery");
  const [neighborhood, setNeighborhood] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [pickupSlot, setPickupSlot] = useState("Aujourd'hui 14:00-16:00");
  const [loading, setLoading] = useState(false);
  const [sellerInfo, setSellerInfo] = useState({});

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

  // Frais de livraison toujours en FC
  const deliveryFeeFC = useMemo(() => {
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

  // Frais de livraison dans la devise choisie
  const deliveryFeeDisplay = checkoutCurrency === "USD" && fxRate
    ? deliveryFeeFC / fxRate
    : deliveryFeeFC;

  useEffect(() => {
    if (mode === "delivery" && !deliveryAvailable && collectAvailable) setMode("collect");
    if (mode === "collect" && !collectAvailable && deliveryAvailable) setMode("delivery");
  }, [deliveryAvailable, collectAvailable]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Totaux dans la devise choisie
  const subtotalDisplay = checkoutCurrency === "USD" ? totalUSD : totalFC;
  const payableTotalDisplay = subtotalDisplay + deliveryFeeDisplay;

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
        payment_method: "cash",
        checkout_currency: checkoutCurrency,
      };
      const { data } = await api.post("/orders", payload);
      const groupId = data.order_group_id;
      const n = data.seller_count || (data.orders ? data.orders.length : 1);
      clear();
      if (n > 1) {
        toast.success(`${n} commandes créées. Paiement à la livraison.`);
        nav(`/buyer/order-group/${groupId}`);
      } else {
        toast.success("Commande créée. Paiement à la livraison.");
        nav(`/buyer/orders/${data.orders[0].id}`);
      }
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-shell">
      <header className="sticky top-0 z-40 bg-[#085041] text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <Link to="/buyer/cart" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-black text-xl">Paiement</h1>
        {/* Devise choisie visible dans le header */}
        <span className="ml-auto bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
          {checkoutCurrency}
        </span>
      </header>

      <div className="px-4 mt-4 space-y-3 pb-28">
        {/* Mode livraison */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Mode</h3>
          <div className="grid grid-cols-2 gap-2">
            <ModeBtn icon={Truck} label="Livraison" active={mode === "delivery"} disabled={!deliveryAvailable} onClick={() => deliveryAvailable && setMode("delivery")} testid="mode-delivery" />
            <ModeBtn icon={Store} label="Retrait" active={mode === "collect"} disabled={!collectAvailable} onClick={() => collectAvailable && setMode("collect")} testid="mode-collect" />
          </div>
          {!deliveryAvailable && <p className="text-xs text-gray-500 mt-2 text-center">Un ou plusieurs produits ne sont disponibles qu'au retrait en boutique.</p>}
          {!collectAvailable && <p className="text-xs text-gray-500 mt-2 text-center">Un ou plusieurs produits ne sont disponibles qu'en livraison.</p>}
          {items.some((it) => {
            const modes = it.delivery_modes?.length ? it.delivery_modes : ["delivery", "collect"];
            return !modes.includes(mode);
          }) && (
            <p className="text-xs text-[#BA7517] bg-[#FEF3E2] rounded-lg px-3 py-2 mt-2">
              Certains articles ne supportent pas ce mode et seront regroupés dans une commande séparée automatiquement.
            </p>
          )}
        </section>

        {/* Adresse */}
        {mode === "delivery" && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Adresse de livraison</h3>
            <Input label="Quartier" value={neighborhood} onChange={setNeighborhood} placeholder="Ex: Gombe, Bonapriso…" testid="checkout-neighborhood-input" />
            <Input label="Repère" value={landmark} onChange={setLandmark} placeholder="Près de l'église, en face de…" testid="checkout-landmark-input" />
            <Input label="Ville (optionnel)" value={city} onChange={setCity} placeholder="Ex: Kinshasa" testid="checkout-city-input" />
          </section>
        )}

        {/* Créneau retrait */}
        {mode === "collect" && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Créneau de retrait</h3>
            <select data-testid="pickup-slot-select" value={pickupSlot} onChange={(e) => setPickupSlot(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] outline-none">
              <option>Aujourd'hui 14:00-16:00</option>
              <option>Aujourd'hui 16:00-18:00</option>
              <option>Demain 09:00-11:00</option>
              <option>Demain 14:00-16:00</option>
            </select>
          </section>
        )}

        {/* Paiement : cash + devise */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Mode de paiement</h3>
          <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-[#1D9E75] bg-[#E1F5EE]">
            <div className="w-10 h-10 rounded-full bg-[#1D9E75] text-white flex items-center justify-center shrink-0">
              <Banknote size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#085041]">Paiement en espèces</p>
              <p className="text-xs text-[#1D9E75]">À la livraison / au retrait · en <strong>{checkoutCurrency}</strong></p>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 bg-[#F5F5F5] border border-gray-200 rounded-lg px-3 py-2.5">
            <Info size={15} className="text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="font-semibold text-gray-600">Mobile Money</span> (MTN MoMo, Airtel Money, Orange Money…) —{" "}
              <span className="text-[#1D9E75] font-semibold">Disponible très prochainement</span> sur AfriMarket.
            </p>
          </div>
        </section>

        {/* Sécurité */}
        <section className="bg-[#E1F5EE] border border-[#1D9E75]/30 rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1D9E75] text-white flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div className="text-xs text-[#085041]">
            <p className="font-semibold">Paiement sécurisé</p>
            <p className="mt-0.5 leading-relaxed">
              Vous payez en espèces en <strong>{checkoutCurrency}</strong> à la livraison ou au retrait.
            </p>
          </div>
        </section>

        {/* Récapitulatif */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-1.5 text-sm">
          <Row label="Sous-total" value={formatPrice(subtotalDisplay, checkoutCurrency)} />
          {mode === "delivery" && deliveryFeeFC > 0 && (
            <Row label="Frais de livraison" value={formatPrice(deliveryFeeDisplay, checkoutCurrency)} muted />
          )}
          {/* Ligne de conversion si USD */}
          {checkoutCurrency === "USD" && fxRate && (
            <p className="text-[11px] text-gray-400 text-right">
              Taux BCC · 1 USD = {new Intl.NumberFormat("fr-FR").format(Math.round(fxRate))} FC
            </p>
          )}
          <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between font-display font-black text-lg text-[#085041]">
            <span>Total</span>
            <span data-testid="checkout-total">{formatPrice(payableTotalDisplay, checkoutCurrency)}</span>
          </div>
          {/* Équivalent dans l'autre devise */}
          {checkoutCurrency === "USD" ? (
            <p className="text-[11px] text-gray-400 text-right">≈ {formatPrice(totalFC + deliveryFeeFC, "FC")}</p>
          ) : totalUSD > 0 ? (
            <p className="text-[11px] text-gray-400 text-right">≈ {formatPrice(totalUSD + (fxRate ? deliveryFeeFC / fxRate : 0), "USD")}</p>
          ) : null}
        </section>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 px-4 py-3 pb-5 z-50 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
        <button
          data-testid="checkout-pay-btn"
          disabled={loading}
          onClick={submit}
          className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Banknote size={16} />
          {loading ? "Traitement…" : `Commander — ${formatPrice(payableTotalDisplay, checkoutCurrency)}`}
        </button>
      </div>
    </div>
  );
}

function ModeBtn({ icon: Icon, label, active, disabled, onClick, testid }) {
  return (
    <button onClick={onClick} disabled={disabled} data-testid={testid}
      className={`flex flex-col items-center gap-2 py-4 rounded-lg border-2 transition-all ${
        disabled ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
          : active ? "border-[#1D9E75] bg-[#E1F5EE]"
          : "border-gray-200 bg-white"
      }`}>
      <Icon size={22} className={active && !disabled ? "text-[#1D9E75]" : "text-gray-500"} />
      <span className={`text-sm font-semibold ${active && !disabled ? "text-[#085041]" : "text-gray-700"}`}>{label}</span>
    </button>
  );
}

function Input({ label, value, onChange, placeholder, testid }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700">{label}</label>
      <input data-testid={testid} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 border border-gray-300 rounded-lg p-3 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none" />
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
