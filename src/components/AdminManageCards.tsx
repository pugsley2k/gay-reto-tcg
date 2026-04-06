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

const ALL_HOLO_TYPES = [
  'Normal','Common','Uncommon','Rare',
  'Rare Holo','Rare Holo EX','Rare Holo GX','Rare Holo Lv.X','Rare Prime','LEGEND',
  'Ultra Rare','Double Rare','ACE SPEC rare','Rare BREAK','Promo','Amazing',
  'Radiant Rare','Illustration Rare','Special Illustration Rare',
  'Shiny Rare','Shiny Ultra Rare','Hyper Rare',
  'Black White rare','Mega Hyper Rare','Mega Attack Rare',
  'Reverse Holo','Pokeball Holo','Master Ball Holo','Cosmos Holo',
  'Full Art','Alt Art','Holo Rare',
];

/** Extract Pokemon name, card number, set name and series from the stored composite name */
function parseStoredName(name: string, number: string | null) {
  if (!number) {
    const pipeIdx = name.indexOf(' | ');
    const pokemonName = pipeIdx >= 0 ? name.slice(0, pipeIdx).trim() : name;
    const afterPipe = pipeIdx >= 0 ? name.slice(pipeIdx + 3).trim() : '';
    return { pokemonName, cardNum: '', setName: pokemonName, setSeries: afterPipe };
  }
  // e.g. "Snover 10/189 Snow Hazard | Scarlet & Violet"
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
  td:         { padding: '8px', borderBottom: '1px solid #111128', verticalAlign: 'top' as const, fontSize: 12 },
  thumb:      { width: 40, height: 56, objectFit: 'contain' as const, borderRadius: 3, background: '#08081a' },
  name:       { maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontSize: 11, color: '#c0c0e0' },
  holo:       { fontSize: 10, color: '#a78bfa', background: 'rgba(124,106,240,0.15)', padding: '2px 6px', borderRadius: 4 },
  price:      { fontSize: 13, color: '#ffd166', fontWeight: 700 },
  btnFix:     { background: 'linear-gradient(90deg,#7c6af0,#b84fff)', border: 'none', borderRadius: 5, color: '#fff', padding: '5px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  btnFixDone: { background: '#1a3a1a', border: '1px solid #2a6a2a', borderRadius: 5, color: '#86efac', padding: '5px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  btnFixFail: { background: '#3a1a1a', border: '1px solid #6a2a2a', borderRadius: 5, color: '#f87171', padding: '5px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  btnDelete:  { background: 'transparent', border: '1px solid #3a1a1a', borderRadius: 5, color: '#f87171', padding: '5px 10px', fontSize: 11, cursor: 'pointer' },
  btnSave:    { background: '#1a3050', border: '1px solid #2a5080', borderRadius: 5, color: '#93c5fd', padding: '4px 10px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  statusTxt:  { fontSize: 10, marginTop: 2, color: '#7070a0' },
  manualRow:  { display: 'flex', gap: 5, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' as const },
  manualInput:{ background: '#0a0a1a', border: '1px solid #2d2d50', borderRadius: 4, color: '#ffd166', padding: '3px 7px', fontSize: 12, width: 80 },
};

type FixStatus = 'idle' | 'loading' | 'done' | 'fail' | 'not_found';

export default function AdminManageCards() {
  const [cards, setCards]         = useState<Card[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [holoFilter, setHoloFilter] = useState('');
  const [fixStatus, setFixStatus] = useState<Record<number, FixStatus>>({});
  const [fixMsg, setFixMsg]       = useState<Record<number, string>>({});
  const [pcUrl, setPcUrl]         = useState<Record<number, string>>({});
  const [manualPrice, setManualPrice] = useState<Record<number, string>>({});
  const [saving, setSaving]       = useState<Record<number, boolean>>({});
  const [deleting, setDeleting]   = useState<Record<number, boolean>>({});
  const [holoEdit, setHoloEdit]   = useState<Record<number, boolean>>({});

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
    const NORMALS = new Set(['Normal','Common','Uncommon','Rare']);
    const matchHolo = !holoFilter || c.holo_type === holoFilter || (holoFilter === '__special__' && c.holo_type && !NORMALS.has(c.holo_type));
    return matchSearch && matchHolo;
  });

  async function patchCard(id: number, updates: { price?: number; image_url?: string }) {
    const res = await fetch('/api/cards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) throw new Error(await res.text());
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }

  async function fixCard(card: Card) {
    setFixStatus(p => ({ ...p, [card.id]: 'loading' }));
    setFixMsg(p => ({ ...p, [card.id]: '' }));
    setPcUrl(p => ({ ...p, [card.id]: '' }));
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

      // Always store the URL PC searched so user can inspect it
      if (pcData.url) setPcUrl(p => ({ ...p, [card.id]: pcData.url }));

      if (pcData.not_found) {
        setFixStatus(p => ({ ...p, [card.id]: 'not_found' }));
        setFixMsg(p => ({ ...p, [card.id]: `Not found — set manual price below` }));
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
        setFixMsg(p => ({ ...p, [card.id]: 'PC found page but no price or image — set manually below' }));
        return;
      }

      await patchCard(card.id, updates);
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

  async function saveManualPrice(card: Card) {
    const raw = manualPrice[card.id] ?? '';
    const pounds = parseFloat(raw.replace('£', '').trim());
    if (isNaN(pounds) || pounds < 0) return;
    setSaving(p => ({ ...p, [card.id]: true }));
    try {
      await patchCard(card.id, { price: Math.round(pounds * 100) });
      setFixStatus(p => ({ ...p, [card.id]: 'done' }));
      setFixMsg(p => ({ ...p, [card.id]: `Manual price saved: £${pounds.toFixed(2)}` }));
      setManualPrice(p => ({ ...p, [card.id]: '' }));
    } catch (e: any) {
      setFixMsg(p => ({ ...p, [card.id]: `Save failed: ${e.message}` }));
    } finally {
      setSaving(p => ({ ...p, [card.id]: false }));
    }
  }

  async function saveHoloType(card: Card, newType: string) {
    await patchCard(card.id, { holo_type: newType } as any);
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, holo_type: newType } : c));
    setHoloEdit(p => ({ ...p, [card.id]: false }));
    // Reset fix status so user can re-run with updated type
    setFixStatus(p => ({ ...p, [card.id]: 'idle' }));
    setFixMsg(p => ({ ...p, [card.id]: '' }));
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
              const st  = fixStatus[card.id] ?? 'idle';
              const msg = fixMsg[card.id] ?? '';
              const url = pcUrl[card.id] ?? '';
              const showManual = st === 'not_found' || st === 'fail';
              return (
                <tr key={card.id}>
                  <td style={s.td}>
                    <img src={card.image_url || '/placeholder.png'} alt="" style={s.thumb} />
                  </td>
                  <td style={s.td}>
                    <div style={s.name} title={card.name}>{card.name}</div>
                    {card.number && <div style={s.statusTxt}># {card.number}</div>}
                  </td>
                  <td style={s.td}>
                    {holoEdit[card.id] ? (
                      <select
                        style={{ ...s.filterSel, fontSize: 10, padding: '3px 4px' }}
                        defaultValue={card.holo_type ?? ''}
                        autoFocus
                        onChange={e => saveHoloType(card, e.target.value)}
                        onBlur={() => setHoloEdit(p => ({ ...p, [card.id]: false }))}
                      >
                        <option value="">—</option>
                        {ALL_HOLO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <span
                        style={{ ...s.holo, cursor: 'pointer' }}
                        title="Click to edit"
                        onClick={() => setHoloEdit(p => ({ ...p, [card.id]: true }))}
                      >
                        {card.holo_type ?? <span style={{ color: '#3a3a5a' }}>— edit</span>}
                      </span>
                    )}
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
                        ) : showManual ? (
                          <button style={s.btnFixFail} onClick={() => fixCard(card)}>✗ Retry PC</button>
                        ) : (
                          <button style={s.btnFix} onClick={() => fixCard(card)}>Fix Price &amp; Image</button>
                        )}
                        <button
                          style={{ ...s.btnDelete, opacity: deleting[card.id] ? 0.5 : 1 }}
                          disabled={deleting[card.id]}
                          onClick={() => deleteCard(card)}
                        >🗑</button>
                      </div>

                      {/* Status message */}
                      {msg && (
                        <div style={{ ...s.statusTxt, color: st === 'done' ? '#86efac' : st === 'not_found' ? '#fb923c' : '#f87171' }}>
                          {msg}
                        </div>
                      )}

                      {/* PC search URL — so you can see exactly what was searched */}
                      {url && (
                        <a href={url} target="_blank" rel="noreferrer"
                          style={{ fontSize: 10, color: '#4a6a9a', wordBreak: 'break-all' }}>
                          🔗 View PC page
                        </a>
                      )}

                      {/* Manual price entry — shown when PC lookup failed */}
                      {showManual && (
                        <div style={s.manualRow}>
                          <span style={{ fontSize: 10, color: '#5a5a8a' }}>Set price:</span>
                          <input
                            style={s.manualInput}
                            placeholder="£0.00"
                            value={manualPrice[card.id] ?? ''}
                            onChange={e => setManualPrice(p => ({ ...p, [card.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') saveManualPrice(card); }}
                          />
                          <button
                            style={{ ...s.btnSave, opacity: saving[card.id] ? 0.6 : 1 }}
                            disabled={saving[card.id]}
                            onClick={() => saveManualPrice(card)}
                          >{saving[card.id] ? '…' : 'Save'}</button>
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
