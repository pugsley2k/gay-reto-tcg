import 'server-only';
import {createHash} from 'node:crypto';
import {serverDb} from './server-db';
import {makeCardPromo} from './card-promo';
export const PROMO_BUCKET='card-promo-videos';
export const MAX_PROMO_BYTES=3_500_000;
export const sha256=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex');
export async function workerFor(request:Request){
 const value=request.headers.get('authorization')||'';
 if(!/^Bearer [a-f0-9]{64}$/.test(value))throw new Error('Worker authentication required.');
 const {data,error}=await serverDb().from('promo_workers').select('*').eq('token_hash',sha256(value.slice(7))).eq('enabled',true).maybeSingle();
 if(error||!data)throw new Error('Worker authentication required.');return data;
}
export async function ensurePromoBucket(){
 const storage=serverDb().storage;const found=await storage.getBucket(PROMO_BUCKET);
 if(found.data){if(found.data.public)throw new Error('Promo storage must be private.');return;}
 const result=await storage.createBucket(PROMO_BUCKET,{public:false,fileSizeLimit:MAX_PROMO_BYTES,allowedMimeTypes:['video/mp4']});
 if(result.error){const check=await storage.getBucket(PROMO_BUCKET);if(!check.data||check.data.public)throw new Error('Could not prepare private video storage.');}
}
export async function promoSnapshot(cardId:string,revision:number){const result=await serverDb().rpc('card_promo_details',{p_card:cardId,p_revision:revision});if(result.error)throw new Error(result.error.message);return {promo:makeCardPromo(result.data,revision),artwork:result.data.image_url};}
export async function signedPromoVideo(path:string){const {data,error}=await serverDb().storage.from(PROMO_BUCKET).createSignedUrl(path,300);if(error||!data)throw new Error('Could not load the private video.');return data.signedUrl;}
