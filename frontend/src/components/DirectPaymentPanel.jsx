import { useState } from "react";
import api, { formatApiError } from "../lib/api";

// Author: Jonathan Kakesa (JonathanK-N).
const LABELS = { to_arrange: "Paiement à convenir", buyer_declared: "L’acheteur déclare avoir payé", seller_declared_received: "Le vendeur déclare avoir reçu le paiement", seller_declared_not_received: "Le vendeur déclare ne pas avoir reçu le paiement", disputed_declaration: "Déclaration contestée" };

export default function DirectPaymentPanel({ order, role, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [receiptConsent, setReceiptConsent] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  if (order.payment_method !== "direct") return null;
  const act = async (path, body) => {
    setBusy(true); setError("");
    try { await api.post("/orders/" + order.id + path, body); await onChanged(); }
    catch (e) { setError(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const payment = action => act("/direct-payment", { action });
  const mutable = order.status === "confirmed" && order.dispute_status !== "open";
  return <section className="bg-afri-soft border border-afri-primary/30 rounded-xl p-4 space-y-3" data-testid="direct-payment-panel">
    <h2 className="font-bold text-afri-secondary">Paiement direct avec le vendeur</h2>
    <p className="text-sm font-semibold">{LABELS[order.payment_status] || "Paiement hors plateforme"}</p>
    <p className="text-xs text-afri-secondary">AfriMarket n’encaisse ni ne conserve les fonds. Ces déclarations ne sont pas vérifiées par AfriMarket. Aucun remboursement automatique n’est garanti. Vérifiez votre compte : un justificatif peut être faux.</p>
    {order.delivery_fee_status === "to_arrange_with_seller" && <p className="text-sm">Les frais de livraison sont à convenir séparément avec le vendeur.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {mutable && role === "buyer" && ["to_arrange", "seller_declared_not_received"].includes(order.payment_status) && <button data-testid="direct-buyer-declare" disabled={busy} onClick={() => payment("buyer_declared")} className="w-full bg-afri-primary text-white rounded-lg py-2.5">Je déclare avoir payé le vendeur</button>}
    {mutable && role === "seller" && order.payment_status !== "seller_declared_received" && order.payment_status !== "disputed_declaration" && <>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={receiptConsent} onChange={e => setReceiptConsent(e.target.checked)}/>J’ai vérifié la réception du paiement sur mon propre compte ou en espèces.</label>
      <button data-testid="direct-seller-receive" disabled={busy || !receiptConsent} onClick={() => payment("seller_received")} className="w-full bg-afri-primary text-white rounded-lg py-2.5 disabled:opacity-50">Déclarer le paiement reçu</button>
      {order.payment_status === "buyer_declared" && <button disabled={busy} onClick={() => payment("seller_not_received")} className="w-full border border-afri-secondary rounded-lg py-2.5">Je n’ai pas reçu le paiement</button>}
    </>}
    {mutable && role === "buyer" && ["seller_declared_received", "seller_declared_not_received"].includes(order.payment_status) && <button disabled={busy} onClick={() => payment("buyer_disagrees")} className="w-full border rounded-lg py-2.5">Contester cette déclaration</button>}
    {mutable && ["to_arrange", "buyer_declared", "seller_declared_not_received"].includes(order.payment_status) && <button data-testid="direct-cancel" disabled={busy} onClick={() => act("/cancel-direct")} className="w-full border border-gray-400 rounded-lg py-2.5">Annuler avant traitement</button>}
    {order.dispute_status === "open" ? <p className="text-sm font-semibold">Un litige est ouvert ; le traitement est suspendu.</p> : <div className="space-y-2"><label htmlFor="direct-dispute-reason" className="text-sm">Signaler un problème</label><textarea id="direct-dispute-reason" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-lg border p-2 text-sm"/><button disabled={busy || !reason.trim()} onClick={() => act("/direct-dispute", {reason})} className="w-full border rounded-lg py-2.5">Ouvrir un litige</button></div>}
    {!!order.payment_history?.length && <details><summary className="text-sm">Historique des déclarations</summary><ul className="mt-2 text-xs space-y-1">{order.payment_history.map((event,i) => <li key={i}>{new Date(event.timestamp).toLocaleString("fr-FR")} — {event.role === "seller" ? "Vendeur" : "Acheteur"} — {event.action}</li>)}</ul></details>}
  </section>;
}
