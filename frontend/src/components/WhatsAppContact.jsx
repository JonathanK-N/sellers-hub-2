// Author: Jonathan Kakesa (JonathanK-N).
export function whatsappLink(contact, reference) {
  if (!contact?.verified || !contact?.visible || !/^\+[1-9][0-9]{8,14}$/.test(contact.phone || "")) return null;
  const message = reference
    ? "Bonjour, je vous contacte depuis AfriMarket concernant ma commande " + reference + ". Je souhaite convenir avec vous du moyen de paiement et de la livraison."
    : "Bonjour, je vous contacte depuis AfriMarket pour convenir du moyen de paiement et de la livraison d’un produit.";
  return "https://wa.me/" + contact.phone.slice(1) + "?text=" + encodeURIComponent(message);
}

export default function WhatsAppContact({ contact, reference }) {
  const href = whatsappLink(contact, reference);
  if (!href) return <p className="text-xs text-gray-500">WhatsApp non disponible pour cette boutique. Utilisez la messagerie AfriMarket.</p>;
  return <a data-testid="whatsapp-seller-btn" href={href} target="_blank" rel="noopener noreferrer" className="block text-center bg-afri-primary hover:bg-afri-primary-hover text-white rounded-lg py-3 px-3 text-sm font-semibold">Contacter le vendeur sur WhatsApp</a>;
}
