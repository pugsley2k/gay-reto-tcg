'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from './CartProvider';
import { MEW_CODE } from '@/lib/promo';
import styles from './FoilHome.module.css';

/** The quiet line for the gift code. Applies it to the cart, as the floating Mew does elsewhere. */
export default function FoilGift() {
  const { setPromoCode, isReady, promoCode } = useCart();
  const [applied, setApplied] = useState(false);
  const active = applied || promoCode === MEW_CODE;
  return <p className={styles.giftLine}>
    <span><strong>{MEW_CODE}</strong> takes 5% off cards. Delivery excluded.</span>
    {active
      ? <span role="status">Applied. <Link className={styles.textLink} href="/cart">View cart <span aria-hidden="true">↗</span></Link></span>
      : <button type="button" className={styles.textLink} disabled={!isReady} onClick={() => { setPromoCode(MEW_CODE); setApplied(true); }}>Apply {MEW_CODE} <span aria-hidden="true">↗</span></button>}
  </p>;
}
