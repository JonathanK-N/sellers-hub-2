/* Adaptation du composant React Bits (https://reactbits.dev), licence MIT + Commons Clause. */
import { useEffect, useRef } from 'react';

export default function CountUp({ to, from = 0, direction = 'up', delay = 0, duration = 2, className = '', startWhen = true, separator = '', onStart, onEnd }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !startWhen) return;
    const initial = direction === 'down' ? to : from;
    const final = direction === 'down' ? from : to;
    const decimals = Math.max(String(from).split('.')[1]?.length || 0, String(to).split('.')[1]?.length || 0);
    const formatter = new Intl.NumberFormat('en-US', { useGrouping: !!separator, minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const paint = value => { el.textContent = formatter.format(value).replace(/,/g, separator); };
    paint(initial);
    let frame, timeout, observer;
    let cancelled = false;
    const begin = () => {
      observer?.disconnect();
      onStart?.();
      timeout = setTimeout(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || duration <= 0) { paint(final); onEnd?.(); return; }
        let started;
        const tick = now => {
          if (cancelled) return;
          started ??= now;
          const progress = Math.min(1, (now - started) / (duration * 1000));
          paint(initial + (final - initial) * (1 - Math.pow(1 - progress, 3)));
          if (progress < 1) frame = requestAnimationFrame(tick);
          else onEnd?.();
        };
        frame = requestAnimationFrame(tick);
      }, delay * 1000);
    };
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) begin(); });
      observer.observe(el);
    } else begin();
    return () => { cancelled = true; observer?.disconnect(); clearTimeout(timeout); cancelAnimationFrame(frame); };
  }, [to, from, direction, delay, duration, startWhen, separator, onStart, onEnd]);
  return <span className={className} ref={ref}>{direction === 'down' ? to : from}</span>;
}
