import Link from 'next/link';
import CollectorDeck, { type DeckStock } from './CollectorDeck';
import styles from './WelcomeHeader.module.css';

export default function WelcomeHeader({ stock = [] }: { stock?: DeckStock[] }) {
  return <section className={styles.welcome} aria-labelledby="welcome-heading">
    <div className={styles.copy}>
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet="/gay-retro-3d-still.webp" />
        <img className={styles.logo} src="/gay-retro-3d.webp" alt="Gay Retro TCG" width="600" height="214" />
      </picture>
      <p className={`grt-wings ${styles.eyebrow}`}>Welcome to Gay Retro TCG</p>
      <h1 id="welcome-heading">Pokémon singles, <span className="grt-script">served with pride.</span></h1>
      <p className={styles.description}>English, Japanese and Korean cards, with photos of the actual card. Free UK postage when your cards total £30 or more.</p>
      <Link className={styles.browse} href="/shop">Browse cards <span aria-hidden="true">↗</span></Link>
    </div>
    <div className={styles.deck}><CollectorDeck compact stock={stock} /></div>
  </section>;
}
