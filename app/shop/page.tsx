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

const HOLO_TYPE_OPTIONS = [
  'Normal','Common','Uncommon','Rare',
  'Reverse Holo','Pokeball Holo','Master Ball Holo','Cosmos Holo',
  'Holo Rare','Rare Holo','Rare Holo EX','Rare Holo GX',
  'Double Rare','Ultra Rare','Full Art','Alt Art',
  'Illustration Rare','Special Illustration Rare',
  'Hyper Rare','Shiny Rare','Shiny Ultra Rare','Radiant Rare',
  'ACE SPEC rare','Promo',
];

export default function ShopPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("");
  const [setName, setSetName] = useState("");
  const [holoFilter, setHoloFilter] = useState("");
  const [langFilter, setLangFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
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

    if (search)     query = query.ilike("name", `%${search}%`);
    if (setName)    query = query.eq("set", setName);
    if (rarity)     query = query.ilike("rarity", `%${rarity}%`);
    if (holoFilter) query = query.eq("holo_type", holoFilter);
    if (langFilter) query = query.eq("language", langFilter);

    const orderCol  = sortBy === "price-asc" || sortBy === "price-desc" ? "price"
                    : sortBy === "name-asc"  || sortBy === "name-desc"  ? "name"
                    : "createdAt";
    const ascending = sortBy === "price-asc" || sortBy === "name-asc";

    const { data, error, count } = await query
      .range(from, to)
      .order(orderCol, { ascending });

    if (error) {
      setError("Failed to load cards.");
    } else {
      setCards(data || []);
      setTotalCards(count || 0);
    }
    setLoading(false);
  }, [search, rarity, setName, holoFilter, langFilter, sortBy, currentPage]);

  useEffect(() => {
    fetch("/api/sets")
      .then(res => res.json())
      .then(data => setSetOptions((data.sets || []).map((s: any) => ({ value: s.value, label: s.label }))))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);
  useEffect(() => { setCurrentPage(1); }, [search, rarity, setName, holoFilter, langFilter, sortBy]);

  const handleAddToCart = (card: any) => {
    addToCart({ id: card.id, name: card.name, price: card.price, imageUrl: card.image_url });
    toast.success(`${card.name} added to cart!`);
  };

  const [modalCard, setModalCard] = useState<any | null>(null);

  // ── Recently viewed ──
  const [recentIds, setRecentIds]     = useState<string[]>([]);
  const [recentCards, setRecentCards] = useState<any[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('grtcg_recent') ?? '[]');
      setRecentIds(stored);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!recentIds.length) { setRecentCards([]); return; }
    supabase.from('Card').select('id,name,image_url,price,holo_type').in('id', recentIds)
      .then(({ data }) => {
        if (!data) return;
        // preserve view order
        const map = Object.fromEntries(data.map(c => [c.id, c]));
        setRecentCards(recentIds.map(id => map[id]).filter(Boolean));
      });
  }, [recentIds]);

  function trackViewed(card: any) {
    setModalCard(card);
    setRecentIds(prev => {
      const next = [card.id, ...prev.filter((id: string) => id !== card.id)].slice(0, 12);
      try { localStorage.setItem('grtcg_recent', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const totalPages = Math.ceil(totalCards / CARDS_PER_PAGE);
  const hasFilters = search || rarity || setName || holoFilter || langFilter;

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
              <select className={`form-select ${styles.filterInput}`} value={setName} onChange={e => setSetName(e.target.value)}>
                <option value="">All Sets</option>
                {setOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>Holo Type</label>
              <select className={`form-select ${styles.filterInput}`} value={holoFilter} onChange={e => setHoloFilter(e.target.value)}>
                <option value="">All Types</option>
                {HOLO_TYPE_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>Language</label>
              <select className={`form-select ${styles.filterInput}`} value={langFilter} onChange={e => setLangFilter(e.target.value)}>
                <option value="">All Languages</option>
                <option value="English">🇬🇧 English</option>
                <option value="Japanese">🇯🇵 Japanese</option>
                <option value="Korean">🇰🇷 Korean</option>
              </select>
            </div>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>Sort By</label>
              <select className={`form-select ${styles.filterInput}`} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="newest">Newest First</option>
                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
                <option value="name-asc">Name: A → Z</option>
                <option value="name-desc">Name: Z → A</option>
              </select>
            </div>
            {hasFilters && (
              <button
                className={styles.clearBtn}
                onClick={() => { setSearch(""); setRarity(""); setSetName(""); setHoloFilter(""); setLangFilter(""); }}
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
                  <div className={styles.cardImageWrap} onClick={() => trackViewed(card)} style={{ cursor: 'zoom-in' }}>
                    <div className={styles.cardImageInner}>
                      <img
                        src={card.image_url || "/placeholder.png"}
                        alt={card.name}
                        className={styles.cardImage}
                      />
                      {['Reverse Holo','Reverse Holofoil','reverseHolofoil'].includes(card.holo_type ?? '') && (
                        <div className={styles.holoOverlay}>
                          <div className={styles.holoReverse} />
                        </div>
                      )}
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

      {/* ── Recently viewed strip ── */}
      {recentCards.length > 1 && (
        <div className={styles.recentWrap}>
          <p className={styles.recentLabel}>Recently Viewed</p>
          <div className={styles.recentStrip}>
            {recentCards.map(card => (
              <button key={card.id} className={styles.recentItem} onClick={() => trackViewed(card)}>
                <div className={styles.recentImgWrap}>
                  <img src={card.image_url || '/placeholder.png'} alt={card.name} className={styles.recentImg} />
                </div>
                <span className={styles.recentName}>{card.name?.split(' ')[0]}</span>
                <span className={styles.recentPrice}>
                  {typeof card.price === 'number' ? `£${(card.price / 100).toFixed(2)}` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <footer className={styles.footer}>
        © {new Date().getFullYear()} GAY RETRO TCG. All Rights Reserved.
      </footer>

      {/* ── Card detail modal ── */}
      {modalCard && (
        <div className={styles.modalBackdrop} onClick={() => setModalCard(null)}>
          <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setModalCard(null)} aria-label="Close">✕</button>
            <div className={styles.modalInner}>
              <div className={styles.modalImageWrap}>
                <div className={styles.cardImageInner} style={{ height: '100%' }}>
                  <img src={modalCard.image_url || "/placeholder.png"} alt={modalCard.name} className={styles.cardImage} />
                  {['Reverse Holo','Reverse Holofoil','reverseHolofoil'].includes(modalCard.holo_type ?? '') && (
                    <div className={styles.holoOverlay}><div className={styles.holoReverse} /></div>
                  )}
                  {modalCard.holo_type === 'Pokeball Holo' && (
                    <div className={styles.holoOverlay}><div className={`${styles.holoPattern} ${styles.holoPokeball}`} /><div className={styles.holoShimmer} /></div>
                  )}
                  {modalCard.holo_type === 'Master Ball Holo' && (
                    <div className={styles.holoOverlay}><div className={`${styles.holoPattern} ${styles.holoMasterBall}`} /><div className={styles.holoShimmer} /></div>
                  )}
                  {modalCard.holo_type === 'Cosmos Holo' && (
                    <div className={styles.holoOverlay}><div className={`${styles.holoPattern} ${styles.holoCosmos}`} /><div className={styles.holoShimmer} /></div>
                  )}
                </div>
              </div>
              <div className={styles.modalInfo}>
                <h2 className={styles.modalName}>{modalCard.name}</h2>
                {modalCard.holo_type && modalCard.holo_type !== 'Normal' && (
                  <span className={styles.modalHoloBadge}>{modalCard.holo_type}</span>
                )}
                {modalCard.set && <p className={styles.modalMeta}>{modalCard.set}</p>}
                {modalCard.language && modalCard.language !== 'English' && (
                  <p className={styles.modalMeta}>
                    {modalCard.language === 'Japanese' ? '🇯🇵' : modalCard.language === 'Korean' ? '🇰🇷' : '🌐'} {modalCard.language}
                  </p>
                )}
                {modalCard.rarity && <p className={styles.modalMeta}>{modalCard.rarity}</p>}
                <p className={styles.modalPrice}>
                  {typeof modalCard.price === 'number' ? `£${(modalCard.price / 100).toFixed(2)}` : 'N/A'}
                </p>
                <button className={styles.addToCartBtn} style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => { handleAddToCart(modalCard); setModalCard(null); }}>
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
