import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import WelcomeHeader from '@/components/WelcomeHeader';
import ListingBanner from '@/components/ListingBanner';
import SiteFooter from '@/components/SiteFooter';
import styles from './styles/HomePage.module.css';
import { pageMetadata } from '@/lib/page-metadata';
import {listingArtwork} from '@/lib/card-artwork';
import CardTilt from '@/components/CardTilt';
import AddToCartButton from '@/components/AddToCartButton';
import { weeklyPick } from '@/lib/home-picks';
import { FREE_POSTAGE_PENCE } from '@/lib/shipping';
import { VINTED_PROOF } from '@/lib/seller-proof';
export const generateMetadata = () => pageMetadata('/');
export const dynamic = 'force-dynamic';
type Arrival = { id: string; name: string; image_url: string; price: number; set: string | null; language: string | null; condition: string | null; edition: string | null; front_image_url: string | null };
async function getArrivals(): Promise<{ cards: Arrival[]; failed: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { cards: [], failed: true };
  try {
    const { data, error } = await createClient(url, key).from('Card').select('id,name,image_url,price,set,language,condition,edition,front_image_url').eq('available', true).not('image_url', 'is', null).order('createdAt', { ascending: false }).limit(60);
    return { cards: (data ?? []).map(card=>({...card,image_url:listingArtwork(card)})), failed: !!error };
  } catch { return { cards: [], failed: true }; }
}
const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;
export default async function HomePage() {
  const { cards, failed } = await getArrivals();
  const pick = weeklyPick(cards);
  const buyable = (card: Arrival) => ({ id: card.id, name: card.name, price: card.price, imageUrl: card.image_url, condition: card.condition, edition: card.edition });
  return <main id="main-content" className={styles.main}>
    <div className={styles.hero}><WelcomeHeader stock={cards.filter(card => card.image_url !== '/placeholder.png').slice(0, 7).map(card => ({ id: card.id, name: card.name, set: card.set, language: card.language, price: card.price, image: card.image_url }))} /></div>
    <ListingBanner cards={cards.slice(0, 12)} failed={failed} />
    {pick && <section className={styles.pick} aria-labelledby="mew-pick-heading">
      <div className={styles.pickInner}>
        <div className={styles.pickCopy}>
          <p className="grt-wings">Mew’s pick of the week</p>
          <h2 id="mew-pick-heading" className="grt-script">{pick.name}</h2>
          <p className={styles.pickMeta}>{[pick.set || 'Pokémon TCG', pick.language, pick.condition].filter(Boolean).join(' · ')}</p>
          <div className={styles.pickBuy}><span className="grt-tag">{money(pick.price)}</span><AddToCartButton card={buyable(pick)} className={styles.pickButton} /><Link href={`/cards/${encodeURIComponent(pick.id)}`} className={styles.textLink}>View card <span aria-hidden="true">↗</span></Link></div>
          <p className={styles.pickNote}>Mew chooses a different card from the shop every Monday.</p>
        </div>
        <div className={styles.pickStage}>
          <img className={styles.pickMew} src="/mew-floating-padded-still.png" width="192" height="192" alt="" />
          <Link href={`/cards/${encodeURIComponent(pick.id)}`} className={styles.pickCard} aria-label={`View ${pick.name}`}><CardTilt><Image src={pick.image_url} alt={`${pick.name} — catalogue artwork`} width={420} height={588} sizes="(max-width: 640px) 60vw, 300px" /></CardTilt></Link>
        </div>
      </div>
    </section>}
    <section id="latest-cards" className={styles.arrivals}>
      <div className={styles.sectionHeading}><div><p className="grt-wings">Fresh in the shop</p><h2 className="grt-script">Latest cards</h2></div><p>The newest cards on the shelf. Each one is a single card, so once it’s gone, it’s gone.</p><Link href="/shop" className={styles.textLink}>All cards <span aria-hidden="true">↗</span></Link></div>
      {cards.length ? <div className={styles.grid}>{cards.slice(0, 8).map(card => <Link key={card.id} href={`/cards/${encodeURIComponent(card.id)}`} className={styles.product}>
        <div className={styles.cardImage}>{card.front_image_url && <span className={styles.cardIndex}>Real photo inside</span>}<CardTilt className={styles.cardArtwork}><Image src={card.image_url} alt={card.name} fill sizes="(max-width: 640px) 45vw, 260px" /></CardTilt></div>
        <p className={styles.cardSet}>{card.set || 'Pokémon TCG'} / {card.language || 'English'}</p>
        <div className={styles.cardTitle}><h3>{card.name}</h3><span className="grt-tag small">{money(card.price)}</span></div>
      </Link>)}</div> : <div className={styles.empty}><div className={styles.emptyCard} aria-hidden="true"><span>GR</span><small>POKÉMON TCG</small></div><div><p className={styles.eyebrow}>THE COLLECTION</p><h3>{failed ? 'Unable to load cards' : 'No cards listed yet'}</h3><p>{failed ? 'We couldn’t load the collection. Try the shop again in a moment.' : 'No cards are listed right now. Check back for the next arrivals.'}</p><Link href="/shop" className={styles.textLink}>Browse the shop ↗</Link></div></div>}
    </section>
    <section className={styles.postage} aria-label="Postage offer">
      <p><strong>Free UK postage over {money(FREE_POSTAGE_PENCE).replace('.00', '')}.</strong> Under that it’s one £4.50 charge per order, however many cards you add.</p>
      <Link href="/shop">Fill a parcel <span aria-hidden="true">↗</span></Link>
    </section>
    <section className={styles.counter} aria-labelledby="counter-heading">
      <div className={styles.counterInner}>
        <div>
          <p className="grt-wings on-cream">Behind the counter</p>
          <h2 id="counter-heading" className="grt-script on-cream">A small shop for people who love cards</h2>
        </div>
        <div className={styles.counterCopy}>
          <p>Gay Retro TCG is a small UK shop selling Pokémon singles in English, Japanese and Korean. Every listing states the card’s condition, and where you see a real photo you’re looking at the exact card you’ll receive.</p>
          <p>Orders are packed carefully and posted from the UK with Royal Mail tracking. We’ve been selling cards on Vinted since {VINTED_PROOF.since}; this shop is the same stock, sold direct.</p>
          <dl className={styles.proof}>
            <div><dt>{VINTED_PROOF.reviews}</dt><dd>reviews on Vinted</dd></div>
            <div><dt>{VINTED_PROOF.rating}<small> / 5</small></dt><dd>average rating</dd></div>
            <div><dt>{VINTED_PROOF.since}</dt><dd>selling since</dd></div>
          </dl>
          <p className={styles.proofNote}><a href={VINTED_PROOF.url} target="_blank" rel="noopener noreferrer">Read our Vinted reviews ↗</a> Figures checked {VINTED_PROOF.checked}.</p>
        </div>
      </div>
    </section>
    <div className={styles.footer}><SiteFooter /></div>
  </main>;
}
