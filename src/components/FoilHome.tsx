import Link from 'next/link';
import styles from './FoilHome.module.css';
import FoilStage from './FoilStage';
import FoilGift from './FoilGift';
import FoilBuy from './FoilBuy';
import SiteFooter from './SiteFooter';
import CardArtwork from './CardArtwork';
import { listingArtwork } from '@/lib/card-artwork';
import { gradingLabel } from '@/lib/card-grading';
import { productPath, type ProductCard } from '@/lib/products';

const price = (pennies: number) => `£${(pennies / 100).toFixed(2)}`;
// Listing artwork goes through the image optimiser so the canvas can use it as a same-origin texture.
const texture = (url: string) => (url.startsWith('/') ? url : `/_next/image?url=${encodeURIComponent(url)}&w=640&q=80`);
const SHOWCASE = '/showcase-mew.png';

// A listing the canvas can draw as a foil card: real catalogue artwork, not a graded slab.
const drawable = (card: ProductCard) => !card.grading && listingArtwork(card) !== '/placeholder.png';
const sceneCard = (card: ProductCard) => (drawable(card) ? { img: texture(listingArtwork(card)), finish: card.holo_type || '' } : null);

function Listing({ card, slot }: { card: ProductCard; slot: number }) {
  return <li className={styles.listing}>
    <Link href={productPath(card.id)} className={styles.art} aria-label={`View ${card.name}`} data-foil-slot={drawable(card) ? slot : undefined}><CardArtwork card={card} compact lazy /></Link>
    <p className={styles.set}>{card.set || 'Pokémon TCG'}{card.number ? ` · #${card.number}` : ''}</p>
    <h3><Link href={productPath(card.id)}>{card.name}</Link></h3>
    <p className={styles.detail}>{card.language || 'Language not specified'} · {gradingLabel(card.grading) || card.condition || 'Condition not specified'}</p>
    <div className={styles.buy}><strong>{price(card.price)}</strong><FoilBuy card={{ id: card.id, name: card.name, price: card.price, imageUrl: listingArtwork(card), condition: card.condition, edition: card.edition }} /></div>
  </li>;
}

export default function FoilHome({ cards, failed }: { cards: ProductCard[]; failed: boolean }) {
  // The hero card is a real listing; the showcase artwork stands in only when nothing is listed.
  // Every card the canvas draws is a listing on this page, in the tile that sells it.
  const data = { cards: cards.slice(0, 8).map(sceneCard), fallback: SHOWCASE };
  return <main id="main-content" className={styles.main}>
    <FoilStage />
    <script type="application/json" data-foil-cards="" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />

    <section className={`${styles.section} ${styles.hero}`} data-foil="hero" aria-labelledby="foil-hero">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>Gay Retro TCG <span>/</span> Pokémon singles</p>
        <h1 id="foil-hero" className={styles.sheen}>Find your next <span>Pokémon card.</span></h1>
        <p className={styles.lede}>Singles in English, Japanese and Korean, sent from the UK.</p>
        <form className={styles.search} action="/shop" method="get" role="search">
          <label htmlFor="home-search">Pokémon or card name</label>
          <div><input id="home-search" type="search" name="search" placeholder="Search Charizard, Pikachu…" maxLength={200} /><button type="submit">Search <span aria-hidden="true">↗</span></button></div>
        </form>
        <p className={styles.actions}><Link className={styles.textLink} href="/shop">Browse all cards <span aria-hidden="true">↗</span></Link><a className={styles.textLink} href="#latest-cards">Latest cards <span aria-hidden="true">↓</span></a></p>
      </div>
    </section>

    <div className={styles.shop} data-foil="shop">
      <section id="latest-cards" className={styles.band} aria-labelledby="home-latest">
        <header className={styles.bandHead}>
          <div><p className={styles.eyebrow}>The collection</p><h2 id="home-latest">Latest <span>cards</span></h2></div>
          <p className={styles.note}>Recently added to the shop.</p>
          <Link className={styles.textLink} href="/shop">All cards <span aria-hidden="true">↗</span></Link>
        </header>
        {cards.length ? <ul className={styles.grid}>{cards.slice(0, 8).map((card, index) => <Listing key={card.id} card={card} slot={index} />)}</ul>
          : <div className={styles.empty}><h3>{failed ? 'Unable to load cards' : 'No cards listed yet'}</h3><p>{failed ? 'We couldn’t load the collection. Try the shop again in a moment.' : 'No cards are listed right now. Check back for the next arrivals.'}</p><Link className={styles.textLink} href="/shop">Browse the shop <span aria-hidden="true">↗</span></Link></div>}
      </section>

      <section className={`${styles.band} ${styles.info}`} data-foil="post" aria-labelledby="home-post">
        <div className={styles.infoCopy} data-foil-stick="">
        <p className={styles.eyebrow} data-fade="">Delivery and returns</p><h2 id="home-post" data-fade="">Posted from <span>the UK</span></h2>
        <dl className={styles.terms} data-fade="">
          <div><dt>Dispatch</dt><dd>Within 3–5 working days of payment.</dd></div>
          <div><dt>Where</dt><dd>UK addresses only, including Northern Ireland.</dd></div>
          <div><dt>Tracked 48</dt><dd>£4.50. Usually 2–3 working days after dispatch. Orders up to £75.</dd></div>
          <div><dt>Tracked 24</dt><dd>£5.75. Aims for the next working day. Orders up to £75.</dd></div>
          <div><dt>Special Delivery</dt><dd>From £11.95. Used for orders over £75.</dd></div>
          <div><dt>Returns</dt><dd>Changed your mind? Tell us within 14 days after delivery. You then have 14 more to send the cards back.</dd></div>
        </dl>
        <p className={styles.links} data-fade=""><Link className={styles.textLink} href="/delivery">Delivery in full <span aria-hidden="true">↗</span></Link><Link className={styles.textLink} href="/returns">Returns in full <span aria-hidden="true">↗</span></Link></p>
        </div>
      </section>

      <div data-foil="end">
      <div className={styles.gift}><FoilGift /></div>
      {/* the same footer as every other page */}
      <SiteFooter />
      </div>
    </div>
  </main>;
}
