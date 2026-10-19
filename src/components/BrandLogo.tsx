import styles from './BrandLogo.module.css';
import brandAssets from '@/lib/brand-assets.json';

export default function BrandLogo({ footer = false }: { footer?: boolean }) {
  return <span className={`${styles.logo} ${footer ? styles.footer : styles.header}`} aria-hidden="true" data-brand-logo={footer ? 'footer' : 'header'}>
    <img src={brandAssets.logo} width="960" height="324" alt="" />
  </span>;
}
