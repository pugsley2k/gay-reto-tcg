import Link from 'next/link';
import styles from './SiteFooter.module.css';

export default function SiteFooter() {
  return <footer className={styles.footer}>
    <p>© {new Date().getFullYear()} Gay Retro TCG</p>
    <Link href="/" className={styles.logo} aria-label="Gay Retro TCG home">
      <img src="/gay-retro-flat.webp" alt="" width="180" height="61" loading="lazy" />
    </Link>
    <Link href="/admin/scan" className={styles.seller}>Seller studio ↗</Link>
  </footer>;
}
