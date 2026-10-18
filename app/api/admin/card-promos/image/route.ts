import {NextRequest,NextResponse} from 'next/server';
import {isAdmin} from '@/lib/admin';
import {serverDb} from '@/lib/server-db';
import {allowedPromoImage} from '@/lib/card-promo';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
  if(!await isAdmin())return new NextResponse('Admin access required.',{status:403});
  try{
    const card=req.nextUrl.searchParams.get('cardId'); const revision=Number(req.nextUrl.searchParams.get('revision'));
    if(!card||card.length>100||!Number.isSafeInteger(revision)||revision<1)throw new Error('Invalid image.');
    const result=await serverDb().rpc('card_promo_details',{p_card:card,p_revision:revision});
    if(result.error||!result.data)throw new Error('Listing changed. Refresh the promo.');
    const url=result.data.image_url;
    if(typeof url!=='string'||!allowedPromoImage(url))throw new Error('Matching catalogue artwork is required. Photos are never used.');
    const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(8000),cache:'no-store'});
    const type=response.headers.get('content-type')?.split(';')[0]||'';
    if(!response.ok||!['image/jpeg','image/png','image/webp','image/avif'].includes(type))throw new Error('Could not load card photograph.');
    if(Number(response.headers.get('content-length'))>12_000_000)throw new Error('Image is too large.');
    const reader=response.body?.getReader(); if(!reader)throw new Error('Missing image.');
    const chunks:Uint8Array[]=[];let length=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>12_000_000)throw new Error('Image is too large.');chunks.push(value);}}finally{await reader.cancel();}
    const buffer=new Uint8Array(length);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
    return new NextResponse(buffer,{headers:{'Content-Type':type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){return new NextResponse(error instanceof Error?error.message:'Could not load photograph.',{status:409});}
}
