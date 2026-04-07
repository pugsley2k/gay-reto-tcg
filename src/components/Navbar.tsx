// src/components/Navbar.tsx
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css'; // Your Navbar styles
import { useCart } from '@/components/CartProvider';
import { UserButton, useUser } from "@clerk/nextjs"; // Import useUser

export default function Navbar() {
  const pathname = usePathname();
  const { cart } = useCart();
  const { user } = useUser(); // Get the current user object from Clerk

  const totalCartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Check if the current user is an admin
  // This assumes you're setting publicMetadata: { role: 'admin' } in Clerk for admin users
  const isAdmin = user?.publicMetadata?.role === 'admin';

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
  ];

  return (
    <nav className={styles.navbar}>
      <Link href="/" className={styles.logoLink} aria-label="GAY RETRO TCG Home">
        <div className={styles.logoContainer}>
          <img src="/favicon.png" alt="" aria-hidden="true" className={styles.logoPixel} style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <span className={styles.logoText}>GAY RETRO TCG</span>
        </div>
      </Link>
      <ul className={styles.navList}>
        {navLinks.map((link) => (
          <li key={link.href} className={styles.navItem}>
            <Link href={link.href} className={`${styles.navLink} ${pathname === link.href ? styles.navLinkActive : ''}`}>
              {link.label}
            </Link>
          </li>
        ))}
        <li className={styles.navItem}>
          <Link href="/cart" className={`${styles.navLink} ${pathname === "/cart" ? styles.navLinkActive : ''}`}>
            Cart
            {totalCartQuantity > 0 && (
              <span className={styles.cartQuantityBadge}>{totalCartQuantity}</span>
            )}
          </Link>
        </li>

        {user?.publicMetadata?.role === 'admin' && (
          <li className={styles.navItem}>
            <Link
              href="/admin"
              className={`${styles.navLink} ${pathname === "/admin" ? styles.navLinkActive : ''}`}
            >
              Admin
            </Link>
          </li>
        )}


        {/* Clerk Authentication Controls */}
        <li className={styles.navItem}>
          {user
            ? <UserButton />
            : <Link href="/sign-in" className={styles.navLink}>Sign In</Link>
          }
        </li>
      </ul>
    </nav>
  );
}

