// src/components/Navbar.tsx
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import styles from './Navbar.module.css';
import { useCart } from '@/components/CartProvider';
import { UserButton, useUser } from "@clerk/nextjs";

export default function Navbar() {
  const pathname = usePathname();
  const { cart } = useCart();
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  // Prevent scroll when menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice    = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const navLinks = [
    { href: "/",      label: "Home"  },
    { href: "/shop",  label: "Shop"  },
  ];

  return (
    <>
      <nav className={styles.navbar}>
        <Link href="/" className={styles.logoLink} aria-label="GAY RETRO TCG Home">
          <div className={styles.logoContainer}>
            <img src="/logo.png" alt="GR" className={styles.logoImg} />
            <span className={styles.logoText}>GAY RETRO TCG</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <ul className={styles.navList}>
          {navLinks.map(link => (
            <li key={link.href} className={styles.navItem}>
              <Link href={link.href} className={`${styles.navLink} ${pathname === link.href ? styles.navLinkActive : ''}`}>
                {link.label}
              </Link>
            </li>
          ))}
          <li className={styles.navItem}>
            <Link href="/cart" className={`${styles.navLink} ${pathname === "/cart" ? styles.navLinkActive : ''}`}>
              Cart
              {totalQuantity > 0 && (
                <span className={styles.cartQuantityBadge}>{totalQuantity}</span>
              )}
              {totalPrice > 0 && (
                <span className={styles.cartTotal}>£{(totalPrice / 100).toFixed(2)}</span>
              )}
            </Link>
          </li>
          {user?.publicMetadata?.role === 'admin' && (
            <li className={styles.navItem}>
              <Link href="/admin" className={`${styles.navLink} ${pathname === "/admin" ? styles.navLinkActive : ''}`}>
                Admin
              </Link>
            </li>
          )}
          <li className={styles.navItem}>
            {user ? <UserButton /> : <Link href="/sign-in" className={styles.navLink}>Sign In</Link>}
          </li>
        </ul>

        {/* Mobile right side: cart badge + hamburger */}
        <div className={styles.mobileRight}>
          <Link href="/cart" className={`${styles.navLink} ${styles.mobileCartLink}`}>
            Cart
            {totalQuantity > 0 && <span className={styles.cartQuantityBadge}>{totalQuantity}</span>}
            {totalPrice > 0 && <span className={styles.cartTotal}>£{(totalPrice / 100).toFixed(2)}</span>}
          </Link>
          <button
            className={styles.hamburger}
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span className={`${styles.hamburgerLine} ${menuOpen ? styles.hamburgerLineTop : ''}`} />
            <span className={`${styles.hamburgerLine} ${menuOpen ? styles.hamburgerLineMid : ''}`} />
            <span className={`${styles.hamburgerLine} ${menuOpen ? styles.hamburgerLineBot : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className={styles.mobileOverlay} onClick={() => setMenuOpen(false)}>
          <div className={styles.mobileMenu} onClick={e => e.stopPropagation()}>
            {navLinks.map(link => (
              <Link key={link.href} href={link.href}
                className={`${styles.mobileLink} ${pathname === link.href ? styles.mobileLinkActive : ''}`}
                onClick={() => setMenuOpen(false)}>
                {link.label}
              </Link>
            ))}
            <Link href="/cart" className={`${styles.mobileLink} ${pathname === "/cart" ? styles.mobileLinkActive : ''}`}
              onClick={() => setMenuOpen(false)}>
              Cart {totalQuantity > 0 && `(${totalQuantity})`}
              {totalPrice > 0 && <span className={styles.mobilePriceTag}>£{(totalPrice / 100).toFixed(2)}</span>}
            </Link>
            {user?.publicMetadata?.role === 'admin' && (
              <Link href="/admin" className={`${styles.mobileLink} ${pathname === "/admin" ? styles.mobileLinkActive : ''}`}
                onClick={() => setMenuOpen(false)}>
                Admin
              </Link>
            )}
            <div className={styles.mobileAuthRow}>
              {user ? <UserButton /> : <Link href="/sign-in" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Sign In</Link>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
