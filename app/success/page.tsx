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
  const [pending, setPending] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const { clearCart } = useCart();

  useEffect(() => {
    let active = true;
    if (!token) {
      setError("Missing PayPal token.");
      setIsLoading(false);
      return;
    }

    async function finalizeCapture() {
      setIsLoading(true); setError(null); setPending(null);
      try {
        const res = await fetch('/api/paypal-capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(data.error || "Payment could not be completed. Please email gayretrotcg@gmail.com.");
        } else if (data.success) {
          clearCart();
          try { sessionStorage.removeItem('grt-checkout-attempt'); } catch { /* Payment is confirmed even when browser storage is disabled. */ }
        } else {
          setPending(data.message || 'Payment is still being checked. Please do not pay again.');
          if (data.paid) { clearCart(); try { sessionStorage.removeItem('grt-checkout-attempt'); } catch { /* Storage is optional. */ } }
        }
      } catch {
        if (active) setPending("We could not confirm the payment result. Check again here; please do not pay again.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    finalizeCapture();
    return () => { active = false; };
  }, [token, clearCart, attempt]);

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

  if (pending) return <div className={styles.page}><div className={styles.card}><h1 className={styles.successTitle}>Checking your order</h1><p className={styles.bodyText} role="status">{pending}</p><button type="button" className={styles.ctaBtn} onClick={() => setAttempt(value => value + 1)}>Check payment status</button><p className={styles.bodyText}>Need help? <a href="mailto:gayretrotcg@gmail.com">Contact the shop</a>.</p></div></div>;
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
