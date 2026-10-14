import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import CollectorDeck from '@/components/CollectorDeck';
import ListingBanner from '@/components/ListingBanner';
import styles from './styles/HomePage.module.css';
export const dynamic = 'force-dynamic';
async function getArrivals() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { cards: [], failed: true };
  try {
    const { data, error } = await createClient(url, key).from('Card').select('id,name,image_url,price,set,language').eq('available', true).not('image_url', 'is', null).order('createdAt', { ascending: false }).limit(12);
    return { cards: data ?? [], failed: !!error };
  } catch { return { cards: [], failed: true }; }
}
export default async function HomePage() {
  const { cards, failed } = await getArrivals();
  return <main id="main-content" className={styles.main}>
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}><span className={styles.signal} /> INDEPENDENT POKÉMON CARD SHOP</p>
        <h1>GAY<br /><span>RETRO</span><br />TCG</h1>
        <div className={styles.heroBottom}><p>Pokémon singles in English, Japanese and Korean.</p><Link href="/shop" className={styles.button}>Browse cards <span aria-hidden="true">↗</span></Link></div>
      </div>
      <CollectorDeck />
    </section>
    <ListingBanner cards={cards} failed={failed} />
    <section className={styles.arrivals}>
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>THE COLLECTION</p><h2>Latest <span>cards</span></h2></div><p>Recently added to the shop.</p><Link href="/shop" className={styles.textLink}>All cards <span aria-hidden="true">↗</span></Link></div>
      {cards.length ? <div className={styles.grid}>{cards.slice(0, 4).map((card,index) => <Link key={card.id} href="/shop" className={styles.product}>
        <div className={styles.cardImage}><span className={styles.cardIndex}>GR / 00{index+1}</span><span className={styles.cardArtwork}><Image src={card.image_url} alt={card.name} fill sizes="(max-width: 640px) 45vw, 260px" /></span></div>
        <p className={styles.cardSet}>{card.set || 'Pokémon TCG'} / {card.language || 'English'}</p>
        <div className={styles.cardTitle}><h3>{card.name}</h3><span>£{(card.price / 100).toFixed(2)}</span></div>
      </Link>)}</div> : <div className={styles.empty}><div className={styles.emptyCard} aria-hidden="true"><span>GR</span><small>POKÉMON TCG</small></div><div><p className={styles.eyebrow}>THE COLLECTION</p><h3>{failed ? 'Unable to load cards' : 'No cards listed yet'}</h3><p>{failed ? 'We couldn’t load the collection. Try the shop again in a moment.' : 'No cards are listed right now. Check back for the next arrivals.'}</p><Link href="/shop" className={styles.textLink}>Browse the shop ↗</Link></div></div>}
    </section>
    <footer className={styles.footer}><div className={styles.footerWord}>GAY RETRO<span>TCG</span></div><div className={styles.footerBottom}><p>© {new Date().getFullYear()} Gay Retro TCG</p><span>Pokémon singles</span><Link href="/admin/scan">Seller studio ↗</Link></div></footer>
  </main>;
}
