'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useCart } from './CartProvider';
import styles from './FloatingMew.module.css';
import { MEW_CODE } from '@/lib/promo';

export default function FloatingMew() {
  const root = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLButtonElement>(null);
  const { setPromoCode, isReady } = useCart();
  const curveId = `mew-gift-${useId().replace(/:/g, '')}`;
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [applied,setApplied] = useState(false);
  const [focused,setFocused] = useState(false);
  const applyGift = useCallback(()=>{if(!isReady)return;setPromoCode(MEW_CODE);setApplied(true);},[setPromoCode,isReady]);
  useEffect(()=>{if(!applied)return;const timer=setTimeout(()=>setApplied(false),6000);return()=>clearTimeout(timer);},[applied]);
  useEffect(()=>{
    // The artwork stays behind the page. Recognise clicks on its visible area
    // without placing an invisible hitbox over links, forms or other controls.
    function clickMew(event:MouseEvent){
      if(event.detail===0 || !(event.target instanceof Element) || event.target.closest('a,button,input,select,textarea,label,summary,img,[role="button"],[contenteditable="true"]'))return;
      for(let node:Element|null=event.target;node && node!==document.body;node=node.parentElement){
        const style=getComputedStyle(node);
        const colour=style.backgroundColor.match(/[\d.]+/g);
        if(style.backgroundImage!=='none' || (colour && Number(colour[3] ?? 1)>.95))return;
      }
      const rect=bubble.current?.getBoundingClientRect();
      if(!rect)return;
      const radius=rect.width/2;
      if(Math.hypot(event.clientX-rect.left-radius,event.clientY-rect.top-radius)<=radius)applyGift();
    }
    document.addEventListener('click',clickMew);
    return()=>document.removeEventListener('click',clickMew);
  },[applyGift]);
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
  const running = !paused && !focused && !reduced && visible && !hidden;
  return <><div ref={root} className={styles.background} data-running={running}>
    <div className={styles.horizontal}><div className={styles.vertical}>
      <button ref={bubble} type="button" disabled={!isReady} className={styles.mewButton} aria-label="Apply MEW5 for 5% off cards in your cart" onClick={applyGift} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}>
      <img src={running ? '/mew-floating-padded.webp' : '/mew-floating-padded-still.png'} width="192" height="192" alt="" className={styles.mew} />
      <svg className={styles.gift} viewBox="0 0 145 165" focusable="false" aria-hidden="true">
        <defs><path id={curveId} d="M 12 92 Q 72.5 184 133 92" /></defs>
        <text><textPath href={`#${curveId}`} startOffset="50%" textAnchor="middle">{MEW_CODE} · 5% OFF</textPath></text>
      </svg>
      </button>
    </div></div>
  </div>
    {applied && <div className={styles.applied} role="status">MEW5 applied — 5% off cards. Delivery excluded. <Link href="/cart">View cart ↗</Link></div>}
    {!reduced && <button type="button" className={styles.toggle} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Play Mew' : 'Pause Mew'}</button>}
  </>;
}
