import Link from 'next/link';
import CollectorDeck from './CollectorDeck';
import styles from './WelcomeHeader.module.css';
import FloatingMew from './FloatingMew';

export default function WelcomeHeader() {
  return <section className={styles.welcome} aria-labelledby="welcome-heading">
    <FloatingMew />
    <div className={styles.copy}>
      <img className={styles.logo} src="/gay-retro-flat.webp" alt="Gay Retro TCG" width="960" height="324" />
      <p className={styles.eyebrow}>Welcome to Gay Retro TCG</p>
      <h1 id="welcome-heading">Find your next <span>Pokémon card.</span></h1>
      <p className={styles.description}>Pokémon singles in English, Japanese and Korean.</p>
      <Link className={styles.browse} href="/shop">Browse cards <span aria-hidden="true">↗</span></Link>
    </div>
    <div className={styles.deck}><CollectorDeck compact /></div>
  </section>;
}
