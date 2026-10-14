import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import CollectorDeck from '@/components/CollectorDeck';
import styles from './styles/HomePage.module.css';
export const dynamic = 'force-dynamic';
async function getArrivals() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { cards: [], failed: true };
  try {
    const { data, error } = await createClient(url, key).from('Card').select('id,name,image_url,price,set,language').eq('available', true).not('image_url', 'is', null).order('createdAt', { ascending: false }).limit(4);
    return { cards: data ?? [], failed: !!error };
  } catch { return { cards: [], failed: true }; }
}
export default async function HomePage() {
  const { cards, failed } = await getArrivals();
  return <main id="main-content" className={styles.main}>
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}><span className={styles.signal} /> INDEPENDENT POKÉMON CARD SHOP / EVERYONE’S INVITED</p>
        <h1>GAY.<br /><span>RETRO.</span><br />OBSESSED.</h1>
        <div className={styles.heroBottom}><p>For the art. For the nostalgia.<br />For that one card you can’t stop thinking about.</p><Link href="/shop" className={styles.button}>Find your next obsession <span aria-hidden="true">↗</span></Link></div>
        <div className={styles.heroNote}><span>Pokémon singles</span><span>English / Japanese / Korean</span></div>
      </div>
      <CollectorDeck />
    </section>
    <div className={styles.ticker}><div className={styles.tickerTrack} aria-hidden="true">{[0,1].map(i=><span key={i}>RARE CARDS <b>✳</b> LOUD COLOURS <b>✳</b> ZERO APOLOGIES <b>✳</b> GAY RETRO TCG <b>✳</b> </span>)}</div><span className={styles.srOnly}>Rare cards. Loud colours. Zero apologies.</span></div>
    <section className={styles.arrivals}>
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / THE GOOD STUFF</p><h2>Fresh to the<br /><span>binder.</span></h2></div><p>Little works of art.<br />Big collector energy.</p><Link href="/shop" className={styles.textLink}>All cards <span aria-hidden="true">↗</span></Link></div>
      {cards.length ? <div className={styles.grid}>{cards.map((card,index) => <Link key={card.id} href="/shop" className={styles.product}>
        <div className={styles.cardImage}><span className={styles.cardIndex}>GR / 00{index+1}</span><Image src={card.image_url} alt={card.name} fill sizes="(max-width: 640px) 45vw, 260px" /></div>
        <p className={styles.cardSet}>{card.set || 'Pokémon TCG'} / {card.language || 'English'}</p>
        <div className={styles.cardTitle}><h3>{card.name}</h3><span>£{(card.price / 100).toFixed(2)}</span></div>
      </Link>)}</div> : <div className={styles.empty}><div className={styles.emptyCard} aria-hidden="true"><span>GR</span><small>NEXT DROP</small></div><div><p className={styles.eyebrow}>A LITTLE BREATHING ROOM IN THE BINDER</p><h3>{failed ? 'The cards are playing hard to get.' : 'The next obsession is on its way.'}</h3><p>{failed ? 'We couldn’t load the collection. Try the shop again in a moment.' : 'No cards are listed right now. Check back for the next arrivals.'}</p><Link href="/shop" className={styles.textLink}>Check the collection ↗</Link></div></div>}
    </section>
    <section className={styles.manifesto}>
      <div className={styles.manifestoTop}><p className={styles.eyebrow}>02 / THIS IS OUR KIND OF COLLECTING</p><span>NO GATEKEEPING. JUST GOOD CARDS.</span></div>
      <h2>Not everyone<br />gets <em>the obsession.</em><br /><span>We do.</span></h2>
      <div className={styles.manifestoBottom}><span className={styles.clubSeal} aria-hidden="true">GAY RETRO<br /><b>TCG</b><br />COLLECTOR’S CLUB</span><p>Chasing your childhood favourite? Filling the last gap in a set? Buying it because it’s pink?<br /><br />All excellent reasons. Collect what you love. There’s room for you here.</p><Link href="/shop" className={styles.button}>Welcome to the club ↗</Link></div>
    </section>
    <footer className={styles.footer}><div className={styles.footerWord}>GAY RETRO<span>TCG</span></div><div className={styles.footerBottom}><p>© {new Date().getFullYear()} Gay Retro TCG</p><span>CARDBOARD. COLOUR. COMMUNITY.</span><Link href="/admin/scan">Seller studio ↗</Link></div></footer>
  </main>;
}
