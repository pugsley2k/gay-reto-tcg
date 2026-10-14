import styles from './BrandLogo.module.css';

export default function BrandLogo() {
  return <span className={styles.logo} aria-hidden="true">
    <img src="/gay-retro-logo.webp" width="640" height="524" alt="" />
  </span>;
}
