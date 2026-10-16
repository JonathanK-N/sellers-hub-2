import { useEffect, useState } from "react";
import api, { formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import WhatsAppContact from "./WhatsAppContact";
import { legacyBusinessPhone } from "../lib/whatsapp_contact.mjs";

// Author: Jonathan Kakesa (JonathanK-N).
export default function WhatsAppSettings() {
  const { user } = useAuth();
  const [phone, setPhone] = useState("");
  const [visible, setVisible] = useState(false);
  const [contact, setContact] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [legacyFound, setLegacyFound] = useState(false);
  const refresh = async () => {
    const { data } = await api.get("/seller/me");
    const value = data?.whatsapp_contact;
    const legacy = !value && legacyBusinessPhone(data?.social_links?.whatsapp_business);
    setContact(value || null);
    setPhone(value?.phone || legacy || "");
    setVisible(value?.visible === true);
    setLegacyFound(Boolean(legacy));
  };
  const unsaved = Boolean(contact) && (phone !== contact.phone || visible !== contact.visible);
  useEffect(() => { refresh().catch(() => setMessage("Impossible de charger le contact professionnel.")); }, []);
  useEffect(() => {
    if (window.location.hash === "#whatsapp") document.getElementById("whatsapp")?.scrollIntoView({ block: "start" });
  }, []);
  const run = async callback => { setBusy(true); setMessage(""); try { await callback(); } catch(e) { setMessage(formatApiError(e.response?.data?.detail)); } finally {setBusy(false);} };
  return <section id="whatsapp" className="bg-white border rounded-xl p-4 space-y-3 scroll-mt-20" data-testid="whatsapp-settings">
    <h2 className="font-bold text-afri-secondary">WhatsApp professionnel</h2>
    <p className="text-xs text-gray-600">Ce numéro sera public uniquement avec votre consentement et après vérification. Il s’agit d’un lien WhatsApp ; nous ne vérifions pas l’activité du compte WhatsApp.</p>
    {legacyFound && <p className="text-sm text-amber-900 bg-amber-50 rounded-lg p-3">Votre ancien numéro WhatsApp est prérempli. Confirmez sa publication et vérifiez-le ici pour activer le bouton client. Aucun numéro n’est publié automatiquement.</p>}
    {user?.phone_verified && <button type="button" onClick={() => setPhone(user.phone)} className="text-sm underline text-afri-secondary">Utiliser mon numéro de compte vérifié comme numéro professionnel</button>}
    <label className="block text-sm">Numéro professionnel international<input data-testid="whatsapp-phone" value={phone} maxLength={40} onChange={e => setPhone(e.target.value)} placeholder="+243…" className="mt-1 block w-full border rounded-lg p-2"/></label>
    <label className="flex gap-2 text-sm"><input data-testid="whatsapp-consent" type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)}/>J’autorise l’affichage de ce numéro comme contact professionnel public.</label>
    <button type="button" disabled={busy || !phone.trim()} onClick={() => run(async () => {const {data}=await api.put("/seller/whatsapp",{phone,visible});setContact(data);setPhone(data.phone);setVisible(data.visible === true);setLegacyFound(false);setCode("");setMessage(data.verified?(data.visible?"WhatsApp activé : les clients peuvent vous écrire depuis votre boutique et vos produits.":"Numéro vérifié, publication désactivée."):"Numéro enregistré ; vérification requise avant affichage.");})} className="w-full bg-afri-primary-hover text-white rounded-lg py-2.5">Enregistrer le contact</button>
    {unsaved && <p role="status" className="text-sm text-amber-900">Enregistrez les modifications avant de vérifier le numéro.</p>}
    {contact && !contact.verified && !unsaved && <><button type="button" disabled={busy} onClick={() => run(async () => {const {data}=await api.post("/seller/whatsapp/send-code");setMessage(data.otp_dev?"Code de test synthétique : "+data.otp_dev:"Code envoyé par SMS au numéro professionnel.");})} className="text-sm underline">Envoyer un code de vérification</button><label className="block text-sm">Code à six chiffres<input data-testid="whatsapp-code" inputMode="numeric" value={code} maxLength={6} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,""))} className="block w-full border rounded-lg p-2"/></label><button type="button" disabled={busy || code.length!==6} onClick={() => run(async () => {await api.post("/seller/whatsapp/verify",{code});await refresh();setCode("");setMessage("Numéro vérifié.");})} className="w-full border rounded-lg py-2.5">Valider le numéro</button></>}
    {message && <p role="status" className="text-sm">{message}</p>}
    <p className="text-xs font-semibold">Aperçu du bouton enregistré</p><WhatsAppContact contact={contact}/>
  </section>;
}
