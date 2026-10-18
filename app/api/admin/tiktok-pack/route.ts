import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '@clerk/nextjs/server';
import {serverDb} from '@/lib/server-db';
import {makeTikTokPack} from '@/lib/tiktok-pack';
export async function POST(req:NextRequest){
  const user=await currentUser();
  if(user?.publicMetadata.role!=='admin')return NextResponse.json({error:'Admin access required.'},{status:403});
  if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Invalid request origin.'},{status:403});
  try{const {cardId}=await req.json();if(typeof cardId!=='string'||cardId.length>100)throw new Error('Choose a card.');
    const db=serverDb();const result=await db.from('Card').select('id,name,price,available,sold_at,updatedAt,set,number,condition,grading').eq('id',cardId).single();
    if(result.error||!result.data)throw new Error('This card is no longer available.');
    const pack=makeTikTokPack(result.data);
    const logged=await db.from('agent_events').insert({actor_id:user.id,title:'TikTok draft pack prepared',detail:`${result.data.name}. Download only; nothing sent to TikTok.`});
    if(logged.error)throw new Error('Could not record this draft. Please retry.');
    return NextResponse.json(pack,{headers:{'Cache-Control':'no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not prepare the draft.'},{status:400});}
}
