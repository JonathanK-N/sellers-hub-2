/* Adaptation du composant React Bits (https://reactbits.dev), licence MIT + Commons Clause. */
import { useRef, useEffect } from 'react';

export default function AnimatedContent({ children, container, distance = 100, direction = 'vertical', reverse = false, duration = 0.8, ease = 'power3.out', initialOpacity = 0, animateOpacity = true, scale = 1, threshold = 0.1, delay = 0, disappearAfter = 0, disappearDuration = 0.5, disappearEase = 'power3.in', onComplete, onDisappearanceComplete, className = '', ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !el.animate || !window.IntersectionObserver) return;
    const root = typeof container === 'string' ? document.querySelector(container) : (container || document.getElementById('snap-main-container'));
    const offset = reverse ? -distance : distance;
    const transform = value => direction === 'horizontal' ? 'translateX(' + value + 'px)' : 'translateY(' + value + 'px)';
    const easing = value => value.includes('.in') ? 'cubic-bezier(.64,0,.78,0)' : 'cubic-bezier(.22,1,.36,1)';
    const initial = { transform: transform(offset) + ' scale(' + scale + ')', opacity: animateOpacity ? initialOpacity : 1 };
    Object.assign(el.style, initial);
    let animation, disappearance, timer, cancelled = false;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      observer.disconnect();
      animation = el.animate([initial, { transform: 'translate(0,0) scale(1)', opacity: 1 }], { duration: duration * 1000, delay: delay * 1000, easing: easing(ease), fill: 'both' });
      animation.finished.then(() => {
        if (cancelled) return;
        el.style.transform = ''; el.style.opacity = ''; animation.cancel();
        onComplete?.();
        if (disappearAfter > 0) timer = setTimeout(() => {
          disappearance = el.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: transform(-offset) + ' scale(.8)', opacity: animateOpacity ? initialOpacity : 0 }], { duration: disappearDuration * 1000, easing: easing(disappearEase), fill: 'forwards' });
          disappearance.finished.then(() => { if (!cancelled) onDisappearanceComplete?.(); }).catch(() => {});
        }, disappearAfter * 1000);
      }).catch(() => {});
    }, { root, threshold: Math.min(1, Math.max(0, threshold)) });
    observer.observe(el);
    return () => { cancelled = true; observer.disconnect(); animation?.cancel(); disappearance?.cancel(); clearTimeout(timer); el.style.transform = ''; el.style.opacity = ''; };
  }, [container, distance, direction, reverse, duration, ease, initialOpacity, animateOpacity, scale, threshold, delay, disappearAfter, disappearDuration, disappearEase, onComplete, onDisappearanceComplete]);
  return <div ref={ref} className={className} {...props}>{children}</div>;
}
