import { Link } from "react-router-dom";
import { Star, MapPin, ShieldCheck, Crown } from "lucide-react";
import { formatPrice, formatDistance, photoUrl } from "../lib/format";

export default function ProductCard({ product }) {
  const photo = product.photos?.[0];
  const distance = formatDistance(product.distance_km);

  return (
    <Link
      to={`/buyer/product/${product.id}`}
      data-testid={`product-card-${product.id}`}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col group hover:border-[#1D9E75] transition-colors"
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
        {product.seller_premium && (
          <span className="absolute top-2 left-2 flex items-center gap-1 bg-[#EF9F27] text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm">
            <Crown size={11} /> Premium
          </span>
        )}
        {distance && (
          <span className="absolute top-2 right-2 flex items-center gap-1 bg-white/95 backdrop-blur text-gray-700 px-2 py-0.5 rounded-full text-[11px] font-medium shadow-sm">
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
          <span className="font-display font-bold text-[#085041]">
            {formatPrice(product.price, product.currency)}
          </span>
          {product.seller_rating > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-600">
              <Star size={12} className="text-[#EF9F27] fill-[#EF9F27]" />
              {product.seller_rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
