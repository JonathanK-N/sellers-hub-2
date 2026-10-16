// Author: Jonathan Kakesa (JonathanK-N).
export function legacyBusinessPhone(value) {
  if (typeof value !== "string") return "";
  let phone = value.trim();
  if (/^https?:\/\//i.test(phone)) {
    try {
      const url = new URL(phone);
      if (url.username || url.password) return "";
      if (url.hostname === "wa.me") phone = url.pathname.slice(1);
      else if (["api.whatsapp.com", "web.whatsapp.com"].includes(url.hostname) && url.pathname === "/send") phone = url.searchParams.get("phone") || "";
      else return "";
    } catch { return ""; }
  }
  phone = phone.replace(/[\s().-]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (!phone.startsWith("+")) phone = "+" + phone;
  return /^\+[1-9][0-9]{8,14}$/.test(phone) ? phone : "";
}

export function whatsappLink(contact, reference) {
  if (contact?.verified !== true || contact?.visible !== true || !/^\+[1-9][0-9]{8,14}$/.test(contact.phone || "")) return null;
  const message = reference
    ? "Bonjour, je vous contacte depuis AfriMarket concernant ma commande " + reference + ". Je souhaite convenir avec vous du moyen de paiement et de la livraison."
    : "Bonjour, je vous contacte depuis AfriMarket pour convenir du moyen de paiement et de la livraison d’un produit.";
  return "https://wa.me/" + contact.phone.slice(1) + "?text=" + encodeURIComponent(message);
}
