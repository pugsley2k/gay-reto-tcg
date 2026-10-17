import styles from './BrandLogo.module.css';

export default function BrandLogo({ footer = false }: { footer?: boolean }) {
  return <span className={`${styles.logo} ${footer ? styles.footer : styles.header}`} aria-hidden="true" data-brand-logo={footer ? 'footer' : 'header'}>
    <img src="/gay-retro-flat.webp" width="960" height="324" alt="" />
  </span>;
}
