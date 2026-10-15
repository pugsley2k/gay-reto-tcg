'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './ListingBanner.module.css';
type Listing = { id: string; name: string; price: number; image_url?: string | null };
export default function ListingBanner({ cards, failed = false }: { cards: Listing[]; failed?: boolean }) {
  const [paused, setPaused] = useState(false);
  return <section className={styles.banner} aria-label="Latest listings"><div className={styles.window}>
    {cards.length ? <div className={styles.track} data-paused={paused}>{[0, 1].map(copy => <div className={styles.group} key={copy} aria-hidden={copy === 1 ? true : undefined}>{cards.map(card => <Link key={card.id} href={`/cards/${encodeURIComponent(card.id)}`} tabIndex={copy === 1 ? -1 : undefined} className={styles.listing}>{card.image_url ? <Image className={styles.thumbnail} src={card.image_url} alt="" width={48} height={67} sizes="48px" /> : <span aria-hidden="true" className={styles.star}>✳</span>}<span>{card.name}</span><strong>£{(card.price / 100).toFixed(2)}</strong></Link>)}</div>)}</div> : <Link href="/shop" className={styles.empty}>{failed ? 'Browse the shop' : 'No cards listed yet'}<span aria-hidden="true">↗</span></Link>}
  </div>{cards.length > 0 && <button className={styles.pause} onClick={() => setPaused(p => !p)} aria-label={paused ? 'Play listings banner' : 'Pause listings banner'} aria-pressed={paused}>{paused ? '▶' : 'Ⅱ'}</button>}</section>;
}
