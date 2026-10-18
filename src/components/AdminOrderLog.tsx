"use client";
import { useCallback, useEffect, useState } from 'react';
import PostageConnection from './PostageConnection';
import DispatchTools from './DispatchTools';
import styles from './AdminOrderLog.module.css';
type Order = { carrier_order_id?:string;carrier_cost_pence?:number|null;payment_fee_pence?:number|null; id:string;status:string;items:{name:string;quantity:number}[];created_at:string;paid_at?:string;customer_email?:string;tracking_number?:string;dispatched_at?:string;shipping?:{label:string;price:number;total:number;compensation:number};order_emails:{id:string;kind:string;sent_at?:string;last_error?:string}[] };
export default function AdminOrderLog() {
  const [orders,setOrders]=useState<Order[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState('');
  const [tracking,setTracking]=useState<Record<string,string>>({});
  const load=useCallback(async()=>{
    setLoading(true);
    try { const res=await fetch('/api/admin/orders',{cache:'no-store'}); const data=await res.json(); if(!res.ok)throw new Error(data.error);setOrders(data.orders);setError(''); }
    catch(error){setError(error instanceof Error?error.message:'Could not load orders.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  async function testEmail() {
    setBusy('test');setError('');setNotice('');
    try {const res=await fetch('/api/admin/email-test',{method:'POST'});const data=await res.json();if(!res.ok)throw new Error(data.error);setNotice(data.message);}catch(error){setError(error instanceof Error?error.message:'Test failed.');}finally{setBusy('');}
  }
  async function update(order:Order,action:'dispatch'|'retry') {
    setBusy(order.id);setNotice('');setError('');
    try {const res=await fetch('/api/admin/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:order.id,action,tracking:tracking[order.id]||order.tracking_number})}); const data=await res.json();if(!res.ok)throw new Error(data.error);setNotice(data.message);await load();}
    catch(error){setError(error instanceof Error?error.message:'Could not update order.');}finally{setBusy('');}
  }
  return <section className={styles.orders} aria-label="Orders"><header><div><h2>Orders &amp; dispatch</h2><p>Confirmations send after payment. Add the Royal Mail reference once posted to email tracking.</p></div><button onClick={load} disabled={loading}>Refresh</button><button onClick={testEmail} disabled={!!busy}>Send setup test to your Gmail</button></header>
    <PostageConnection />{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {loading?<p>Loading orders…</p>:!orders.length?<p>No orders yet.</p>:orders.map(order=><article key={order.id} className={styles.order}>
      <div className={styles.summary}><h3>Order {order.id.slice(0,8)}</h3><span>{order.status==='payment_review'?'Payment review':order.dispatched_at?'Dispatched':order.paid_at?'Paid':order.status==='pending'?'Awaiting payment':order.status}</span><strong>{order.shipping?`£${(order.shipping.total/100).toFixed(2)}`:'—'}</strong></div>
      <p>{new Date(order.created_at).toLocaleString('en-GB')} · {order.customer_email||'Customer email available after payment'}</p>
      <ul>{(order.items||[]).map((item,i)=><li key={i}>{item.quantity} × {item.name}</li>)}</ul>
      {order.shipping&&<p>{order.shipping.label} · £{(order.shipping.price/100).toFixed(2)} postage &amp; packing · compensation band £{(order.shipping.compensation/100).toFixed(0)}</p>}
      {order.status==='payment_review'&&<p role="alert">Payment received, but stock needs review. Do not dispatch or request another payment.</p>}{order.paid_at&&order.status!=='payment_review'&&<DispatchTools id={order.id} linked={order.carrier_order_id} postage={order.carrier_cost_pence} fee={order.payment_fee_pence} onUpdate={load}/>}<div className={styles.emails}>{['confirmation','tracking'].map(kind=>{const email=order.order_emails?.find(value=>value.kind===kind);return <p key={kind}>{kind==='confirmation'?'Order confirmation':'Tracking email'}: {email?.sent_at?'Accepted by email service':email?.last_error?email.last_error:email?'Queued':kind==='tracking'?'Waiting for dispatch':'Waiting for completed payment'}</p>;})}</div>
      {order.paid_at&&order.status!=='payment_review'&&order.customer_email&&<div className={styles.actions}><label htmlFor={`tracking-${order.id}`}>Royal Mail tracking reference<input id={`tracking-${order.id}`} value={tracking[order.id]??order.tracking_number??''} disabled={!!order.tracking_number||busy===order.id} onChange={e=>setTracking(prev=>({...prev,[order.id]:e.target.value}))} autoCapitalize="characters" maxLength={30} /></label><button disabled={busy===order.id||!!order.tracking_number} onClick={()=>update(order,'dispatch')}>{busy===order.id?'Saving…':'Mark posted & email tracking'}</button>{order.order_emails?.some(email=>!email.sent_at)&&<button disabled={busy===order.id} onClick={()=>update(order,'retry')}>Retry pending emails</button>}</div>}
    </article>)}
  </section>;
}
