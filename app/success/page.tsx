"use client";

import Link from 'next/link';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCart } from "@/components/CartProvider";
import styles from '../styles/SuccessPage.module.css';

function SuccessContent() {
  const rawSearchParams = useSearchParams();
  const searchParams = rawSearchParams ?? new URLSearchParams();

  const token = searchParams.get('token');
  const payerId = searchParams.get('PayerID');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { clearCart } = useCart();

  useEffect(() => {
    if (!token) {
      setError("Missing PayPal token.");
      setIsLoading(false);
      return;
    }

    async function finalizeCapture() {
      try {
        const res = await fetch(`/api/paypal-capture?token=${token}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Payment could not be completed. Please email gayretrotcg@gmail.com.");
        } else {
          clearCart();
        }
      } catch {
        setError("Unexpected error during payment finalisation.");
      } finally {
        setIsLoading(false);
      }
    }

    finalizeCapture();
  }, [token, clearCart]);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>FINALISING ORDER...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.errorIcon}>✕</p>
          <h1 className={styles.errorTitle}>ORDER ERROR</h1>
          <p className={styles.bodyText}>{error}</p>
          <Link href="/shop" className={styles.ctaBtn}>Return to Shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.successIcon} aria-hidden="true">★</div>
        <h1 className={styles.successTitle}>PAYMENT SUCCESSFUL!</h1>
        <p className={styles.bodyText}>
          Thank you for your order. We dispatch within 3–5 working days. Keep your PayPal receipt as proof of purchase.
        </p>
        {payerId && (
          <p className={styles.metaText}>Payer ID: <code className={styles.code}>{payerId}</code></p>
        )}
        <Link href="/shop" className={styles.ctaBtn}>Continue Shopping</Link>
        <p className={styles.bodyText}>Questions? <a href="mailto:gayretrotcg@gmail.com">gayretrotcg@gmail.com</a></p>
      </div>
      <div className={styles.rainbowBar} aria-hidden="true" />
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>LOADING...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
