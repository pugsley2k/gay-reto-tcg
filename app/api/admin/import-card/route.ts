import {NextRequest, NextResponse} from 'next/server';
import {isAdmin} from '@/lib/admin';
import {importPriceChartingItem} from '@/lib/pricecharting-import';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest) {
  if (!await isAdmin() || req.headers.get('origin')!==req.nextUrl.origin) return NextResponse.json({error:'Admin access required.'},{status:403});
  try {
    if(Number(req.headers.get('content-length'))>4096)throw new Error('Paste one item link.');
    const body=await req.json();
    const card=await importPriceChartingItem(body.url);
    return NextResponse.json(card,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error && !/fetch failed|redirect|abort|timeout/i.test(error.message)?error.message:'PriceCharting could not be read right now. Try again later or use manual listing.'},{status:400,headers:{'Cache-Control':'no-store'}});
  }
}
