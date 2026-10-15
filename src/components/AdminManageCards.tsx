"use client";
import studio from './SellerStudio.module.css';
import legacy from './AdminManageCards.module.css';
import React, { useEffect, useState, useCallback } from "react";
import { CARD_EDITIONS } from '@/lib/card-edition';
import { CARD_CONDITIONS } from '@/lib/card-condition';
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
  available: boolean | null;
  condition: string | null;
  edition: string | null;
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
  wrap:       { fontFamily: 'Manrope, sans-serif', color: '#f0eee7', padding: '0 0 2rem' },
  toolbar:    { display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' },
  searchBox:  { background: '#191b20', border: '1px solid #34383f', borderRadius: 6, color: '#f0eee7', padding: '6px 10px', fontSize: 13, flex: 1, minWidth: 180 },
  filterSel:  { background: '#191b20', border: '1px solid #34383f', borderRadius: 6, color: '#f0eee7', padding: '6px 8px', fontSize: 12 },
  table:      { width: '100%', borderCollapse: 'collapse' as const },
  th:         { textAlign: 'left' as const, fontSize: 10, color: '#b8b7b0', padding: '6px 8px', borderBottom: '1px solid #191b20', letterSpacing: '0.1em', textTransform: 'uppercase' as const },
  td:         { padding: '8px', borderBottom: '1px solid #191b20', verticalAlign: 'top' as const, fontSize: 12 },
  thumb:      { width: 40, height: 56, objectFit: 'contain' as const, borderRadius: 3, background: '#191b20' },
  name:       { maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontSize: 11, color: '#f0eee7' },
  holo:       { fontSize: 10, color: '#faeac4', background: 'rgba(250,234,196,0.12)', padding: '2px 6px', borderRadius: 4 },
  price:      { fontSize: 13, color: '#faeac4', fontWeight: 700 },
  btnFix:     { background: '#faeac4', border: 'none', borderRadius: 5, color: '#191b20', padding: '5px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  btnFixDone: { background: '#191b20', border: '1px solid #34383f', borderRadius: 5, color: '#86efac', padding: '5px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  btnFixFail: { background: '#191b20', border: '1px solid #34383f', borderRadius: 5, color: '#f87171', padding: '5px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  btnDelete:  { background: 'transparent', border: '1px solid #191b20', borderRadius: 5, color: '#f87171', padding: '5px 10px', fontSize: 11, cursor: 'pointer' },
  btnSave:    { background: '#34383f', border: '1px solid #34383f', borderRadius: 5, color: '#faeac4', padding: '4px 10px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  statusTxt:  { fontSize: 10, marginTop: 2, color: '#b8b7b0' },
  manualRow:  { display: 'flex', gap: 5, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' as const },
  manualInput:{ background: '#191b20', border: '1px solid #34383f', borderRadius: 4, color: '#faeac4', padding: '3px 7px', fontSize: 12, width: 80 },
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
      .select('id, name, number, set, holo_type, language, price, image_url, available, condition, edition')
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

  async function patchCard(id: number, updates: { price?: number; image_url?: string; condition?: string | null; edition?: string | null }) {
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

      const SPECIAL_HOLOS = new Set(['Pokeball Holo', 'Master Ball Holo', 'Cosmos Holo']);
      const isSpecialHolo = SPECIAL_HOLOS.has(card.holo_type ?? '');

      const updates: { price?: number; image_url?: string } = {};
      // For special holos, only save the image — PC has no specific price for these variants
      if (pcData.image_url) updates.image_url = pcData.image_url;
      if (pcData.price && !isSpecialHolo) updates.price = pcData.price;

      if (!Object.keys(updates).length) {
        setFixStatus(p => ({ ...p, [card.id]: 'not_found' }));
        setFixMsg(p => ({ ...p, [card.id]: 'PC found page but no image — set price manually below' }));
        return;
      }

      await patchCard(card.id, updates);
      setFixStatus(p => ({ ...p, [card.id]: isSpecialHolo ? 'not_found' : 'done' }));
      const parts: string[] = [];
      if (updates.image_url) parts.push('image updated');
      if (isSpecialHolo) parts.push('set price manually — PC has no Pokeball/MB/Cosmos Holo pricing');
      else if (updates.price) parts.push(`£${(updates.price / 100).toFixed(2)}`);
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

  async function toggleAvailable(card: Card) {
    const next = !card.available;
    const { error } = await supabase.from('Card').update({ available: next }).eq('id', card.id);
    if (!error) setCards(prev => prev.map(c => c.id === card.id ? { ...c, available: next } : c));
  }

  async function deleteCard(card: Card) {
    if (!confirm(`Delete "${card.name}"? This cannot be undone.`)) return;
    setDeleting(p => ({ ...p, [card.id]: true }));
    const { error } = await supabase.from('Card').delete().eq('id', card.id);
    if (error) { alert(error.message); setDeleting(p => ({ ...p, [card.id]: false })); return; }
    setCards(prev => prev.filter(c => c.id !== card.id));
  }

  const [fixAllRunning, setFixAllRunning] = useState(false);
  const [fixAllProgress, setFixAllProgress] = useState('');

  async function fixAll() {
    const toFix = filtered.filter(c => fixStatus[c.id] !== 'done');
    if (!toFix.length) return;
    if (!confirm(`Run Fix Price & Image on ${toFix.length} card(s)? This may take a while.`)) return;
    setFixAllRunning(true);
    for (let i = 0; i < toFix.length; i++) {
      const card = toFix[i];
      setFixAllProgress(`${i + 1} / ${toFix.length} — ${card.name?.split(' ')[0] ?? ''}…`);
      await fixCard(card);
    }
    setFixAllRunning(false);
    setFixAllProgress('');
  }

  const allHoloTypes = [...new Set(cards.map(c => c.holo_type).filter(Boolean))].sort();

  return (
    <div className={legacy.style0}><header><h2>Inventory</h2><p>Find listings and update their price, condition or availability.</p></header>
      <div className={legacy.style1}>
        <input
          className={legacy.style2}
          aria-label="Search inventory" placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select aria-label="Filter by finish" className={legacy.style3} value={holoFilter} onChange={e => setHoloFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="__special__">Special holos only</option>
          {allHoloTypes.map(h => <option key={h!} value={h!}>{h}</option>)}
        </select>
        <span className={legacy.style4}>{filtered.length} card{filtered.length !== 1 ? 's' : ''}</span>
        <button className={legacy.style5} onClick={load}>Refresh</button>
        <button
          style={{ ...s.btnFix, opacity: fixAllRunning ? 0.6 : 1, whiteSpace: 'nowrap' }}
          disabled={fixAllRunning}
          onClick={fixAll}
        >
          {fixAllRunning ? `${fixAllProgress}` : 'Update all prices & images'}
        </button>
      </div>

      {loading ? (
        <p className={legacy.style6}>Loading…</p>
      ) : (
        <div className={studio.tableScroll} role="region" aria-label="Card inventory" tabIndex={0}><table className={legacy.style7}>
          <thead>
            <tr>
              <th className={legacy.style8}></th>
              <th className={legacy.style9}>Name</th>
              <th className={legacy.style10}>Type</th>
              <th className={legacy.style11}>Lang</th>
              <th className={legacy.style12}>Price</th>
              <th className={legacy.style13}>Actions</th>
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
                  <td className={legacy.style14}>
                    <img src={card.image_url || '/placeholder.png'} alt="" className={legacy.style15} />
                  </td>
                  <td className={legacy.style16}>
                    <div className={legacy.style17} title={card.name}>{card.name}</div>
                    {card.number && <div className={legacy.style18}># {card.number}</div>}
                    <label className={legacy.style19}>Edition<select aria-label={`Edition for ${card.name}`} className={legacy.style20} value={card.edition || ''} disabled={saving[card.id]} onChange={async e=>{setSaving(p=>({...p,[card.id]:true}));try{await patchCard(card.id,{edition:e.target.value || null});}catch(error){setFixMsg(p=>({...p,[card.id]:error instanceof Error?error.message:'Could not save edition.'}));}finally{setSaving(p=>({...p,[card.id]:false}));}}}><option value="">Not specified</option>{CARD_EDITIONS.map(v=><option key={v}>{v}</option>)}</select></label>
                    <label className={legacy.style21}>Condition<select aria-label={`Condition for ${card.name}`} className={legacy.style22} value={card.condition || ''} disabled={saving[card.id]} onChange={async e=>{setSaving(p=>({...p,[card.id]:true}));try{await patchCard(card.id,{condition:e.target.value || null});}catch(error){setFixMsg(p=>({...p,[card.id]:error instanceof Error?error.message:'Could not save condition.'}));}finally{setSaving(p=>({...p,[card.id]:false}));}}}><option value="">Not specified</option>{CARD_CONDITIONS.map(c=><option key={c.value}>{c.value}</option>)}</select></label>
                  </td>
                  <td className={legacy.style23}>
                    {holoEdit[card.id] ? (
                      <select
                        className={legacy.style24}
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
                        className={legacy.style25}
                        title="Click to edit"
                        onClick={() => setHoloEdit(p => ({ ...p, [card.id]: true }))}
                      >
                        {card.holo_type ?? <span className={legacy.style26}>— edit</span>}
                      </span>
                    )}
                  </td>
                  <td className={legacy.style27}>
                    <span className={legacy.style28}>
                      {card.language === 'Japanese' ? '🇯🇵' : card.language === 'Korean' ? '🇰🇷' : '🇬🇧'}{' '}
                      {card.language ?? 'EN'}
                    </span>
                  </td>
                  <td className={legacy.style29}>
                    <span className={legacy.style30}>
                      {typeof card.price === 'number' ? `£${(card.price / 100).toFixed(2)}` : '—'}
                    </span>
                  </td>
                  <td className={legacy.style31}>
                    <div className={legacy.style32}>
                      <div className={legacy.style33}>
                        {st === 'loading' ? (
                          <button className={legacy.style34} disabled>Checking PC…</button>
                        ) : st === 'done' ? (
                          <button className={legacy.style35} onClick={() => fixCard(card)}>✓ Fixed · Retry?</button>
                        ) : showManual ? (
                          <button className={legacy.style36} onClick={() => fixCard(card)}>✗ Retry PC</button>
                        ) : (
                          <button className={legacy.style37} onClick={() => fixCard(card)}>Update price &amp; image</button>
                        )}
                        <button
                          title={card.available ? 'Take off sale' : 'Make available'}
                          style={{
                            background: card.available ? 'rgba(250,234,196,0.12)' : 'rgba(233,167,155,0.12)',
                            border: `1px solid ${card.available ? 'rgba(250,234,196,0.12)' : 'rgba(233,167,155,0.12)'}`,
                            borderRadius: 5, color: card.available ? '#faeac4' : '#e9a79b',
                            padding: '5px 8px', fontSize: 11, cursor: 'pointer',
                          }}
                          onClick={() => toggleAvailable(card)}
                        >{card.available ? 'Available' : 'Off sale'}</button>
                        <button
                          style={{ ...s.btnDelete, opacity: deleting[card.id] ? 0.5 : 1 }}
                          disabled={deleting[card.id]}
                          onClick={() => deleteCard(card)}
                        >Delete</button>
                      </div>

                      {/* Status message */}
                      {msg && (
                        <div style={{ ...s.statusTxt, color: st === 'done' ? '#86efac' : st === 'not_found' ? '#e9a79b' : '#f87171' }}>
                          {msg}
                        </div>
                      )}

                      {/* PC search URL — so you can see exactly what was searched */}
                      {url && (
                        <a href={url} target="_blank" rel="noreferrer"
                          className={legacy.style38}>
                          🔗 View PC page
                        </a>
                      )}

                      {/* Manual price entry — shown when PC lookup failed */}
                      {showManual && (
                        <div className={legacy.style39}>
                          {/* Quick-pick buttons */}
                          <div className={legacy.style40}>
                            {[1,2,3,4,5,6,7,8].map(p => (
                              <button
                                key={p}
                                className={legacy.style41}
                                disabled={saving[card.id]}
                                onClick={() => {
                                  setManualPrice(prev => ({ ...prev, [card.id]: String(p) }));
                                  patchCard(card.id, { price: p * 100 }).then(() => {
                                    setFixStatus(prev => ({ ...prev, [card.id]: 'done' }));
                                    setFixMsg(prev => ({ ...prev, [card.id]: `£${p}.00 saved` }));
                                  });
                                }}
                              >£{p}</button>
                            ))}
                          </div>
                          {/* Manual input */}
                          <div className={legacy.style42}>
                            <span className={legacy.style43}>Other:</span>
                            <input
                              className={legacy.style44}
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
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
