import styles from './BrandLogo.module.css';

export default function BrandLogo() {
  return <span className={styles.logo} aria-hidden="true">
    <img src="/brand-wordmark.svg" width="520" height="126" alt="" />
  </span>;
}
