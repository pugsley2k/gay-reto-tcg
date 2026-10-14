"use client";
import { useCart } from "@/components/CartProvider";
import { useRouter } from "next/navigation";
import Image from "next/image";
import SiteFooter from '@/components/SiteFooter';
import { useState } from "react";
import styles from "../styles/CartPage.module.css";

const MINIMUM_SPEND_PENCE = 30;

export default function CartPage() {
  const { cart, removeFromCart } = useCart();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const totalPrice = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const isBelowMinimumSpend = totalPrice < MINIMUM_SPEND_PENCE;

  async function handleCheckout() {
    if (isBelowMinimumSpend) {
      setCheckoutError(`Minimum spend is £${(MINIMUM_SPEND_PENCE / 100).toFixed(2)}.`);
      return;
    }

    const lineItems = cart.map(item => ({
      price_data: {
        currency: "GBP",
        product_data: {
          name: item.name,
          images: [item.imageUrl],
        },
        unit_amount: item.price,
      },
      quantity: item.quantity,
      cardId: item.id,
    }));

    try {
      setCheckoutError('');
      setIsLoading(true);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Checkout failed. Please try again.');
      const { url } = result;

      if (url) {
        window.location.href = url;
        // cart clearing handled post-checkout
      } else {
        setCheckoutError('Could not start checkout. Please try again.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      setCheckoutError(error instanceof Error ? error.message : 'Checkout failed. Please try again.');
      setIsLoading(false);
    }
  }

  if (cart.length === 0) {
    return (
      <main id="main-content" className={styles.pageContainer}>
        <div className={styles.emptyCartContainer}>
          <h1 className={styles.emptyCartTitle}>Your cart is empty</h1>
          <p className={styles.emptyCartText}>Browse the shop to add cards to your cart.</p>
          <button
            onClick={() => router.push("/shop")}
            className={styles.goToShopButton}
          >
            Browse cards
          </button>
        </div>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main id="main-content" className={styles.pageContainer}>
      {checkoutError && <p role="alert" style={{ padding: '16px', color: '#ffb7c6' }}>{checkoutError}</p>}
      {isLoading && (
        <div className={styles.loadingOverlay} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true"></div>
          <p>Redirecting to PayPal...</p>
        </div>
      )}

      <h1 className={styles.pageTitle}>Your cart</h1>
      <div className={styles.cartLayout}><div className={styles.cartItemsList}>
        {cart.map(item => (
          <div key={item.id} className={styles.cartItem}>
            <div className={styles.itemDetails}>
              <Image
                src={item.imageUrl || "/placeholder.png"}
                alt={item.name}
                width={80}
                height={110}
                className={styles.itemImage}
              />
              <div>
                <h2 className={styles.itemName}>{item.name}</h2>
                {item.edition && item.edition !== 'Not applicable' && <p className={styles.itemPrice}>{item.edition}</p>}
                <p className={styles.itemPrice}>{item.condition || 'Condition not specified'}</p>
                <p className={styles.itemPrice}> £{(item.price / 100).toFixed(2)}</p>
              </div>
            </div>
            <div className={styles.itemActions}>
              <span className={styles.quantityDisplay}>Qty {item.quantity}</span>
              <p className={styles.itemTotalPrice}>
                £{((item.price * item.quantity) / 100).toFixed(2)}
              </p>
              <button
                onClick={() => removeFromCart(item.id)}
                className={styles.removeButton}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.cartSummary}>
        <h2 className={styles.summaryTitle}>Order summary</h2>
        <div className={styles.summaryRow}>
          <p className={styles.summaryLabel}>Subtotal:</p>
          <p className={styles.summaryValue}>£{(totalPrice / 100).toFixed(2)}</p>
        </div>
        <div className={`${styles.summaryRow} ${styles.summaryTotalRow}`}>
          <p className={styles.summaryTotalLabel}>Total:</p>
          <p className={styles.summaryTotalValue}>£{(totalPrice / 100).toFixed(2)}</p>
        </div>
        {isBelowMinimumSpend && (
          <div className={styles.minimumSpendMessage}>
            Add <strong>£{((MINIMUM_SPEND_PENCE - totalPrice) / 100).toFixed(2)}</strong> more to reach the £{(MINIMUM_SPEND_PENCE / 100).toFixed(2)} minimum.
          </div>
        )}
        <button
          onClick={handleCheckout}
          className={styles.checkoutButton}
          disabled={isBelowMinimumSpend || isLoading}
        >
          {isLoading ? "Processing..." : "Checkout with PayPal"}
        </button>
      </div></div>
      <SiteFooter />
    </main>
  );
}
