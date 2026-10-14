import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
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
      <div><p className={styles.eyebrow}>✳ Pokémon cards. A little more personality.</p>
        <h1>Serious cards.<br /><em>Colourful</em><br />collectors.</h1>
        <p className={styles.intro}>For the chase cards, the binder favourites, and the ones you just have to have. Welcome to Gay Retro TCG.</p>
        <Link href="/shop" className={styles.button}>Find your next favourite ↗</Link>
        <p className={styles.caption}>English · Japanese · Korean</p>
      </div>
      <div className={styles.heroArt}>
        <span className={styles.artLabel}>THE COLLECTOR’S CLUB / EST. 2025</span>
        <span className={styles.orbit} aria-hidden="true" />
        <Image src="/hero-banner.png" alt="Mewtwo & Mew, Charizard, and Pikachu & Zekrom Pokémon cards" width={700} height={460} priority className={styles.banner} />
        <div className={styles.artFoot}><span>Rare cards. Zero apologies.</span><span aria-hidden="true">✳</span></div>
      </div>
    </section>
    <div className={styles.ribbon} aria-hidden="true"><span>GOOD CARDS.</span><span>GREAT COMPANY.</span><span>GAY RETRO.</span><span>GOOD CARDS.</span></div>
    <section className={styles.arrivals}>
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Fresh to the binder</p><h2>The latest finds.</h2></div><Link href="/shop">Explore the shop ↗</Link></div>
      {cards.length ? <div className={styles.grid}>{cards.map(card => <Link key={card.id} href="/shop" className={styles.card}>
        <div className={styles.cardImage}><Image src={card.image_url} alt={card.name} fill sizes="(max-width: 640px) 45vw, 260px" /></div>
        <p className={styles.cardSet}>{card.set || 'Pokémon TCG'} · {card.language || 'English'}</p>
        <div className={styles.cardTitle}><h3>{card.name}</h3><span>£{(card.price / 100).toFixed(2)}</span></div>
      </Link>)}</div> : <div className={styles.empty}><span aria-hidden="true">✳</span><div><h3>{failed ? 'The binder is taking a moment.' : 'A new chapter for the collection.'}</h3><p>{failed ? 'We couldn’t load the latest cards. Try the shop or check back shortly.' : 'There are no cards listed right now. Check back for the next arrivals.'}</p></div><Link href="/shop">Visit the shop ↗</Link></div>}
    </section>
    <section className={styles.about}><p className={styles.eyebrow}>A place for your kind of collecting</p><h2>Your binder.<br />Your taste.<br /><em>Your people.</em></h2><div><p>Some of us chase the rarest pull. Some of us collect every Pikachu. Some just love a beautiful card.</p><p>However you collect, you’re welcome here. Pokémon cards with a love of colour, nostalgia and being yourself.</p><Link href="/shop" className={styles.button}>Make room in your binder ↗</Link></div></section>
    <footer className={styles.footer}><span>GAY RETRO TCG</span><p>© {new Date().getFullYear()} Gay Retro TCG</p><Link href="/admin/scan">Seller studio ↗</Link></footer>
  </main>;
}
