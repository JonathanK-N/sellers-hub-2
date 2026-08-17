import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { API_BASE } from "../lib/api";

function imgSrc(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE.replace("/api", "")}${url}`;
}

/**
 * BannerCarousel — affiche les bannières actives pour une position et un rôle.
 * props:
 *   position  : "home_top" | "home_mid" | "search_top" | "product_bottom"
 *   role      : "buyer" | "seller" | "deliverer" | "all"
 *   className : classes supplémentaires sur le container
 */
export default function BannerCarousel({ position = "home_top", role = "all", className = "" }) {
  const [banners, setBanners] = useState([]);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    api.get("/admin/banners/public", { params: { position, role } })
      .then(({ data }) => setBanners(data))
      .catch(() => {}); // silencieux si pas de banner
  }, [position, role]);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % banners.length);
  }, [banners.length]);

  // Auto-slide toutes les 4s
  useEffect(() => {
    if (banners.length <= 1) return;
    timerRef.current = setInterval(next, 4000);
    return () => clearInterval(timerRef.current);
  }, [banners.length, next]);

  // Pause auto-slide au touch
  const handleTouch = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(next, 4000);
  };

  if (banners.length === 0) return null;

  const b = banners[current];

  const handleClick = () => {
    if (!b.link_url) return;
    if (b.link_url.startsWith("http")) {
      window.open(b.link_url, "_blank", "noopener");
    } else {
      nav(b.link_url);
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`} onTouchStart={handleTouch}>
      {/* Image principale */}
      <div
        onClick={handleClick}
        className={`relative w-full aspect-[2.5/1] bg-gradient-to-r from-[#0b0b0d] to-[#f97316] overflow-hidden ${b.link_url ? "cursor-pointer" : ""}`}
      >
        {b.image_url && (
          <img
            src={imgSrc(b.image_url)}
            alt={b.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}

        {/* Overlay texte en bas */}
        {(b.title || b.subtitle) && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
            {b.title && (
              <p className="text-white font-display font-bold text-sm leading-tight">
                {b.title}
              </p>
            )}
            {b.subtitle && (
              <p className="text-white/80 text-xs mt-0.5">{b.subtitle}</p>
            )}
          </div>
        )}
      </div>

      {/* Indicateurs dots — seulement si plusieurs banners */}
      {banners.length > 1 && (
        <div className="absolute bottom-2 right-3 flex gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrent(i); handleTouch(); }}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === current ? "bg-white w-4" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
