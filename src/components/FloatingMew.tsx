'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './FloatingMew.module.css';
import { MEW_CODE } from '@/lib/promo';

export default function FloatingMew() {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [copyStatus,setCopyStatus] = useState('');
  async function copyCode() {
    try {await navigator.clipboard.writeText(MEW_CODE);setCopyStatus('MEW5 copied');}
    catch {setCopyStatus('Enter MEW5 in your cart');}
  }
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReduced(motion.matches);
    const updateVisibility = () => setHidden(document.hidden);
    updateMotion(); updateVisibility();
    motion.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (root.current) observer.observe(root.current);
    return () => { observer.disconnect(); motion.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', updateVisibility); };
  }, []);
  const running = !paused && !reduced && visible && !hidden;
  return <><div ref={root} className={styles.background} data-running={running}>
    <div className={styles.horizontal} aria-hidden="true"><div className={styles.vertical}>
      <img src={running ? '/mew-floating-padded.webp' : '/mew-floating-padded-still.png'} width="192" height="192" alt="" className={styles.mew} />
      <span className={styles.gift}>{MEW_CODE} · 5% off</span>
    </div></div>
  </div>
    <button type="button" className={styles.copy} onClick={()=>void copyCode()} title="5% off cards. Delivery excluded. Enter MEW5 in your cart." aria-live="polite">{copyStatus || 'Copy MEW5 · 5% off cards'}</button>
    {!reduced && <button type="button" className={styles.toggle} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Play Mew' : 'Pause Mew'}</button>}
  </>;
}
