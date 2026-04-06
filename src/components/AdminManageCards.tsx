"use client";
import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface Card {
  id: number;
  name: string;
  number: string | null;
  set: string | null;
  holo_type: string | null;
  language: string | null;
  price: number | null;
  image_url: string | null;
}

const SPECIAL_HOLOS = new Set([
  'Pokeball Holo', 'Master Ball Holo', 'Cosmos Holo',
  'Full Art', 'Alt Art', 'Special Illustration Rare',
  'Hyper Rare', 'Double Rare', 'Ultra Rare', 'Holo Rare',
  'Reverse Holo', 'Promo',
]);

/** Extract Pokemon name, card number, set name and series from the stored composite name */
function parseStoredName(name: string, number: string | null) {
  if (!number) {
    // No number stored — just use first word(s) up to a likely set boundary
    const pipeIdx = name.indexOf(' | ');
    const pokemonName = pipeIdx >= 0 ? name.slice(0, pipeIdx).trim() : name;
    const afterPipe = pipeIdx >= 0 ? name.slice(pipeIdx + 3).trim() : '';
    return { pokemonName, cardNum: '', setName: pokemonName, setSeries: afterPipe };
  }
  // e.g. "Scyther 6/165 Pokémon Card 151 | Scarlet & Violet"
  const numIndex = name.indexOf(number);
  const pokemonName = numIndex > 0 ? name.slice(0, numIndex).trim() : name.split(' ')[0];
  const afterNum    = numIndex >= 0 ? name.slice(numIndex + number.length).trim() : '';
  const pipeIdx     = afterNum.indexOf(' | ');
  const setName     = pipeIdx >= 0 ? afterNum.slice(0, pipeIdx).trim() : afterNum;
  const setSeries   = pipeIdx >= 0 ? afterNum.slice(pipeIdx + 3).trim() : '';
  const cardNum     = number.split('/')[0];
  return { pokemonName, cardNum, setName, setSeries };
}

const s: Record<string, React.CSSProperties> = {
  wrap:       { fontFamily: 'Space Mono, monospace', color: '#d0d0f0', padding: '0 0 2rem' },
  toolbar:    { display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' },
  searchBox:  { background: '#0f0f22', border: '1px solid #2d2d50', borderRadius: 6, color: '#d0d0f0', padding: '6px 10px', fontSize: 13, flex: 1, minWidth: 180 },
  filterSel:  { background: '#0f0f22', border: '1px solid #2d2d50', borderRadius: 6, color: '#d0d0f0', padding: '6px 8px', fontSize: 12 },
  table:      { width: '100%', borderCollapse: 'collapse' as const },
  th:         { textAlign: 'left' as const, fontSize: 10, color: '#5a5a8a', padding: '6px 8px', borderBottom: '1px solid #1e1e3a', letterSpacing: '0.1em', textTransform: 'uppercase' as const },
  td:         { padding: '8px', borderBottom: '1px solid #111128', verticalAlign: 'middle' as const, fontSize: 12 },
  thumb:      { width: 40, height: 56, objectFit: 'contain' as const, borderRadius: 3, background: '#08081a' },
  name:       { maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontSize: 11, color: '#c0c0e0' },
  holo:       { fontSize: 10, color: '#a78bfa', background: 'rgba(124,106,240,0.15)', padding: '2px 6px', borderRadius: 4 },
  price:      { fontSize: 13, color: '#ffd166', fontWeight: 700 },
  btnFix:     { background: 'linear-gradient(90deg,#7c6af0,#b84fff)', border: 'none', borderRadius: 5, color: '#fff', padding: '5px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  btnFixDone: { background: '#1a3a1a', border: '1px solid #2a6a2a', borderRadius: 5, color: '#86efac', padding: '5px 12px', fontSize: 11, cursor: 'default', whiteSpace: 'nowrap' as const },
  btnFixFail: { background: '#3a1a1a', border: '1px solid #6a2a2a', borderRadius: 5, color: '#f87171', padding: '5px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  btnDelete:  { background: 'transparent', border: '1px solid #3a1a1a', borderRadius: 5, color: '#f87171', padding: '5px 10px', fontSize: 11, cursor: 'pointer' },
  statusTxt:  { fontSize: 10, marginTop: 2, color: '#7070a0' },
};

type FixStatus = 'idle' | 'loading' | 'done' | 'fail' | 'not_found';

export default function AdminManageCards() {
  const [cards, setCards]       = useState<Card[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [holoFilter, setHoloFilter] = useState('');
  const [fixStatus, setFixStatus] = useState<Record<number, FixStatus>>({});
  const [fixMsg, setFixMsg]     = useState<Record<number, string>>({});
  const [deleting, setDeleting] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('Card')
      .select('id, name, number, set, holo_type, language, price, image_url')
      .order('id', { ascending: false });
    setCards((data as Card[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = cards.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase());
    const matchHolo   = !holoFilter || c.holo_type === holoFilter || (holoFilter === '__special__' && c.holo_type && SPECIAL_HOLOS.has(c.holo_type));
    return matchSearch && matchHolo;
  });

  async function fixCard(card: Card) {
    setFixStatus(p => ({ ...p, [card.id]: 'loading' }));
    setFixMsg(p => ({ ...p, [card.id]: '' }));
    try {
      const { pokemonName, cardNum, setName, setSeries } = parseStoredName(card.name, card.number);
      const params = new URLSearchParams({
        name:       pokemonName,
        number:     cardNum,
        holo_type:  card.holo_type ?? '',
        language:   card.language ?? 'English',
        set_name:   setName,
        set_series: setSeries,
      });
      const pcData = await fetch(`/api/pricecharting?${params}`).then(r => r.json());

      if (pcData.not_found) {
        setFixStatus(p => ({ ...p, [card.id]: 'not_found' }));
        setFixMsg(p => ({ ...p, [card.id]: `Not found on PC · query: "${pokemonName} ${cardNum}"` }));
        return;
      }
      if (pcData.error) {
        setFixStatus(p => ({ ...p, [card.id]: 'fail' }));
        setFixMsg(p => ({ ...p, [card.id]: pcData.error }));
        return;
      }

      const updates: { price?: number; image_url?: string } = {};
      if (pcData.price)     updates.price     = pcData.price;
      if (pcData.image_url) updates.image_url = pcData.image_url;

      if (!Object.keys(updates).length) {
        setFixStatus(p => ({ ...p, [card.id]: 'not_found' }));
        setFixMsg(p => ({ ...p, [card.id]: 'PC found page but no price or image data' }));
        return;
      }

      const patchRes = await fetch('/api/cards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: card.id, ...updates }),
      });
      if (!patchRes.ok) throw new Error(await patchRes.text());

      // Update local state so UI reflects new values instantly
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, ...updates } : c));
      setFixStatus(p => ({ ...p, [card.id]: 'done' }));
      const parts: string[] = [];
      if (updates.price)     parts.push(`£${(updates.price / 100).toFixed(2)}`);
      if (updates.image_url) parts.push('image updated');
      setFixMsg(p => ({ ...p, [card.id]: parts.join(' · ') }));
    } catch (e: any) {
      setFixStatus(p => ({ ...p, [card.id]: 'fail' }));
      setFixMsg(p => ({ ...p, [card.id]: e.message ?? 'Unknown error' }));
    }
  }

  async function deleteCard(card: Card) {
    if (!confirm(`Delete "${card.name}"? This cannot be undone.`)) return;
    setDeleting(p => ({ ...p, [card.id]: true }));
    const { error } = await supabase.from('Card').delete().eq('id', card.id);
    if (error) { alert(error.message); setDeleting(p => ({ ...p, [card.id]: false })); return; }
    setCards(prev => prev.filter(c => c.id !== card.id));
  }

  const allHoloTypes = [...new Set(cards.map(c => c.holo_type).filter(Boolean))].sort();

  return (
    <div style={s.wrap}>
      <div style={s.toolbar}>
        <input
          style={s.searchBox}
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={s.filterSel} value={holoFilter} onChange={e => setHoloFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="__special__">Special holos only</option>
          {allHoloTypes.map(h => <option key={h!} value={h!}>{h}</option>)}
        </select>
        <span style={{ fontSize: 11, color: '#4a4a72' }}>{filtered.length} card{filtered.length !== 1 ? 's' : ''}</span>
        <button style={{ ...s.btnFix, background: '#1a1a30' }} onClick={load}>↺ Refresh</button>
      </div>

      {loading ? (
        <p style={{ color: '#4a4a72', fontSize: 12 }}>Loading…</p>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}></th>
              <th style={s.th}>Name</th>
              <th style={s.th}>Type</th>
              <th style={s.th}>Lang</th>
              <th style={s.th}>Price</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(card => {
              const st = fixStatus[card.id] ?? 'idle';
              const msg = fixMsg[card.id] ?? '';
              return (
                <tr key={card.id}>
                  <td style={s.td}>
                    <img src={card.image_url || '/placeholder.png'} alt="" style={s.thumb} />
                  </td>
                  <td style={s.td}>
                    <div style={s.name} title={card.name}>{card.name}</div>
                    {card.number && <div style={{ ...s.statusTxt }}># {card.number}</div>}
                  </td>
                  <td style={s.td}>
                    {card.holo_type
                      ? <span style={s.holo}>{card.holo_type}</span>
                      : <span style={{ color: '#3a3a5a' }}>—</span>}
                  </td>
                  <td style={s.td}>
                    <span style={{ fontSize: 11, color: '#7070a0' }}>
                      {card.language === 'Japanese' ? '🇯🇵' : card.language === 'Korean' ? '🇰🇷' : '🇬🇧'}{' '}
                      {card.language ?? 'EN'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span style={s.price}>
                      {typeof card.price === 'number' ? `£${(card.price / 100).toFixed(2)}` : '—'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {st === 'loading' ? (
                          <button style={{ ...s.btnFix, opacity: 0.6 }} disabled>Checking PC…</button>
                        ) : st === 'done' ? (
                          <button style={s.btnFixDone} onClick={() => fixCard(card)}>✓ Fixed · Retry?</button>
                        ) : st === 'fail' || st === 'not_found' ? (
                          <button style={s.btnFixFail} onClick={() => fixCard(card)}>✗ Retry Fix</button>
                        ) : (
                          <button style={s.btnFix} onClick={() => fixCard(card)}>Fix Price &amp; Image</button>
                        )}
                        <button
                          style={{ ...s.btnDelete, opacity: deleting[card.id] ? 0.5 : 1 }}
                          disabled={deleting[card.id]}
                          onClick={() => deleteCard(card)}
                        >
                          🗑
                        </button>
                      </div>
                      {msg && (
                        <div style={{ ...s.statusTxt, color: st === 'done' ? '#86efac' : st === 'not_found' ? '#fb923c' : '#f87171' }}>
                          {msg}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
