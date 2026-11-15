'use client';
import { useCart } from './CartProvider';

type Buyable = { id: string; name: string; price: number; imageUrl: string; condition?: string | null; edition?: string | null };
export default function AddToCartButton({ card, className }: { card: Buyable; className?: string }) {
  const { addToCart, cart, isReady } = useCart();
  const inCart = cart.some(item => item.id === card.id);
  return <button type="button" className={className} disabled={!isReady || inCart} onClick={() => addToCart(card)}>{inCart ? 'In your cart' : 'Add to cart'}</button>;
}
