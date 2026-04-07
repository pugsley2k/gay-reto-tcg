"use client";
import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import styles from "../styles/ShopPage.module.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import { useCart } from "@/components/CartProvider";
import { ToastContainer, toast, Flip } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* ── Set name abbreviations applied to card title display ── */
const SET_ABBREVIATIONS: [RegExp, string][] = [
  [/Scarlet\s*&\s*Violet/g,     'S&V'],
  [/Sword\s*&\s*Shield/g,       'SwSh'],
  [/Sun\s*&\s*Moon/g,           'S&M'],
  [/Black\s*&\s*White/g,        'B&W'],
  [/HeartGold\s*SoulSilver/g,   'HGSS'],
  [/Diamond\s*&\s*Pearl/g,      'D&P'],
  [/Legends:\s*Arceus/g,        'LA'],
  [/Brilliant\s*Stars/g,        'BRS'],
  [/Fusion\s*Strike/g,          'FST'],
  [/Battle\s*Styles/g,          'BST'],
  [/Chilling\s*Reign/g,         'CRE'],
  [/Evolving\s*Skies/g,         'EVS'],
  [/Astral\s*Radiance/g,        'ASR'],
  [/Silver\s*Tempest/g,         'SIT'],
  [/Crown\s*Zenith/g,           'CRZ'],
  [/Paldea\s*Evolved/g,         'PAL'],
  [/Obsidian\s*Flames/g,        'OBF'],
  [/Paradox\s*Rift/g,           'PAR'],
  [/Temporal\s*Forces/g,        'TEF'],
  [/Twilight\s*Masquerade/g,    'TWM'],
  [/Stellar\s*Crown/g,          'SCR'],
  [/Surging\s*Sparks/g,         'SSP'],
  [/Prismatic\s*Evolutions/g,   'PRE'],
];

function abbreviateTitle(name: string): string {
  let result = name;
  for (const [pattern, replacement] of SET_ABBREVIATIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}



if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables");
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const RARITY_ORDER: Record<string, number> = {
  "Common": 0, "Uncommon": 1, "Rare": 2,
  "Holo Rare": 3, "Secret Rare": 4, "Promo": 5,
};

export default function ShopPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("");
  const [setName, setSetName] = useState("");
  const [loading, setLoading] = useState(true);
  const [setOptions, setSetOptions] = useState<{ value: string; label: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCards, setTotalCards] = useState(0);
  const CARDS_PER_PAGE = 20;

  const { addToCart } = useCart();

  const fetchCards = useCallback(async () => {
    setError(null);
    setLoading(true);
    const from = (currentPage - 1) * CARDS_PER_PAGE;
    const to = from + CARDS_PER_PAGE - 1;

    let query = supabase
      .from("Card")
      .select("*", { count: "exact" })
      .eq("available", true);

    if (search)  query = query.ilike("name", `%${search}%`);
    if (setName) query = query.eq("set", setName);
    if (rarity)  query = query.ilike("rarity", `%${rarity}%`);

    const { data, error, count } = await query
      .range(from, to)
      .order("createdAt", { ascending: false });

    if (error) {
      setError("Failed to load cards.");
    } else {
      setCards(data || []);
      setTotalCards(count || 0);
    }
    setLoading(false);
  }, [search, rarity, setName, currentPage]);

  useEffect(() => {
    fetch("/api/sets")
      .then(res => res.json())
      .then(data => setSetOptions((data.sets || []).map((s: any) => ({ value: s.value, label: s.label }))))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);
  useEffect(() => { setCurrentPage(1); }, [search, rarity, setName]);

  const handleAddToCart = (card: any) => {
    addToCart({ id: card.id, name: card.name, price: card.price, imageUrl: card.image_url });
    toast.success(`${card.name} added to cart!`);
  };

  const totalPages = Math.ceil(totalCards / CARDS_PER_PAGE);
  const hasFilters = search || rarity || setName;

  return (
    <main className={styles.pageContainer}>

      {/* ── Hero header (no image) ── */}
      <header className={styles.shopHero}>
        <div className={styles.heroCornerTL} aria-hidden="true" />
        <div className={styles.heroCornerTR} aria-hidden="true" />
        <div className={styles.heroCornerBL} aria-hidden="true" />
        <div className={styles.heroCornerBR} aria-hidden="true" />

        <p className={styles.heroPre}>— GAY RETRO TCG —</p>
        <h1 className={styles.heroTitle}>SHOP ALL CARDS</h1>
        <p className={styles.heroMeta}>
          {loading ? "LOADING..." : `${totalCards} CARDS IN STOCK`}
        </p>

        <div className={styles.heroRainbowBar} aria-hidden="true" />
      </header>

      <ToastContainer
        position="top-center"
        autoClose={2500}
        hideProgressBar
        newestOnTop
        closeOnClick
        transition={Flip}
        style={{ marginTop: "4rem" }}
        theme="colored"
      />

      <div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "3rem" }}>

        {/* ── Filters ── */}
        <div className={styles.filterSection}>
          <div className={styles.filterGrid}>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>Search</label>
              <input
                type="text"
                className={`form-control ${styles.filterInput}`}
                placeholder="Card name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>Set</label>
              <select
                className={`form-select ${styles.filterInput}`}
                value={setName}
                onChange={e => setSetName(e.target.value)}
              >
                <option value="">All Sets</option>
                {setOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>Rarity</label>
              <select
                className={`form-select ${styles.filterInput}`}
                value={rarity}
                onChange={e => setRarity(e.target.value)}
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
            {hasFilters && (
              <button
                className={styles.clearBtn}
                onClick={() => { setSearch(""); setRarity(""); setSetName(""); }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Error ── */}
        {error && <div className="alert alert-danger">{error}</div>}

        {/* ── Loading ── */}
        {loading && (
          <div className={styles.loadingState}>
            <div className={styles.loadingDots}>
              <span /><span /><span /><span />
            </div>
            <p>LOADING CARDS...</p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && cards.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyIcon}>◈</p>
            <p>NO CARDS FOUND</p>
            {hasFilters && (
              <button className={styles.clearBtn} onClick={() => { setSearch(""); setRarity(""); setSetName(""); }}>
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* ── Card grid ── */}
        {!loading && cards.length > 0 && (
          <div className={`row row-cols-2 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-4 g-3 ${styles.productGridRow}`}>
            {cards.map((card, i) => (
              <div className={`col ${styles.productColWrapper}`} key={card.id} style={{ animationDelay: `${Math.min(i, 9) * 0.05}s` }}>
                <div className={styles.shopCard}>
                  <div className={styles.cardImageWrap}>
                    <img
                      src={card.image_url || "/placeholder.png"}
                      alt={card.name}
                      className={styles.cardImage}
                    />
                    {card.holo_type === 'Pokeball Holo' && (
                      <div className={styles.holoOverlay}>
                        <div className={`${styles.holoPattern} ${styles.holoPokeball}`} />
                        <div className={styles.holoShimmer} />
                      </div>
                    )}
                    {card.holo_type === 'Master Ball Holo' && (
                      <div className={styles.holoOverlay}>
                        <div className={`${styles.holoPattern} ${styles.holoMasterBall}`} />
                        <div className={styles.holoShimmer} />
                      </div>
                    )}
                    {card.holo_type === 'Cosmos Holo' && (
                      <div className={styles.holoOverlay}>
                        <div className={`${styles.holoPattern} ${styles.holoCosmos}`} />
                        <div className={styles.holoShimmer} />
                      </div>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <h5 className={styles.cardTitle}>
                      {abbreviateTitle(card.name ?? '')}
                      {card.holo_type && card.holo_type !== "Normal" && ` · ${card.holo_type}`}
                    </h5>
                    <p className={styles.cardPrice}>
                      {typeof card.price === "number" ? `£${(card.price / 100).toFixed(2)}` : "N/A"}
                    </p>
                    <p className={styles.cardMeta} title={card.set ?? ''}>
                      {card.set ?? ''}
                      {card.language && card.language !== "English" && (
                        <span className={styles.langBadge}>{card.language === "Japanese" ? "🇯🇵 JP" : card.language}</span>
                      )}
                    </p>
                    <button className={styles.addToCartBtn} onClick={() => handleAddToCart(card)}>
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className={styles.paginationWrap}>
            <button
              className={styles.pageBtn}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              ← Prev
            </button>
            <div className={styles.pageNumbers}>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .reduce<(number | string)[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  typeof p === "string" ? (
                    <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>{p}</span>
                  ) : (
                    <button
                      key={p}
                      className={`${styles.pageBtn} ${currentPage === p ? styles.pageBtnActive : ""}`}
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </button>
                  )
                )}
            </div>
            <button
              className={styles.pageBtn}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        )}

      </div>

      <footer className={styles.footer}>
        © {new Date().getFullYear()} GAY RETRO TCG. All Rights Reserved.
      </footer>
    </main>
  );
}
