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
          <svg width="28" height="36" viewBox="0 0 6 8" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: 'pixelated' }} aria-hidden="true" className={styles.logoPixel}>
            <rect fill="#FF3E6C" x="0" y="0" width="6" height="1"/>
            <rect fill="#FF8C42" x="0" y="1" width="6" height="1"/>
            <rect fill="#FFD166" x="0" y="2" width="6" height="1"/>
            <rect fill="#06D6A0" x="0" y="3" width="6" height="1"/>
            <rect fill="#118AB2" x="0" y="4" width="6" height="2"/>
            <rect fill="#B84FFF" x="0" y="6" width="6" height="2"/>
            <rect fill="#080810" x="1" y="1" width="4" height="6" opacity="0.65"/>
            <rect fill="#FFFFFF" x="2" y="3" width="2" height="2" opacity="0.9"/>
          </svg>
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

