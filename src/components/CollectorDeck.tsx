'use client';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './CollectorDeck.module.css';
import { useCart } from './CartProvider';
export type DeckStock = { id: string; name: string; set: string | null; language: string | null; price: number; image: string };
const showcase = [
  { name: 'Gardevoir ex', set: 'Scarlet & Violet', image: '/showcase-gardevoir.png' },
  { name: 'Espeon VMAX', set: 'Fusion Strike', image: 'https://assets.tcgdex.net/en/swsh/swsh8/270/high.webp' },
  { name: 'Sylveon VMAX', set: 'Evolving Skies', image: 'https://assets.tcgdex.net/en/swsh/swsh7/212/high.webp' },
  { name: 'Mew V', set: 'Fusion Strike', image: '/showcase-mew.png' },
  { name: 'Umbreon VMAX', set: 'Evolving Skies', image: 'https://assets.tcgdex.net/en/swsh/swsh7/215/high.webp' },
  { name: 'Leafeon VMAX', set: 'Evolving Skies', image: 'https://assets.tcgdex.net/en/swsh/swsh7/205/high.webp' },
  { name: 'Dragonite V', set: 'Evolving Skies', image: 'https://assets.tcgdex.net/en/swsh/swsh7/192/high.webp' },
];
export default function CollectorDeck({ compact = false, stock = [] }: { compact?: boolean; stock?: DeckStock[] }) {
  // Real stock leads the hero. The artwork-only showcase is the fallback when the shop is nearly empty.
  const selling = stock.length >= 3;
  const cards: { key: string; name: string; set: string; image: string; item?: DeckStock }[] = selling
    ? stock.slice(0, 7).map(item => ({ key: item.id, name: item.name, set: [item.set || 'Pokémon TCG', item.language].filter(Boolean).join(' · '), image: item.image, item }))
    : showcase.map(card => ({ key: card.name, ...card }));
  const { addToCart, cart, isReady } = useCart();
  const [active, setActive] = useState(0);
  const [instant, setInstant] = useState(false);
  const [automatic, setAutomatic] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [inView, setInView] = useState(false);
  const root = useRef<HTMLElement>(null);
  const playing = !paused && !hovered && !focused && !reduced && !hidden && inView;
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(preference.matches);
    const visibility = () => setHidden(document.hidden);
    motion(); visibility();
    preference.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: .2 });
    if (root.current) observer.observe(root.current);
    return () => { preference.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); observer.disconnect(); };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => { setInstant(false); setAutomatic(true); setActive(i => (i + 1) % cards.length); }, 7000);
    return () => clearInterval(timer);
  }, [playing, cards.length]);
  const suppressClickUntil = useRef(0);
  const touch = useRef<{x:number;y:number}|null>(null);
  function move(step:number, keyboard=false) { setPaused(true); setAutomatic(false); setInstant(keyboard); setActive(i=>(i+step+cards.length)%cards.length); }
  function keys(event:KeyboardEvent<HTMLElement>) {
    if(event.key==='ArrowRight'||event.key==='ArrowLeft') { event.preventDefault(); move(event.key==='ArrowRight'?1:-1,true); }
  }
  return <section ref={root} className={`${styles.showcase} ${compact ? styles.compact : ''}`} onPointerEnter={e=>{if(e.pointerType==='mouse')setHovered(true);}} onPointerLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node | null))setFocused(false);}} data-automatic={automatic} aria-label={selling ? 'Cards in the shop now' : 'Pokémon card artwork'} aria-roledescription="carousel" onKeyDown={keys} data-instant={instant}>
    <div className={styles.label}><h2>{selling ? 'In the shop now' : 'Pokémon card showcase'}</h2><Link href="/shop" className={styles.stockLink}>Shop available cards <span aria-hidden="true">↗</span></Link><span>{String(active+1).padStart(2,'0')} / {String(cards.length).padStart(2,'0')}</span></div>
    <div className={styles.arena} onTouchStart={e=>{setPaused(true);touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchEnd={e=>{if(!touch.current)return;const dx=e.changedTouches[0].clientX-touch.current.x,dy=e.changedTouches[0].clientY-touch.current.y;touch.current=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5){suppressClickUntil.current=Date.now()+350;move(dx<0?1:-1);}}}>
      {cards.map((card,i)=>{let offset=(i-active+cards.length)%cards.length;if(offset>cards.length/2)offset-=cards.length;const visible=Math.abs(offset)<=2;return <button type="button" key={card.key} className={styles.card} data-position={offset} aria-label={offset===0?card.name:'Show '+card.name} aria-current={offset===0?'true':undefined} aria-hidden={!visible} tabIndex={visible?0:-1} onClick={e=>{if(Date.now()<suppressClickUntil.current)return;setPaused(true);setAutomatic(false);setInstant(e.detail===0);setActive(i);}}>
        <Image src={card.image} alt={card.name+' Pokémon card artwork'} width={600} height={840} priority={i===0} sizes="(max-width: 640px) 64vw, (max-width: 1000px) 280px, 340px" />
        <span className={styles.foil} aria-hidden="true" />
      </button>;})}
    </div>
    <div className={styles.controls}>
      <div className={styles.caption} aria-live={playing?'off':'polite'}><p>{cards[active].name}{cards[active].item && <span className="grt-tag small">£{(cards[active].item.price/100).toFixed(2)}</span>}</p><small>{cards[active].set}</small></div>
      <div className={styles.arrows}><button type="button" onClick={e=>move(-1,e.detail===0)} aria-label="Previous showcase card">←</button><button type="button" onClick={e=>move(1,e.detail===0)} aria-label="Next showcase card">→</button>{!reduced && <button type="button" onClick={()=>{setPaused(p=>!p);setFocused(false);}} aria-label={paused?'Play carousel':'Pause carousel'} aria-pressed={paused}>{paused?'▶':'Ⅱ'}</button>}</div>
      <Link href="/shop" className={styles.shopLink}>Browse cards <span aria-hidden="true">↗</span></Link>
      {(() => { const item = cards[active].item; if (!item) return null; const inCart = cart.some(entry => entry.id === item.id); return <div className={styles.buy}>
        <button type="button" disabled={!isReady || inCart} onClick={() => { setPaused(true); addToCart({ id: item.id, name: item.name, price: item.price, imageUrl: item.image }); }}>{inCart ? 'In your cart' : 'Add to cart'}</button>
        <Link href={`/cards/${encodeURIComponent(item.id)}`}>View card <span aria-hidden="true">↗</span></Link>
      </div>; })()}
    </div>
    {!selling && <p className={styles.disclaimer}>Artwork showcase. See the shop for available cards.</p>}
  </section>;
}
