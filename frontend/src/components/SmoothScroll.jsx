import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export default function SmoothScroll() {
  const { pathname } = useLocation();
  const trigger = useRef(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(pointer: coarse)').matches) return;
    let cancelled = false, lenis, gsap, onRaf;
    Promise.all([import('lenis'), import('gsap'), import('gsap/ScrollTrigger')]).then(([l, g, s]) => {
      if (cancelled) return;
      gsap = g.gsap;
      trigger.current = s.ScrollTrigger;
      gsap.registerPlugin(s.ScrollTrigger);
      lenis = new l.default({ duration: 1.1, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
      lenis.on('scroll', s.ScrollTrigger.update);
      onRaf = time => lenis.raf(time * 1000);
      gsap.ticker.add(onRaf);
      gsap.ticker.lagSmoothing(0);
    }).catch(() => {});
    return () => { cancelled = true; if (onRaf) gsap.ticker.remove(onRaf); lenis?.destroy(); trigger.current = null; };
  }, []);
  useEffect(() => { window.scrollTo(0, 0); trigger.current?.refresh(); }, [pathname]);
  return null;
}
