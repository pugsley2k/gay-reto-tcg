'use client';
import { useRef, type PointerEvent, type ReactNode } from 'react';

/** Tilts its content towards the pointer and moves a foil shine with it. Mouse only; touch scrolls as normal. */
export default function CardTilt({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  function move(event: PointerEvent<HTMLSpanElement>) {
    const el = ref.current;
    if (!el || event.pointerType !== 'mouse') return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    el.style.setProperty('--rx', `${((0.5 - y) * 14).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${((x - 0.5) * 16).toFixed(2)}deg`);
    el.dataset.active = 'true';
  }
  function leave() {
    const el = ref.current;
    if (!el) return;
    el.dataset.active = 'false';
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }
  return <span ref={ref} className={`grt-tilt ${className}`} onPointerMove={move} onPointerLeave={leave}>{children}<span className="grt-foil" aria-hidden="true" /></span>;
}
