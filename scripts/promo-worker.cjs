const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const {execFileSync}=require('node:child_process');
const {connection,send,status,access}=require('./promo-tiktok.cjs');
const root=path.resolve(__dirname,'..'),stateDir=path.join(root,'.promo-worker'),jobsDir=path.join(stateDir,'jobs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');const uuid=value=>/^[a-f0-9-]{36}$/.test(value||'');
function log(message){const file=path.join(stateDir,'worker.log');if(fs.existsSync(file)&&fs.statSync(file).size>2_000_000)fs.renameSync(file,file+'.previous');fs.appendFileSync(file,new Date().toISOString()+' '+message+'\n');}
function credentials(){const raw=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(__dirname,'promo-worker-secret.ps1')],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:15000});const cfg=JSON.parse(raw.replace(/^\uFEFF/,''));if(cfg.site!=='https://www.gayretrotcg.com'||!uuid(cfg.workerId)||!/^[a-f0-9]{64}$/.test(cfg.key))throw Error('Invalid worker configuration.');return cfg;}
async function api(cfg,body){const response=await fetch(cfg.site+'/api/internal/promo-worker',{method:'POST',headers:{Authorization:`Bearer ${cfg.key}`,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(25000)});const json=await response.json();if(!response.ok)throw Error(json.error||'Shop worker request failed.');return json;}
async function bytes(url,limit){const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('Could not download render media.');const reader=r.body.getReader();const chunks=[];let count=0;try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>limit)throw Error('Render media exceeds size limit.');chunks.push(value);}}finally{await reader.cancel();}return{buffer:Buffer.concat(chunks),type:r.headers.get('content-type')?.split(';')[0]};}
function jobFolder(id){if(!uuid(id))throw Error('Invalid job identifier.');const folder=path.resolve(jobsDir,id);if(path.dirname(folder)!==jobsDir)throw Error('Unsafe job path.');fs.mkdirSync(folder,{recursive:true});return folder;}
async function render(cfg,job){
 const {build}=require('esbuild');const {chromium}=require('playwright');
 if(!/^https:\/\/(assets\.tcgdex\.net\/(en|ja|ko)\/[A-Za-z0-9/_-]+\/(high|low)\.webp|images\.pokemontcg\.io\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.png|storage\.googleapis\.com\/images\.pricecharting\.com\/[A-Za-z0-9_-]+\/(240|1600)\.jpg)$/.test(job.artwork))throw Error('The listing needs matching catalogue artwork. Uploaded photos are not used.');
 const folder=jobFolder(job.id),raw=path.join(folder,'raw.mp4'),output=path.join(folder,'promo.mp4');
 const art=await bytes(job.artwork,12_000_000);if(!['image/png','image/webp','image/jpeg'].includes(art.type))throw Error('Invalid catalogue image type.');
 const bundle=await build({entryPoints:[path.join(__dirname,'promo-render-entry.ts')],bundle:true,write:false,format:'iife',platform:'browser'});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{const page=await browser.newPage({viewport:{width:1080,height:1920}});await page.route('**/*',r=>r.abort());await page.setContent('<html><body style="margin:0"><canvas width="1080" height="1920"></canvas></body></html>');await page.addScriptTag({content:bundle.outputFiles[0].text});
  const data=await page.evaluate(input=>window.renderPromo(input),{promo:job.promo,artwork:`data:${art.type};base64,${art.buffer.toString('base64')}`,logo:'data:image/webp;base64,'+fs.readFileSync(path.join(root,'public',require('../src/lib/brand-assets.json').logo.replace(/^\//,''))).toString('base64')});fs.writeFileSync(raw,Buffer.from(data));
 }finally{await browser.close();}
 execFileSync('ffmpeg',['-y','-i',raw,'-an','-c:v','libx264','-preset','fast','-crf','27','-maxrate','2200k','-bufsize','4400k','-pix_fmt','yuv420p','-r','30','-movflags','+faststart',output],{windowsHide:true,stdio:'ignore',timeout:90000});
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name,width,height','-show_entries','format=duration','-of','json',output],{encoding:'utf8',windowsHide:true,timeout:15000}));const stream=probe.streams?.[0];
 if(stream?.codec_name!=='h264'||stream.width!==1080||stream.height!==1920||Number(probe.format?.duration)<7.5||Number(probe.format?.duration)>9)throw Error('Rendered video did not pass format checks.');
 const file=fs.readFileSync(output);if(file.length>3_500_000)throw Error('Rendered video exceeds the free storage limit.');
 const response=await fetch(`${cfg.site}/api/internal/promo-worker?id=${encodeURIComponent(job.id)}&lease=${encodeURIComponent(job.leaseId)}`,{method:'PUT',headers:{Authorization:`Bearer ${cfg.key}`,'Content-Type':'video/mp4'},body:file,redirect:'error',signal:AbortSignal.timeout(45000)});if(!response.ok){const data=await response.json();throw Error(data.error||'Could not save rendered video.');}
 fs.unlinkSync(raw);fs.unlinkSync(output); // Only the private hosted preview is retained.
 log('Video ready for review: '+job.id);
}
function ledgerPath(id,approval){if(!uuid(id)||!uuid(approval))throw Error('Invalid approval.');return path.join(jobFolder(id),approval+'.json');}
function saveLedger(file,data){fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file);}
async function upload(cfg,job,c,deps={connection,send}){
 const ledgerFile=ledgerPath(job.id,job.approval_id);if(fs.existsSync(ledgerFile))throw Error('An upload attempt already exists. Check its status; no duplicate was sent.');
 if(job.approved_account!==c.hash||!c.connected)throw Error('Connected TikTok account changed.');
 const validated=await api(cfg,{action:'validate-upload',id:job.id,approvalId:job.approval_id});
 const parsed=new URL(job.videoUrl);if(parsed.protocol!=='https:'||parsed.hostname!=='htgchoxjicmmyyeeedag.supabase.co'||!parsed.pathname.startsWith('/storage/v1/object/sign/card-promo-videos/'))throw Error('Invalid private video destination.');
 const video=await bytes(job.videoUrl,3_500_000);if(hash(video.buffer)!==validated.sha256||hash(video.buffer)!==job.video_sha256)throw Error('Video checksum changed.');
 const file=path.join(jobFolder(job.id),'approved.mp4');fs.writeFileSync(file,video.buffer);
 // Validate once more after downloading, immediately before the provider request.
 await api(cfg,{action:'validate-upload',id:job.id,approvalId:job.approval_id});
 const current=deps.connection();if(current.hash!==job.approved_account)throw Error('Connected TikTok account changed.');
 const ledger={id:job.id,approvalId:job.approval_id,account:current.hash,attemptedAt:new Date().toISOString(),sha256:job.video_sha256};saveLedger(ledgerFile,ledger);
 try{await deps.send(file,current,async publishId=>{ledger.publishId=publishId;saveLedger(ledgerFile,ledger);await api(cfg,{action:'upload-result',id:job.id,approvalId:job.approval_id,state:'processing',publishId});});log('TikTok transfer started: '+job.id);}
 catch(error){await api(cfg,{action:'upload-result',id:job.id,approvalId:job.approval_id,state:error.rejected&&!ledger.publishId?'failed':'uncertain',publishId:ledger.publishId||null,error:error.message}).catch(()=>{});throw error;}
}
async function check(cfg,job,c){
 if(job.approved_account!==c.hash)return;
 const file=ledgerPath(job.id,job.approval_id);const local=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};const publishId=job.publish_id||local.publishId;
 if(!publishId){await api(cfg,{action:'upload-result',id:job.id,approvalId:job.approval_id,state:'uncertain',error:'Upload outcome is unknown. Check TikTok before any further action. No automatic retry.'});return;}
 const state=await status(c,publishId);const mapped=['SEND_TO_USER_INBOX','PUBLISH_COMPLETE'].includes(state)?'inbox':state==='FAILED'?'failed':'processing';
 await api(cfg,{action:'upload-result',id:job.id,approvalId:job.approval_id,state:mapped,publishId,error:mapped==='failed'?'TikTok reported a failed upload. Review in TikTok.':null});
}
async function tick(cfg){
 let c;let connectionError=null;try{c=connection();if(c.connected)await access(c);}catch{c={hash:null,connected:false};connectionError='Existing TikTok sign-in could not be loaded.';}
 const jobs=await api(cfg,{action:'tick',accountHash:c.hash,connected:c.connected,error:connectionError});
 for(const job of jobs.checks||[])try{await check(cfg,job,c);}catch{log('TikTok status check deferred: '+job.id);}
 if(jobs.upload){try{await upload(cfg,jobs.upload,c);}catch(error){await api(cfg,{action:'upload-result',id:jobs.upload.id,approvalId:jobs.upload.approval_id,state:'uncertain',error:error.message}).catch(()=>{});log('Upload needs review: '+jobs.upload.id);}return;}
 if(jobs.render){try{await render(cfg,jobs.render);}catch(error){await api(cfg,{action:'render-failed',id:jobs.render.id,leaseId:jobs.render.leaseId,error:error.message}).catch(()=>{});log('Render needs review: '+jobs.render.id);}}
}
async function main(){
 fs.mkdirSync(jobsDir,{recursive:true});const cfg=credentials();const lock=path.join(stateDir,'worker.lock');
 if(fs.existsSync(lock)){const old=Number(fs.readFileSync(lock,'utf8'));if(!Number.isSafeInteger(old)||old<1)throw Error('Worker lock needs review.');try{process.kill(old,0);throw Error('Worker already running.');}catch(e){if(e.code!=='ESRCH')throw e;}fs.unlinkSync(lock);}
 const fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,String(process.pid));let stop=false;process.on('SIGINT',()=>{stop=true;});process.on('SIGTERM',()=>{stop=true;});
 try{do{try{await tick(cfg);}catch(error){log('Worker check deferred: '+String(error.message).slice(0,200));}if(process.argv.includes('--once')||stop)break;await new Promise(r=>setTimeout(r,60000));}while(!stop);}finally{fs.closeSync(fd);if(fs.readFileSync(lock,'utf8')===String(process.pid))fs.unlinkSync(lock);}
}
module.exports={hash,uuid,render,upload,check,tick};
if(require.main===module)main().catch(error=>{try{log(String(error.message).slice(0,200));}catch{}process.exitCode=1;});
