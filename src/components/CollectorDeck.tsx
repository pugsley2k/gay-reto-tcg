'use client';
import { useRef, useState, type PointerEvent } from 'react';
import Image from 'next/image';
import styles from './CollectorDeck.module.css';
const cards = [
  { name: 'Gardevoir ex', set: 'Scarlet & Violet', image: '/showcase-gardevoir.png' },
  { name: 'Mew V', set: 'Fusion Strike', image: '/showcase-mew.png' },
  { name: 'Charizard V', set: 'Brilliant Stars', image: '/showcase-charizard.png' },
];
export default function CollectorDeck() {
  const [active, setActive] = useState(0);
  const surface = useRef<HTMLDivElement>(null);
  function tilt(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - bounds.left) / bounds.width - .5;
    const y = (e.clientY - bounds.top) / bounds.height - .5;
    if (surface.current) surface.current.style.transform = `perspective(1100px) rotateX(${-y * 12}deg) rotateY(${x * 16}deg)`;
  }
  return <div className={styles.showcase}>
    <div className={styles.label}><span>CARD SHOWCASE</span><span>{String(active + 1).padStart(2, '0')} / 03</span></div>
    <div className={styles.arena} onPointerMove={tilt} onPointerLeave={() => { if (surface.current) surface.current.style.transform = ''; }}>
      <div ref={surface} className={styles.surface}>
        {cards.map((card, i) => { const position = (i - active + cards.length) % cards.length; return <div key={card.name} className={styles.card} data-position={position} aria-hidden={position !== 0}>
          <Image src={card.image} alt={position === 0 ? `${card.name} collectible Pokémon card artwork` : ''} width={420} height={588} priority={i === 0} sizes="(max-width: 640px) 65vw, 320px" />
          <span className={styles.foil} aria-hidden="true" />
        </div>; })}
      </div>
    </div>
    <div className={styles.controls}><div aria-live="polite"><p>{cards[active].name} <small>/ {cards[active].set}</small></p></div><button onClick={() => setActive(i => (i + 1) % cards.length)} aria-label="Shuffle showcase cards"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 6h3c4 0 8 12 12 12h3m-4-4 4 4-4 4M3 18h3c1 0 2-1 3-3m6-6c1-2 2-3 3-3h3m-4-4 4 4-4 4" /></svg>Shuffle</button></div>
    <p className={styles.disclaimer}>Showcase cards. See the shop for current availability.</p>
  </div>;
}
