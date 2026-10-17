import Link from 'next/link';
import styles from './SiteFooter.module.css';
import BrandLogo from './BrandLogo';

export default function SiteFooter() {
  return <footer className={styles.footer}>
    <p>© {new Date().getFullYear()} Gay Retro TCG</p>
    <Link href="/" className={styles.logo} aria-label="Gay Retro TCG home">
      <BrandLogo footer />
    </Link>
    <nav className={styles.links} aria-label="Customer information"><Link href="/delivery">Delivery</Link><Link href="/returns">Returns</Link><Link href="/contact">Contact</Link><Link href="/admin/scan">Seller studio ↗</Link></nav>
  </footer>;
}
