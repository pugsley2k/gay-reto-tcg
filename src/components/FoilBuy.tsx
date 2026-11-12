'use client';

import { useCart } from './CartProvider';
import { EXAMPLE_CARD_ID } from '@/lib/example-listing';
import type { CartProduct } from '@/lib/saved-cart';
import styles from './FoilHome.module.css';

/** Add to cart, straight from the home page. Same rules as the shop grid. */
export default function FoilBuy({ card }: { card: CartProduct }) {
  const { cart, addToCart, isReady } = useCart();
  const example = card.id === EXAMPLE_CARD_ID;
  const inCart = cart.some(item => item.id === card.id);
  return <button type="button" className={styles.add} disabled={!isReady || example || inCart} onClick={() => addToCart(card)}>
    {example ? 'Example — not for sale' : inCart ? 'In your cart' : 'Add to cart'}
  </button>;
}
