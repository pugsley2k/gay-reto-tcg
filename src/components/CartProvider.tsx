"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { MEW_CODE } from '@/lib/promo';
import { parseSavedCart, type CartProduct as Product, type CartItem } from '@/lib/saved-cart';

interface CartContextType {
  isReady: boolean;
  promoCode: string;
  setPromoCode: React.Dispatch<React.SetStateAction<string>>;
  cart: CartItem[];
  addToCart: (item: Product) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [promoCode, setPromoCode] = useState('');

  // Render children on the server and on the first client pass using the same
  // empty state. Only cart-dependent controls wait for the browser's saved cart.
  useEffect(() => {
    let restored: CartItem[] = [];
    let savedPromo = '';
    const controller = new AbortController();
    try {
      restored = parseSavedCart(localStorage.getItem('cart'));
      if (localStorage.getItem('cart-promo') === MEW_CODE) savedPromo = MEW_CODE;
    } catch { /* Storage can be blocked. The cart still works in memory. */ }
    setCart(restored);
    setPromoCode(savedPromo);
    setHydrated(true);

    async function removeUnavailableFromCart(currentCart: CartItem[]) {
      if (currentCart.length === 0) return;
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Card?${new URLSearchParams({ id: `in.(${currentCart.map(i => JSON.stringify(i.id)).join(',')})`, select: 'id,available' })}`,
          {
            signal: controller.signal,
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
            },
          }
        );

        if (!res.ok) return; // don't clear cart on API errors
        const data = await res.json();
        if (controller.signal.aborted || !Array.isArray(data) || !data.every(d => d && typeof d.id === 'string' && typeof d.available === 'boolean')) return;
        const checkedIds = new Set(currentCart.map(item => item.id));
        const stillAvailableIds = new Set(data.filter(d => d.available).map(d => d.id));
        setCart(prev => {
          // A delayed response must not remove a card added after this request.
          const updated = prev.filter(item => !checkedIds.has(item.id) || stillAvailableIds.has(item.id));
          if (updated.length !== prev.length) {
            return updated;
          }
          return prev;
        });
      } catch { /* Keep the cart on network failure. Checkout rechecks stock. */ }
    }

    void removeUnavailableFromCart(restored);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
      if (promoCode) localStorage.setItem('cart-promo', promoCode); else localStorage.removeItem('cart-promo');
    } catch { /* Storage is optional; never interrupt shopping or payment. */ }
  }, [cart, hydrated, promoCode]);

  const clearCart = useCallback(() => {
    setCart([]);
    setPromoCode('');
  }, []);

  function addToCart(item: Product) {
    if (!hydrated) return;
    setCart((prevCart) => {
      const exists = prevCart.find(i => i.id === item.id);
      if (exists) {
        console.warn(`Card ${item.id} already in cart.`);
        return prevCart;
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  }

  function removeFromCart(id: string) {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  }

  function updateQuantity(id: string, quantity: number) {
    setCart((prevCart) =>
      prevCart
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, Math.min(1, quantity)) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function getTotalPrice() {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  }

  return (
    <CartContext.Provider
      value={{
        isReady: hydrated,
        cart,
        promoCode,
        setPromoCode,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotalPrice,
        setCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
