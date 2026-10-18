import {NextRequest,NextResponse} from 'next/server';
import {serverDb} from '@/lib/server-db';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
  const id=req.nextUrl.searchParams.get('id');
  if(!id||id.length>100||id==='demo-gardevoir-ex')return NextResponse.json({available:false},{status:400});
  const db=serverDb();
  const [stock,reservations]=await Promise.all([
    db.from('Card').select('id,name,price,available,sold_at,updatedAt').eq('id',id).maybeSingle(),
    db.from('checkout_reservations').select('orders(checkout_state,reservation_expires_at)').eq('card_id',id),
  ]);
  if(stock.error||reservations.error)return NextResponse.json({error:'Stock check unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});
  const held=(reservations.data||[]).some(row=>{const order=Array.isArray(row.orders)?row.orders[0]:row.orders;return order&&(['capturing','payment_review'].includes(order.checkout_state)||order.checkout_state==='reserved'&&Date.parse(order.reservation_expires_at)>Date.now());});
  const card=stock.data;
  return NextResponse.json(card?.available&&!card.sold_at&&!held?{id:card.id,name:card.name,price:card.price,updatedAt:card.updatedAt,available:true}:{available:false},{headers:{'Cache-Control':'no-store'}});
}
