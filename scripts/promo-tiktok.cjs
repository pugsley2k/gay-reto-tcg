// Reuse only the existing TikTok authorization. No Suno generation or schedules.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const {execFileSync}=require('node:child_process');
const api='https://open.tiktokapis.com/v2';
function connection(){
 const savedLoader=path.join(process.env.USERPROFILE,'Documents','Codex','2026-09-08','i-n','outputs','SunoPromo','tiktok_credentials.ps1');
 if(!process.env.TIKTOK_CLIENT_KEY||!process.env.TIKTOK_CLIENT_SECRET){const raw=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',savedLoader],{encoding:'utf8',windowsHide:true,timeout:15000,stdio:['ignore','pipe','pipe']});const values=JSON.parse(raw.replace(/^\uFEFF/,''));for(const key of ['TIKTOK_CLIENT_KEY','TIKTOK_CLIENT_SECRET'])if(values[key])process.env[key]=values[key];}
 const root=path.join(process.env.USERPROFILE,'projects','lyricizer');const config=require(path.join(root,'pipeline.config.js'));const adapter=require(path.join(root,'pipeline','tiktok.js'));const token=adapter.loadToken(config.tiktok.tokenPath);
 const hash=token?.open_id?crypto.createHash('sha256').update(config.tiktok.clientKey+'\0'+token.open_id).digest('hex'):null;
 return{config,adapter,hash,connected:!!hash&&!!token?.access_token};
}
async function access(c){if(!c.connected)throw Error('TikTok sign-in is required in the existing account connection.');let token;try{token=await c.adapter.getAccessToken({config:c.config,fetchImpl:(url,opts)=>fetch(url,{...opts,redirect:'error',signal:AbortSignal.timeout(20000)})});}catch{throw Error('TikTok sign-in needs reconnecting. No video was sent.');}if(c.hash){const saved=c.adapter.loadToken(c.config.tiktok.tokenPath);const fingerprint=saved?.open_id?crypto.createHash('sha256').update(c.config.tiktok.clientKey+'\0'+saved.open_id).digest('hex'):null;if(fingerprint!==c.hash||saved.access_token!==token)throw Error('Connected TikTok account changed. No video was sent.');}return token;}
async function request(token,path,body){const r=await fetch(api+path,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(25000)});let j;try{j=await r.json();}catch{throw Error('TikTok returned an unreadable response.');}if(!r.ok||j.error?.code&&j.error.code!=='ok'){const e=Error('TikTok rejected the request: '+String(j.error?.code||r.status).replace(/[^a-zA-Z0-9_ -]/g,'').slice(0,100));e.rejected=true;throw e;}return j.data;}
function uploadUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='open-upload.tiktokapis.com'||u.hostname.endsWith('.upload.tiktokapis.com'));}catch{return false;}}
async function send(file,c,onInit){
 const token=await access(c);const bytes=fs.readFileSync(file);if(bytes.length>3_500_000)throw Error('Video exceeds the worker size limit.');
 const data=await request(token,'/post/publish/inbox/video/init/',{source_info:{source:'FILE_UPLOAD',video_size:bytes.length,chunk_size:bytes.length,total_chunk_count:1}});
 if(!data?.publish_id||!uploadUrl(data.upload_url))throw Error('TikTok did not return a valid upload destination.');
 // Persist the provider reference before transferring a single video byte.
 await onInit(data.publish_id);
 const r=await fetch(data.upload_url,{method:'PUT',headers:{'Content-Type':'video/mp4','Content-Length':String(bytes.length),'Content-Range':`bytes 0-${bytes.length-1}/${bytes.length}`},body:bytes,redirect:'error',signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error('TikTok did not confirm the video transfer. Check the existing upload; do not send another copy.');
 return data.publish_id;
}
async function status(c,publishId){const token=await access(c);const data=await request(token,'/post/publish/status/fetch/',{publish_id:publishId});return data?.status;}
module.exports={connection,send,status,uploadUrl,access};
if(require.main===module){try{const c=connection();console.log(JSON.stringify({connected:c.connected,accountHash:c.hash,mode:'inbox'}));}catch{console.log(JSON.stringify({connected:false,error:'Existing TikTok sign-in could not be loaded.'}));process.exitCode=1;}}
