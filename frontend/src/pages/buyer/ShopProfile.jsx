import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { MapPin, Clock, Star, ShieldCheck, Crown, Facebook, Globe, Phone, Package, MessageSquare, LogIn } from "lucide-react";
import api from "../../lib/api";
import { photoUrl, timeAgo } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import ProductCard from "../../components/ProductCard";

export default function ShopProfile({ guest = false }) {
  const { sellerId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/seller/public/${sellerId}`)
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sellerId]);

  if (loading) return <div className="mobile-shell pt-24 text-center text-gray-400">Chargement…</div>;
  if (!data) return <div className="mobile-shell pt-24 text-center text-gray-400">Boutique introuvable.</div>;

  const { seller, products, reviews } = data;
  const social = seller.social_links || {};
  const hasSocial = social.facebook || social.tiktok || social.whatsapp_business || social.instagram;
  const isGuestView = guest || !user;
  const backLink = isGuestView ? "/" : "/buyer/home";

  const handleContact = () => {
    if (isGuestView) {
      toast.info("Connectez-vous pour contacter le vendeur");
      nav("/auth/login", { state: { from: `/explore/shop/${sellerId}` } });
      return;
    }
    nav(`/messages/${user.id}__${seller.user_id}`, { state: { other_name: seller.shop_name } });
  };

  return (
    <div className="mobile-shell pb-12">
      {/* BANNIÈRE */}
      <div className="relative">
        <div className="w-full h-36 overflow-hidden bg-gradient-to-r from-[#0b0b0d] to-[#f97316]">
          {seller.shop_banner_url && <img src={photoUrl(seller.shop_banner_url)} alt="bannière" className="w-full h-full object-cover" />}
        </div>
        {/* Logo flottant */}
        <div className="absolute left-4 -bottom-10 w-20 h-20 rounded-full border-4 border-white bg-gray-100 shadow-lg overflow-hidden">
          {seller.shop_logo_url
            ? <img src={photoUrl(seller.shop_logo_url)} alt="logo" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-[#0b0b0d] flex items-center justify-center"><span className="text-white text-3xl font-black">{seller.shop_name[0]}</span></div>}
        </div>
        {/* Bouton retour */}
        <Link to={backLink} className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur flex items-center justify-center text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </Link>
        {isGuestView && (
          <Link to="/auth/login" className="absolute top-3 right-3 flex items-center gap-1 text-xs font-semibold bg-white/90 backdrop-blur text-gray-900 px-3 py-1.5 rounded-full">
            <LogIn size={13} /> Connexion
          </Link>
        )}
      </div>

      <div className="px-4 pt-12">
        {/* Infos principales */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-black text-xl text-gray-900">{seller.shop_name}</h1>
              {seller.badge_verified && <ShieldCheck size={18} className="text-green-600" />}
              {seller.premium && <Crown size={16} className="text-[#f97316]" />}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{seller.category}</p>
          </div>
          {seller.rating > 0 && (
            <div className="flex items-center gap-1 bg-[#f97316]/10 text-[#BA7517] px-3 py-1.5 rounded-full">
              <Star size={14} fill="currentColor" /><span className="text-sm font-bold">{seller.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Tags spécialités */}
        {(seller.product_specialties || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {seller.product_specialties.map(s => <span key={s} className="text-xs bg-orange-50 text-gray-900 font-medium px-2.5 py-1 rounded-full">{s}</span>)}
          </div>
        )}

        {/* Accroche */}
        {seller.description && <p className="text-sm text-gray-700 mt-3">{seller.description}</p>}

        {/* Infos lieu + horaires */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {seller.neighborhood && <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={12} />{seller.neighborhood}{seller.address ? `, ${seller.address}` : ""}</span>}
          {seller.opening_hours && <span className="flex items-center gap-1 text-xs text-gray-500"><Clock size={12} />{seller.opening_hours}</span>}
        </div>

        {/* Bouton contact */}
        <button
          data-testid="contact-seller-btn"
          onClick={handleContact}
          className="w-full mt-4 bg-white border border-[#f97316] text-[#f97316] hover:bg-orange-50 rounded-lg py-2.5 font-semibold flex items-center justify-center gap-2 text-sm transition-colors"
        >
          <MessageSquare size={16} /> {isGuestView ? "Se connecter pour contacter ce vendeur" : "Contacter le vendeur"}
        </button>

        {/* DESCRIPTION LONGUE */}
        {seller.long_description && (
          <div className="mt-4 bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">À propos</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{seller.long_description}</p>
          </div>
        )}

        {/* RÉSEAUX SOCIAUX */}
        {hasSocial && (
          <div className="mt-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Retrouvez-nous</h3>
            <div className="flex flex-wrap gap-2">
              {social.facebook && (
                <a href={social.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium">
                  <Facebook size={15} /> Facebook
                </a>
              )}
              {social.tiktok && (
                <a href={social.tiktok} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium">
                  <span className="font-bold text-xs">TK</span> TikTok
                </a>
              )}
              {social.whatsapp_business && (
                <a href={`https://wa.me/${social.whatsapp_business.replace(/[^0-9]/g,"")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm font-medium">
                  <Phone size={15} /> WhatsApp
                </a>
              )}
              {social.instagram && (
                <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-pink-50 text-pink-700 px-3 py-2 rounded-lg text-sm font-medium">
                  <Globe size={15} /> Instagram
                </a>
              )}
            </div>
          </div>
        )}

        {/* PRODUITS */}
        <div className="mt-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Package size={16} className="text-[#f97316]" /> Produits ({products.length})
          </h3>
          {products.length === 0
            ? <p className="text-sm text-gray-400 text-center py-6">Aucun produit disponible pour l'instant.</p>
            : <div className="grid grid-cols-2 gap-3">
                {products.map(p => <ProductCard key={p.id} guest={isGuestView} product={{ ...p, seller_name: seller.shop_name, seller_rating: seller.rating, seller_premium: seller.premium }} />)}
              </div>
          }
        </div>

        {/* AVIS */}
        {reviews.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Star size={16} className="text-[#f97316]" /> Avis clients ({reviews.length})
            </h3>
            <div className="space-y-3">
              {reviews.slice(0, 5).map(r => (
                <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex">
                      {[1,2,3,4,5].map(i => <Star key={i} size={12} fill={i <= r.rating ? "#f97316" : "transparent"} className={i <= r.rating ? "text-[#f97316]" : "text-gray-300"} />)}
                    </div>
                    <span className="text-xs text-gray-400">{timeAgo(r.created_at)}</span>
                  </div>
                  {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA bas de page (guest only) */}
        {isGuestView && (
          <div className="mt-6 bg-orange-50 rounded-xl p-4 text-center">
            <p className="text-sm text-gray-900 font-medium mb-3">
              Connectez-vous pour commander chez {seller.shop_name}
            </p>
            <Link to="/auth/register" className="inline-block bg-[#0b0b0d] hover:bg-[#1f2937] text-white rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors">
              Créer mon compte
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
