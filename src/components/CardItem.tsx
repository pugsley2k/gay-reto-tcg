import { useState, useEffect } from "react";
import { useCart } from "./CartProvider";

export default function CardItem({ card }: { card: any }) {
  const { addToCart, cart, isReady } = useCart();
  const [added, setAdded] = useState(false);
  const [alreadyInCart, setAlreadyInCart] = useState(false);

  useEffect(() => {
    const exists = cart.some((item) => item.id === card.id);
    setAlreadyInCart(exists);
  }, [cart, card.id]);

  function handleAddToCart() {
    if (!isReady || alreadyInCart) return;
    addToCart({ ...card, cardId: card.id });
    setAdded(true);
    setTimeout(() => setAdded(false), 900);
  }

  return (
    <div className="bg-black border-4 border-neonPink rounded-2xl shadow-lg p-4 flex flex-col items-center relative hover:scale-110 transition-transform duration-200 ease-in-out">
      <img src={card.imageUrl} alt={card.name} className="card-img" />
      <div className="font-['Press_Start_2P',monospace] text-lg text-neonCyan mb-2 text-center">
        {card.name}
      </div>
      <div className="text-xl text-white font-bold mb-4">
        £{(card.price / 100).toFixed(2)}
      </div>
      <button
        onClick={handleAddToCart}
        className={`px-4 py-2 font-bold rounded-full border-2 transition ${
          alreadyInCart
            ? "bg-gray-500 text-white cursor-not-allowed"
            : "bg-neonGreen text-black hover:bg-neonPink hover:text-white border-neonCyan"
        }`}
        disabled={!isReady || alreadyInCart}
      >
        {alreadyInCart ? "In Cart" : added ? "Added!" : "Add to Cart"}
      </button>
    </div>
  );
}
