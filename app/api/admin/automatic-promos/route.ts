import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '@clerk/nextjs/server';
import {isAdmin} from '@/lib/admin';
import {serverDb} from '@/lib/server-db';
import {promoSnapshot,signedPromoVideo} from '@/lib/automatic-promos';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:NextRequest){
 if(!await isAdmin())return reply({error:'Admin access required.'},403);
 try{const db=serverDb();const id=req.nextUrl.searchParams.get('id');
  if(id){const result=await db.from('card_promo_media').select('*').eq('id',id).single();if(result.error||!result.data?.video_path)throw new Error('Video is not ready.');await promoSnapshot(result.data.card_id,result.data.revision);return reply({videoUrl:await signedPromoVideo(result.data.video_path),video:result.data});}
  const [workers,jobs,drafts]=await Promise.all([
   db.from('promo_workers').select('id,name,enabled,last_seen_at,account_hash,account_label,tiktok_connected,last_error'),
   db.from('card_promo_media').select('id,card_id,revision,render_state,tiktok_state,video_sha256,caption,last_error,updated_at,approval_expires_at,worker_id,Card(name,price)').order('created_at',{ascending:false}).limit(100),
   db.from('card_promos').select('card_id,revision,state')]);
  if(workers.error||jobs.error||drafts.error)throw new Error('Automatic promos are not ready yet.');
  return reply({workers:workers.data,jobs:jobs.data.filter(job=>drafts.data.some(d=>d.card_id===job.card_id&&d.revision===job.revision&&d.state!=='unavailable'&&d.state!=='dismissed')||['sending','processing','inbox','uncertain'].includes(job.tiktok_state))});
 }catch(error){return reply({error:error instanceof Error?error.message:'Could not load automatic promos.'},409);}
}
export async function POST(req:NextRequest){
 const user=await currentUser();if(user?.publicMetadata.role!=='admin'||req.headers.get('origin')!==req.nextUrl.origin)return reply({error:'Admin access required.'},403);
 try{const body=await req.json();const db=serverDb();
  if(body.action==='worker'){
   if(!/^[a-f0-9-]{36}$/.test(body.id)||typeof body.enabled!=='boolean')throw new Error('Invalid worker.');
   const result=await db.from('promo_workers').update({enabled:body.enabled}).eq('id',body.id);if(result.error)throw new Error('Could not change worker status.');return reply({message:body.enabled?'PC worker enabled.':'PC worker disabled. No new jobs can be claimed.'});
  }
  if(body.action==='label'){
   if(!/^[a-f0-9-]{36}$/.test(body.id)||!/^[a-f0-9]{64}$/.test(body.accountHash)||typeof body.label!=='string'||!/^@?[A-Za-z0-9._]{2,24}$/.test(body.label))throw new Error('Enter a TikTok username.');
   const result=await db.from('promo_workers').update({account_label:'@'+body.label.replace(/^@/,'')}).eq('id',body.id).eq('account_hash',body.accountHash).select('id');if(result.error||!result.data?.length)throw new Error('The account changed. Refresh before verifying it.');return reply({message:'Account label saved. Verify this is the correct saved TikTok login before each upload.'});
  }
  if(!/^[a-f0-9-]{36}$/.test(body.id))throw new Error('Invalid video.');
  if(body.action==='approve'){
   if(body.confirmed!==true||typeof body.sha256!=='string'||typeof body.caption!=='string'||typeof body.accountHash!=='string')throw new Error('Review the video and confirm the TikTok account before approving.');
   const result=await db.rpc('approve_promo_upload',{p_id:body.id,p_sha:body.sha256,p_caption:body.caption,p_account:body.accountHash,p_actor:user.id});if(result.error)throw new Error(result.error.message);return reply({message:'Approved. The PC will send this exact video to the verified TikTok inbox. Finish publishing in TikTok.'});
  }
  const {data:job,error}=await db.from('card_promo_media').select('*').eq('id',body.id).single();if(error||!job)throw new Error('Video not found.');
  if(body.action==='retry-render'){
   await promoSnapshot(job.card_id,job.revision);if(job.render_state!=='failed')throw new Error('This render is not eligible for retry.');
   const result=await db.from('card_promo_media').update({render_state:'queued',attempts:0,last_error:null,updated_at:new Date().toISOString()}).eq('id',job.id).eq('render_state','failed');if(result.error)throw new Error('Could not retry render.');return reply({message:'Render queued again.'});
  }
  if(body.action==='cancel'){
   const result=await db.from('card_promo_media').update({tiktok_state:'cancelled',approval_id:null,updated_at:new Date().toISOString()}).eq('id',job.id).eq('tiktok_state','approved').select('id');if(result.error||!result.data?.length)throw new Error('The upload has already started. Refresh its status.');return reply({message:'Pending upload cancelled.'});
  }
  throw new Error('Unknown action.');
 }catch(error){return reply({error:error instanceof Error?error.message:'Could not update promo.'},409);}
}
