"use client";
import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import styles from "../styles/ShopPage.module.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import { useCart } from "@/components/CartProvider";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Supabase
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables");
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ShopPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("");
  const [setName, setSetName] = useState("");
  const [loading, setLoading] = useState(true);
  const [setOptions, setSetOptions] = useState<{ value: string; label: string }[]>([]);

  // 1. STATE FOR PAGINATION
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCards, setTotalCards] = useState(0);
  const CARDS_PER_PAGE = 20; // Number of cards per page

  const { addToCart } = useCart();

  // 2. MODIFIED fetchCards to handle pagination
  const fetchCards = useCallback(async () => {
    setLoading(true);
    const from = (currentPage - 1) * CARDS_PER_PAGE;
    const to = from + CARDS_PER_PAGE - 1;

    let query = supabase
      .from("Card")
      .select("*", { count: "exact" }) // Request total count
      .eq("available", true);

    if (search) query = query.ilike("name", `%${search}%`);
    if (setName) query = query.eq("set", setName);
    if (rarity) query = query.ilike("rarity", `%${rarity}%`);

    const { data, error, count } = await query
      .range(from, to) // Apply pagination
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("❌ Error fetching cards:", error);
      setError("Failed to load cards.");
    } else {
      setCards(data || []);
      setTotalCards(count || 0); // Set the total count
    }

    setLoading(false);
  }, [search, rarity, setName, currentPage]); // Add currentPage dependency

  useEffect(() => {
    fetch("/api/sets")
      .then(res => res.json())
      .then(data => {
        const options = (data.sets || []).map((s: any) => ({
          value: s.value,
          label: s.label,
        }));
        setSetOptions(options);
      })
      .catch(err => console.error("Failed to load sets", err));
  }, []);

  // This useEffect fetches cards whenever the fetchCards function is updated
  // (i.e., when filters or the current page changes)
  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // 3. NEW useEffect to reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, rarity, setName]);

  const handleAddToCart = (card: any) => {
    addToCart({
      id: card.id,
      name: card.name,
      price: card.price,
      imageUrl: card.image_url,
    });
    toast.success(`${card.name} added to cart!`);
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength - 3) + '...';
    }
    return text;
  };

  return (
    <main className={styles.pageContainer}>
      <div className={styles.shopImageBanner}>
        <img
          src="/generated-imageee.png"
          alt="Colorful trading card game banner1"
          style={{ width: "100%", display: "block", paddingTop: "50px" }}
        />
      </div>

      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        transition={Flip}
        style={{ marginTop: "4rem" }}
        theme="colored"
      />

      <div className="container mt-4">
        {/* FILTER CONTROLS (Unchanged) */}
        <div className="row mb-3">
          <div className="col-md-4 mb-2">
            <input
              type="text"
              className="form-control"
              placeholder="Search by card name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-4 mb-2">
           <select
            className="form-select"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            >
              <option value="">All Sets</option>
              {setOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                 {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4 mb-2">
            <select
              className="form-select"
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
            >
              <option value="">All Rarities</option>
              <option value="Common">Common</option>
              <option value="Uncommon">Uncommon</option>
              <option value="Rare">Rare</option>
              <option value="Holo Rare">Holo Rare</option>
              <option value="Secret Rare">Secret Rare</option>
              <option value="Promo">Promo</option>
            </select>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {loading && <div className="text-muted">Loading cards...</div>}
S
        {/* PRODUCT GRID (Unchanged) */}
        <div className={`row row-cols-2 row-cols-sm-2 row-cols-md-3 row-cols-lg-5 g-4 ${styles.productGridRow}`}>
          {cards.map((card) => (
            <div className={`col ${styles.productColWrapper}`} key={card.id}>
              <div className={`card ${styles.shopCard}`}>
                <img
                  src={card.image_url || "/fallback.jpg"}
                  alt={card.name}
                  className="card-img-top"
                />
                <div className={`card-body ${styles.cardBody}`}>
                  <div className={styles.cardTextWrapper}>
                    <h5 className="card-title">{card.name}</h5>
                    <p className="card-text">
                      {typeof card.price === "number"
                        ? `£${(card.price / 100).toFixed(2)}`
                        : "N/A"}
                    </p>
                    <p className="card-text">
                      <small className="text-muted" title={card.set}>
                        {truncateText(card.set, 18)} — #{card.number}
                      </small>
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleAddToCart(card)}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 4. PAGINATION UI */}
        {totalCards > CARDS_PER_PAGE && (
          <div className="d-flex justify-content-center mt-4">
            <nav aria-label="Page navigation">
              <ul className="pagination">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setCurrentPage(currentPage - 1)}>
                    Previous
                  </button>
                </li>
                {Array.from({ length: Math.ceil(totalCards / CARDS_PER_PAGE) }, (_, i) => (
                  <li key={i + 1} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage(i + 1)}>
                      {i + 1}
                    </button>
                  </li>
                ))}
                <li className={`page-item ${currentPage === Math.ceil(totalCards / CARDS_PER_PAGE) ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setCurrentPage(currentPage + 1)}>
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}

      </div>
      <div style={{ paddingTop: "20px", height: "3rem", width: "100%" }}></div>
         <footer id="footer" style={{ flexShrink: 0, paddingTop: "20px", paddingBottom: "40px", width: "100%", background: "#282828", color: "white", textAlign: "center" }}>
          <p>© {new Date().getFullYear()} GAY RETRO TCG. All Rights Reserved.</p>
        </footer>
    </main>
  );
}