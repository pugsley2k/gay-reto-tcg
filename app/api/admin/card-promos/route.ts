import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '@clerk/nextjs/server';
import {isAdmin} from '@/lib/admin';
import {serverDb} from '@/lib/server-db';
import {makeCardPromo} from '@/lib/card-promo';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
  if(!await isAdmin())return NextResponse.json({error:'Admin access required.'},{status:403});
  const db=serverDb(); const cardId=req.nextUrl.searchParams.get('cardId');
  try{
    if(cardId){
      const revision=Number(req.nextUrl.searchParams.get('revision'));
      if(cardId.length>100||!Number.isSafeInteger(revision)||revision<1)throw new Error('Invalid promo.');
      const result=await db.rpc('card_promo_details',{p_card:cardId,p_revision:revision});
      if(result.error)throw new Error(result.error.message);
      return NextResponse.json(makeCardPromo(result.data,revision),{headers:{'Cache-Control':'no-store'}});
    }
    const result=await db.from('card_promos').select('card_id,revision,state,updated_at,Card(name,price)').order('updated_at',{ascending:false}).limit(100);
    if(result.error)throw new Error('Could not load promo drafts.');
    return NextResponse.json({drafts:result.data},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not load promos.'},{status:409});}
}
export async function POST(req:NextRequest){
  const user=await currentUser();
  if(user?.publicMetadata.role!=='admin'||req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Admin access required.'},{status:403});
  try{
    const {cardId,revision,decision}=await req.json();
    if(typeof cardId!=='string'||cardId.length>100||!Number.isSafeInteger(revision)||revision<1||!['exported','dismissed'].includes(decision))throw new Error('Invalid promo decision.');
    const result=await serverDb().rpc('decide_card_promo',{p_card:cardId,p_revision:revision,p_decision:decision,p_actor:user.id});
    if(result.error)throw new Error(result.error.message);
    return NextResponse.json({message:decision==='exported'?'Export recorded. Nothing posted to TikTok.':'Draft dismissed.'});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not save promo decision.'},{status:409});}
}
