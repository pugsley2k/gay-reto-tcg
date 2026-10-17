'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './FloatingMew.module.css';

export default function FloatingMew() {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);
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
  return <div ref={root} className={styles.background} data-running={running}>
    <div className={styles.horizontal} aria-hidden="true"><div className={styles.vertical}>
      <img src={running ? '/mew-floating-padded.webp' : '/mew-floating-padded-still.png'} width="192" height="192" alt="" className={styles.mew} />
    </div></div>
    {!reduced && <button type="button" className={styles.toggle} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Play Mew' : 'Pause Mew'}</button>}
  </div>;
}
