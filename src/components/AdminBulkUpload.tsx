"use client";
import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EXPECTED_COLS = ['name','number','set','price','holo_type','language','rarity','image_url'];

interface ParsedRow {
  name: string; number: string; set: string; price: number;
  holo_type: string; language: string; rarity: string; image_url: string;
  _error?: string;
}

function parseCSV(raw: string): ParsedRow[] {
  const lines = raw.trim().split('\n').filter(l => l.trim());
  if (!lines.length) return [];
  // detect if first row is a header
  const first = lines[0].toLowerCase().replace(/\s/g, '');
  const hasHeader = EXPECTED_COLS.some(c => first.includes(c));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line, i) => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const [name='', number='', set='', priceRaw='', holo_type='Normal', language='English', rarity='', image_url=''] = cols;
    const price = Math.round(parseFloat(priceRaw.replace('£','').replace('$','')) * 100);
    const _error = !name ? 'Missing name'
                 : isNaN(price) || price < 0 ? `Invalid price "${priceRaw}"`
                 : undefined;
    return { name, number, set, price: isNaN(price) ? 0 : price, holo_type, language, rarity, image_url, _error };
  });
}

const s: React.CSSProperties & Record<string, any> = {};

export default function AdminBulkUpload() {
  const [csv, setCsv]           = useState('');
  const [rows, setRows]         = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]     = useState<string>('');

  function handleParse() {
    setResult('');
    setRows(parseCSV(csv));
  }

  async function handleUpload() {
    const valid = rows.filter(r => !r._error);
    if (!valid.length) return;
    setUploading(true);
    setResult('');
    const inserts = valid.map(r => ({
      name: r.name, number: r.number || null, set: r.set || null,
      price: r.price, holo_type: r.holo_type || 'Normal',
      language: r.language || 'English', rarity: r.rarity || null,
      image_url: r.image_url || null, available: true,
    }));
    const { error, data } = await supabase.from('Card').insert(inserts).select('id');
    setUploading(false);
    if (error) { setResult(`❌ Error: ${error.message}`); return; }
    setResult(`✓ Inserted ${data?.length ?? valid.length} cards successfully!`);
    setCsv('');
    setRows([]);
  }

  const validCount   = rows.filter(r => !r._error).length;
  const invalidCount = rows.filter(r =>  r._error).length;

  const inputStyle: React.CSSProperties = {
    background: '#0f0f22', border: '1px solid #2d2d50', borderRadius: 6,
    color: '#d0d0f0', padding: '10px', fontSize: 12, width: '100%',
    fontFamily: 'Space Mono, monospace', resize: 'vertical' as const,
  };
  const btnStyle: React.CSSProperties = {
    background: 'linear-gradient(90deg,#7c6af0,#b84fff)', border: 'none',
    borderRadius: 5, color: '#fff', padding: '8px 18px', fontSize: 12,
    cursor: 'pointer', fontFamily: 'Space Mono, monospace',
  };
  const thStyle: React.CSSProperties = {
    textAlign: 'left', fontSize: 10, color: '#5a5a8a', padding: '6px 8px',
    borderBottom: '1px solid #1e1e3a', letterSpacing: '0.1em', textTransform: 'uppercase',
  };
  const tdStyle: React.CSSProperties = {
    padding: '6px 8px', borderBottom: '1px solid #111128', fontSize: 11,
    verticalAlign: 'top',
  };

  return (
    <div style={{ fontFamily: 'Space Mono, monospace', color: '#d0d0f0', paddingBottom: '2rem' }}>
      <p style={{ fontSize: 11, color: '#5a5a8a', marginBottom: '0.5rem' }}>
        Expected columns (comma-separated): <code style={{ color: '#a78bfa' }}>{EXPECTED_COLS.join(', ')}</code>
      </p>
      <p style={{ fontSize: 11, color: '#5a5a8a', marginBottom: '1rem' }}>
        Price should be in pounds (e.g. <code style={{ color: '#ffd166' }}>1.50</code>). A header row is optional.
      </p>

      <textarea
        style={{ ...inputStyle, minHeight: 180 }}
        placeholder={`Charizard,4/102,Base Set,45.00,Holo Rare,English,Rare Holo,https://…\nPikachu,58/102,Base Set,3.50,Normal,English,Common,`}
        value={csv}
        onChange={e => { setCsv(e.target.value); setRows([]); }}
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={btnStyle} onClick={handleParse} disabled={!csv.trim()}>
          Preview
        </button>
        {validCount > 0 && (
          <button
            style={{ ...btnStyle, background: uploading ? '#1a3a1a' : 'linear-gradient(90deg,#06d6a0,#118ab2)', opacity: uploading ? 0.7 : 1 }}
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : `Upload ${validCount} card${validCount !== 1 ? 's' : ''}`}
          </button>
        )}
        {invalidCount > 0 && (
          <span style={{ fontSize: 11, color: '#f87171' }}>⚠ {invalidCount} row{invalidCount !== 1 ? 's' : ''} with errors (will be skipped)</span>
        )}
        {result && <span style={{ fontSize: 11, color: result.startsWith('✓') ? '#06d6a0' : '#f87171' }}>{result}</span>}
      </div>

      {rows.length > 0 && (
        <div style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}></th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Number</th>
                <th style={thStyle}>Set</th>
                <th style={thStyle}>Price</th>
                <th style={thStyle}>Holo Type</th>
                <th style={thStyle}>Language</th>
                <th style={thStyle}>Rarity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ opacity: row._error ? 0.5 : 1 }}>
                  <td style={tdStyle}>
                    {row._error
                      ? <span title={row._error} style={{ color: '#f87171', fontSize: 12 }}>✗</span>
                      : <span style={{ color: '#06d6a0', fontSize: 12 }}>✓</span>
                    }
                  </td>
                  <td style={{ ...tdStyle, color: '#c0c0e0' }}>{row.name}</td>
                  <td style={tdStyle}>{row.number || '—'}</td>
                  <td style={tdStyle}>{row.set || '—'}</td>
                  <td style={{ ...tdStyle, color: '#ffd166' }}>£{(row.price / 100).toFixed(2)}</td>
                  <td style={{ ...tdStyle, color: '#a78bfa' }}>{row.holo_type}</td>
                  <td style={tdStyle}>{row.language}</td>
                  <td style={tdStyle}>{row.rarity || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
