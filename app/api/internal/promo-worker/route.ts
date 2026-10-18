import {NextRequest,NextResponse} from 'next/server';
import {serverDb} from '@/lib/server-db';
import {ensurePromoBucket,MAX_PROMO_BYTES,PROMO_BUCKET,promoSnapshot,sha256,signedPromoVideo,workerFor} from '@/lib/automatic-promos';
export const dynamic='force-dynamic';
export const maxDuration=60;
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest){
 let worker;try{worker=await workerFor(req);}catch{return reply({error:'Worker authentication required.'},401);}
 try{
  const body=await req.json();const db=serverDb();
  if(body.action==='tick'){
   if(body.accountHash!==null&&!/^[a-f0-9]{64}$/.test(body.accountHash))throw new Error('Invalid account fingerprint.');
   const changed=worker.account_hash&&worker.account_hash!==body.accountHash;
   const updated=await db.from('promo_workers').update({last_seen_at:new Date().toISOString(),tiktok_connected:body.connected===true,account_hash:body.accountHash,...(changed?{account_label:null}:{}),last_error:typeof body.error==='string'?body.error.slice(0,300):null}).eq('id',worker.id);
   if(updated.error)throw new Error('Could not record worker heartbeat.');
   const checks=await db.from('card_promo_media').select('id,approval_id,publish_id,tiktok_state,approved_account').eq('worker_id',worker.id).in('tiktok_state',['sending','processing','uncertain']).order('updated_at').limit(5);
   if(checks.error)throw new Error('Could not read upload statuses.');
   const upload=await db.rpc('claim_promo_upload',{p_worker:worker.id});if(upload.error)throw new Error('Could not claim an approved upload.');
   if(upload.data){
    try{await promoSnapshot(upload.data.card_id,upload.data.revision);return reply({checks:checks.data,upload:{...upload.data,videoUrl:await signedPromoVideo(upload.data.video_path)},render:null});}
    catch{await db.rpc('record_promo_upload',{p_worker:worker.id,p_id:upload.data.id,p_approval:upload.data.approval_id,p_state:'failed',p_error:'Listing changed or unavailable before sending. Nothing sent.'});}
   }
   const render=await db.rpc('claim_promo_render',{p_worker:worker.id});if(render.error)throw new Error('Could not claim a render.');
   if(!render.data)return reply({render:null,upload:null,checks:checks.data});
   try{
    const snapshot=await promoSnapshot(render.data.card_id,render.data.revision);
    return reply({checks:checks.data,upload:null,render:{id:render.data.id,leaseId:render.data.lease_id,...snapshot}});
   }catch(error){await db.from('card_promo_media').update({render_state:'failed',last_error:error instanceof Error?error.message:'Listing unavailable.'}).eq('id',render.data.id).eq('lease_id',render.data.lease_id);return reply({checks:checks.data,render:null,upload:null});}
  }
  if(!/^[a-f0-9-]{36}$/.test(body.id||''))throw new Error('Invalid job.');
  const result=await db.from('card_promo_media').select('*').eq('id',body.id).eq('worker_id',worker.id).single();if(result.error||!result.data)throw new Error('Job not found.');const job=result.data;
  if(body.action==='render-failed'){
   const update=await db.from('card_promo_media').update({render_state:'failed',last_error:String(body.error||'Render failed.').slice(0,300),lease_until:null,updated_at:new Date().toISOString()}).eq('id',job.id).eq('lease_id',body.leaseId).eq('render_state','rendering');if(update.error)throw new Error('Could not record render failure.');return reply({ok:true});
  }
  if(body.action==='validate-upload'){
   if(job.tiktok_state!=='sending'||job.approval_id!==body.approvalId||job.approved_account!==worker.account_hash||!worker.tiktok_connected||Date.parse(job.approval_expires_at)<Date.now())throw new Error('Upload approval expired or the connected account changed.');
   await promoSnapshot(job.card_id,job.revision);return reply({ok:true,sha256:job.video_sha256,caption:job.caption});
  }
  if(body.action==='upload-result'){
   if(!['processing','inbox','failed','uncertain'].includes(body.state)||body.publishId!=null&&!/^[A-Za-z0-9_~.:-]{1,200}$/.test(body.publishId))throw new Error('Invalid upload result.');
   const update=await db.rpc('record_promo_upload',{p_worker:worker.id,p_id:job.id,p_approval:body.approvalId,p_state:body.state,p_publish:body.publishId||null,p_error:typeof body.error==='string'?body.error.slice(0,300):null});if(update.error)throw new Error(update.error.message);return reply({ok:true});
  }
  throw new Error('Unknown worker action.');
 }catch(error){return reply({error:error instanceof Error?error.message:'Worker request failed.'},409);}
}
export async function PUT(req:NextRequest){
 let worker;try{worker=await workerFor(req);}catch{return reply({error:'Worker authentication required.'},401);}
 let uploadedPath:string|undefined;
 try{
  const id=req.nextUrl.searchParams.get('id'),lease=req.nextUrl.searchParams.get('lease');
  if(!/^[a-f0-9-]{36}$/.test(id||'')||!/^[a-f0-9-]{36}$/.test(lease||''))throw new Error('Invalid render.');
  const db=serverDb();const {data:job,error}=await db.from('card_promo_media').select('*').eq('id',id!).eq('worker_id',worker.id).eq('lease_id',lease!).eq('render_state','rendering').single();
  if(error||!job||Date.parse(job.lease_until)<Date.now())throw new Error('Render lease expired.');
  const snapshot=await promoSnapshot(job.card_id,job.revision);
  if(req.headers.get('content-type')!=='video/mp4'||Number(req.headers.get('content-length'))>MAX_PROMO_BYTES)throw new Error('Choose an MP4 under 3.5 MB.');
  const reader=req.body?.getReader();if(!reader)throw new Error('Missing video.');let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_PROMO_BYTES)throw new Error('Video exceeds 3.5 MB.');chunks.push(value);}}finally{await reader.cancel();}
  const data=Buffer.concat(chunks);if(data.length<1000||data.toString('ascii',4,8)!=='ftyp')throw new Error('Invalid MP4.');
  await ensurePromoBucket();const path=`${id}/${lease}.mp4`;
  const saved=await db.storage.from(PROMO_BUCKET).upload(path,data,{contentType:'video/mp4',upsert:false});if(saved.error)throw new Error('Could not save the private video.');uploadedPath=path;
  const finished=await db.rpc('finish_promo_render',{p_worker:worker.id,p_id:id,p_lease:lease,p_path:path,p_sha:sha256(data),p_bytes:data.length,p_caption:snapshot.promo.caption});if(finished.error)throw new Error(finished.error.message);
  return reply({ok:true});
 }catch(error){if(uploadedPath)await serverDb().storage.from(PROMO_BUCKET).remove([uploadedPath]);return reply({error:error instanceof Error?error.message:'Could not save render.'},409);}
}
