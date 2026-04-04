import Link from "next/link";
import Image from "next/image";
import styles from "./styles/HomePage.module.css";

export default function HomePage() {
  return (
    <main className={styles.main}>
      {/* Background decorative orbs */}
      <div className={styles.orb1} aria-hidden="true" />
      <div className={styles.orb2} aria-hidden="true" />
      <div className={styles.orb3} aria-hidden="true" />

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.pixelRow} aria-hidden="true">
          {["★", "◆", "▲", "●", "◆", "▲", "★"].map((s, i) => (
            <span key={i} className={styles.pixelSymbol} style={{ animationDelay: `${i * 0.15}s` }}>{s}</span>
          ))}
        </div>

        <div className={styles.heroTitleWrapper}>
          <h1 className={styles.heroTitle}>GAY RETRO TCG</h1>
        </div>

        <p className={styles.heroTagline}>
          Rare cards. Loud colours. Zero apologies.
        </p>

        <div className={styles.bannerWrap}>
          <Image
            src="/hero-banner.png"
            alt="Gay Retro TCG — Mewtwo & Mew, Charizard, Pikachu & Zekrom GX"
            width={700}
            height={460}
            className={styles.bannerImage}
            priority
          />
        </div>

        <p className={styles.heroSub}>
          Hand-picked Pokémon cards for collectors who like their binders
          as colourful as their personality.
        </p>

        <div className={styles.ctaRow}>
          <Link href="/shop" className={styles.ctaPrimary}>
            Browse the Shop
          </Link>
          <Link href="/cart" className={styles.ctaSecondary}>
            View Cart
          </Link>
        </div>

        <div className={styles.pixelRow} aria-hidden="true">
          {["▼", "◇", "○", "▽", "◇", "○", "▼"].map((s, i) => (
            <span key={i} className={styles.pixelSymbol} style={{ animationDelay: `${(i + 7) * 0.15}s` }}>{s}</span>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className={styles.features}>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>✦</span>
          <h3 className={styles.featureTitle}>Authentic Cards</h3>
          <p className={styles.featureText}>
            Every card is verified and graded before listing. No fakes, no compromises.
          </p>
        </div>
        <div className={styles.featureCard} style={{ animationDelay: "0.1s" }}>
          <span className={styles.featureIcon}>◈</span>
          <h3 className={styles.featureTitle}>All Rarities</h3>
          <p className={styles.featureText}>
            Commons to Secret Rares, Holos to Promos — find whatever completes your deck.
          </p>
        </div>
        <div className={styles.featureCard} style={{ animationDelay: "0.2s" }}>
          <span className={styles.featureIcon}>⬡</span>
          <h3 className={styles.featureTitle}>Fast Dispatch</h3>
          <p className={styles.featureText}>
            Orders packed with care and shipped quickly. Your new favourites are on their way.
          </p>
        </div>
      </section>

      {/* CTA strip */}
      <section className={styles.ctaStrip}>
        <p className={styles.ctaStripText}>Ready to find your next favourite card?</p>
        <Link href="/shop" className={styles.ctaPrimary}>
          Shop Now →
        </Link>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        © {new Date().getFullYear()} GAY RETRO TCG. All Rights Reserved.
      </footer>
    </main>
  );
}
