"use client";

import Link from 'next/link';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCart } from "@/components/CartProvider";

function SuccessContent() {
  const rawSearchParams = useSearchParams();
  const searchParams = rawSearchParams ?? new URLSearchParams();

  const token = searchParams.get('token');
  const payerId = searchParams.get('PayerID');
  const paymentId = searchParams.get('paymentId');

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
          console.error("❌ Capture failed:", data);
          setError("Payment capture failed. Please contact support.");
        } else {
          // ✅ Clear cart only after confirmed successful payment
          clearCart();
        }
      } catch (err) {
        console.error("🔥 Capture error:", err);
        setError("Unexpected error during payment finalization.");
      } finally {
        setIsLoading(false);
      }
    }

    finalizeCapture();
  }, [token, clearCart]);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', fontFamily: 'Inter, sans-serif' }}>
        <p>Finalizing your PayPal order...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', fontFamily: 'Inter, sans-serif', color: 'red' }}>
        <h1>Order Confirmation Error</h1>
        <p>{error}</p>
        <Link href="/shop" style={{ display: 'inline-block', marginTop: '20px', color: '#0070f3' }}>
          Return to Shop
        </Link>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '50px', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ color: '#4CAF50', fontSize: '2.5rem', marginBottom: '20px' }}>Payment Successful!</h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Thank you for your order via PayPal.</p>
      <p style={{ marginBottom: '30px', color: '#555' }}>
        Your confirmation and order details will be sent to your email shortly.
        {payerId && <><br />Payer ID: <code style={{ background: '#f0f0f0', padding: '2px 4px', borderRadius: '4px' }}>{payerId}</code></>}
        {paymentId && <><br />Payment ID: <code style={{ background: '#f0f0f0', padding: '2px 4px', borderRadius: '4px' }}>{paymentId}</code></>}
      </p>
      <Link href="/shop" style={{
        display: 'inline-block',
        padding: '12px 25px',
        backgroundColor: '#FF007F',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '8px',
        fontWeight: 'bold',
        fontSize: '1rem',
        transition: 'background-color 0.2s ease'
      }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e00070'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#FF007F'}
      >
        Continue Shopping
      </Link>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px', fontFamily: 'Inter, sans-serif' }}>Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
