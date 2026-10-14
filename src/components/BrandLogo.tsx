import styles from './BrandLogo.module.css';

export default function BrandLogo() {
  return <span className={styles.logo} aria-hidden="true">
    <img src="/brand-mark.svg" width="44" height="50" alt="" />
    <span className={styles.wordmark}>GAY RETRO<span>TCG</span></span>
  </span>;
}
