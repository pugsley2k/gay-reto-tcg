"use client";
import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface OrderItem { id: string; name: string; quantity: number; }
interface Order {
  id: string;
  status: string;
  total_pence: number | null;
  items: OrderItem[];
  created_at: string;
}

const s: Record<string, React.CSSProperties> = {
  wrap:      { fontFamily: 'Space Mono, monospace', color: '#d0d0f0', padding: '0 0 2rem' },
  toolbar:   { display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' },
  filterSel: { background: '#0f0f22', border: '1px solid #2d2d50', borderRadius: 6, color: '#d0d0f0', padding: '6px 8px', fontSize: 12 },
  table:     { width: '100%', borderCollapse: 'collapse' as const },
  th:        { textAlign: 'left' as const, fontSize: 10, color: '#5a5a8a', padding: '6px 8px', borderBottom: '1px solid #1e1e3a', letterSpacing: '0.1em', textTransform: 'uppercase' as const },
  td:        { padding: '10px 8px', borderBottom: '1px solid #111128', verticalAlign: 'top' as const, fontSize: 12 },
};

function badgeStyle(status: string): React.CSSProperties {
  return {
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
    background: status === 'completed' ? 'rgba(6,214,160,0.15)' : status === 'pending' ? 'rgba(255,209,102,0.15)' : 'rgba(255,62,108,0.15)',
    color:      status === 'completed' ? '#06d6a0' : status === 'pending' ? '#ffd166' : '#ff3e6c',
    border:     `1px solid ${status === 'completed' ? 'rgba(6,214,160,0.3)' : status === 'pending' ? 'rgba(255,209,102,0.3)' : 'rgba(255,62,108,0.3)'}`,
  };
}

export default function AdminOrderLog() {
  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data } = await q;
    setOrders((data as Order[]) ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + (o.total_pence ?? 0), 0);

  return (
    <div style={s.wrap}>
      <div style={s.toolbar}>
        <select style={s.filterSel} value={statusFilter} onChange={e => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span style={{ fontSize: 11, color: '#4a4a72' }}>{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
        {totalRevenue > 0 && (
          <span style={{ fontSize: 11, color: '#06d6a0', marginLeft: 'auto' }}>
            ✓ Revenue: <strong>£{(totalRevenue / 100).toFixed(2)}</strong>
          </span>
        )}
        <button style={{ background: '#1a1a30', border: '1px solid #2d2d50', borderRadius: 5, color: '#a0a0c0', padding: '5px 12px', fontSize: 11, cursor: 'pointer' }} onClick={load}>↺ Refresh</button>
      </div>

      {loading ? (
        <p style={{ color: '#4a4a72', fontSize: 12 }}>Loading…</p>
      ) : orders.length === 0 ? (
        <p style={{ color: '#3a3a5a', fontSize: 12 }}>No orders found.</p>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Order ID</th>
              <th style={s.th}>Date</th>
              <th style={s.th}>Items</th>
              <th style={s.th}>Total</th>
              <th style={s.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td style={s.td}>
                  <span style={{ fontSize: 10, color: '#4a4a72', fontFamily: 'monospace' }}>
                    {order.id.slice(0, 8)}…
                  </span>
                </td>
                <td style={s.td}>
                  <span style={{ fontSize: 11, color: '#7070a0' }}>
                    {order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : '—'}
                  </span>
                </td>
                <td style={s.td}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {(order.items ?? []).map((item, i) => (
                      <span key={i} style={{ fontSize: 11, color: '#c0c0e0' }}>
                        {item.quantity > 1 && <span style={{ color: '#a78bfa', marginRight: 4 }}>×{item.quantity}</span>}
                        {item.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={s.td}>
                  <span style={{ color: '#ffd166', fontWeight: 700 }}>
                    {order.total_pence != null ? `£${(order.total_pence / 100).toFixed(2)}` : '—'}
                  </span>
                </td>
                <td style={s.td}>
                  <span style={badgeStyle(order.status)}>{order.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
