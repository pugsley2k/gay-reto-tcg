import styles from './BrandLogo.module.css';

export default function BrandLogo() {
  return <span className={styles.logo} aria-hidden="true">
    <img src="/gay-retro-flat.webp" width="960" height="324" alt="" />
  </span>;
}
