import { Link } from "react-router-dom";
import { Star, MapPin, ShieldCheck, Crown, Heart, ShoppingCart } from "lucide-react";
import { formatPrice, formatDistance, displayPrice, photoUrl } from "../lib/format";

export default function ProductCard({ product, guest = false }) {
  const photo = product.photos?.[0];
  const distance = formatDistance(product.distance_km);
  const href = guest ? `/explore/product/${product.id}` : `/buyer/product/${product.id}`;
  const { amount, currency } = displayPrice(product);

  return (
    <Link
      to={href}
      data-testid={`product-card-${product.id}`}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col group hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {photo ? (
          <img
            src={photoUrl(photo)}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl font-black font-display">
            A
          </div>
        )}
        <button
          type="button"
          aria-label="Ajouter aux favoris"
          onClick={(e) => e.preventDefault()}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-gray-500 hover:text-[#f97316] shadow-sm transition-colors"
        >
          <Heart size={14} />
        </button>
        {product.seller_premium && (
          <span className="absolute top-2 left-2 flex items-center gap-1 bg-[#f97316] text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm">
            <Crown size={11} /> Premium
          </span>
        )}
        {product.currency === "USD" && (
          <span className="absolute bottom-2 left-2 bg-[#0b0b0d] text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
            $USD
          </span>
        )}
        {distance && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/95 backdrop-blur text-gray-700 px-2 py-0.5 rounded-full text-[11px] font-medium shadow-sm">
            <MapPin size={11} /> {distance}
          </span>
        )}
      </div>
      <div className="p-2.5 flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{product.name}</h3>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span className="truncate">{product.seller_name || "Boutique"}</span>
          {product.seller_verified && (
            <ShieldCheck size={12} className="text-[#1D9E75] shrink-0" />
          )}
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex flex-col">
            <span className="font-display font-bold text-gray-900">
              {formatPrice(amount, currency)}
            </span>
            {product.currency === "USD" && (
              <span className="text-[10px] text-gray-400">
                ≈ {formatPrice(product.price, "USD")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {product.seller_rating > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-gray-600">
                <Star size={12} className="text-[#f97316] fill-[#f97316]" />
                {product.seller_rating.toFixed(1)}
              </span>
            )}
            <span
              aria-hidden="true"
              className="w-7 h-7 rounded-full bg-[#0b0b0d] text-white flex items-center justify-center shrink-0"
            >
              <ShoppingCart size={13} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
