// Author: Jonathan Kakesa (JonathanK-N).
import { whatsappLink } from "../lib/whatsapp_contact.mjs";
export { whatsappLink } from "../lib/whatsapp_contact.mjs";

export default function WhatsAppContact({ contact, reference }) {
  const href = whatsappLink(contact, reference);
  if (!href) return <p className="text-xs text-gray-500">WhatsApp non disponible pour cette boutique. Utilisez la messagerie AfriMarket.</p>;
  return <a data-testid="whatsapp-seller-btn" href={href} target="_blank" rel="noopener noreferrer" className="block text-center bg-afri-primary-hover hover:bg-afri-secondary text-white rounded-lg py-3 px-3 text-sm font-semibold">Contacter le vendeur sur WhatsApp</a>;
}
