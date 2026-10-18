// Reuse the installed Suno uploader. No credentials are copied into this repository.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {parseArgs}=require('node:util');
async function main(){
  const {values}=parseArgs({options:{pack:{type:'string'},video:{type:'string'},bridge:{type:'string'},send:{type:'boolean'},'confirm-suno-account':{type:'boolean'},help:{type:'boolean'}}});
  if(values.help){console.log('Preview: node scripts/tiktok-draft.cjs --pack draft.json --video card.mp4\nSend after checking the Suno account: add --send --confirm-suno-account\nOptional: --bridge path/to/tiktok_bridge.js');return;}
  if(!values.pack||!values.video)throw new Error('Choose a downloaded draft pack and your own MP4 using --pack and --video.');
  const pack=JSON.parse(fs.readFileSync(values.pack,'utf8'));
  if(pack.version!==1||pack.brand!=='Gay Retro TCG'||pack.mode!=='tiktok-inbox'||typeof pack.card?.id!=='string'||pack.card.id.length>100||typeof pack.caption!=='string'||pack.caption.length>2200||!Number.isFinite(Date.parse(pack.expiresAt))||Date.parse(pack.expiresAt)<=Date.now())throw new Error('The draft pack is invalid or expired. Download a fresh pack from Seller Studio.');
  const video=path.resolve(values.video);const stat=fs.statSync(video);
  if(path.extname(video).toLowerCase()!=='.mp4'||!stat.isFile()||stat.size===0||stat.size>64*1024*1024)throw new Error('Choose a non-empty MP4 up to 64 MB.');
  // Fixed destination: the pack cannot choose an arbitrary URL or local network target.
  const response=await fetch(`https://www.gayretrotcg.com/api/social-stock?id=${encodeURIComponent(pack.card.id)}`,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Could not verify current shop stock. Nothing was sent.');
  const current=await response.json();
  if(!current.available||current.price!==pack.card.price||current.name!==pack.card.name||current.updatedAt!==pack.card.updatedAt)throw new Error('This card is sold, reserved or changed. Download a fresh draft after reviewing the listing. Nothing was sent.');
  console.log(`Card: ${pack.card.name}\nCaption:\n${pack.caption}`);
  if(!values.send){console.log('\nPreview only. Nothing was uploaded. Check which account is connected in Suno Promo before sending.');return;}
  if(!values['confirm-suno-account'])throw new Error('Sending uses the account currently connected in Suno Promo. Verify it, then add --confirm-suno-account.');
  const bridge=path.resolve(values.bridge||process.env.SUNO_TIKTOK_BRIDGE||path.join(os.homedir(),'Documents','Codex','2026-09-08','i-n','outputs','SunoPromo','tiktok_bridge.js'));
  if(!fs.existsSync(bridge))throw new Error('Suno uploader not found. Specify its tiktok_bridge.js with --bridge.');
  const output=execFileSync(process.execPath,[bridge,'upload',video],{encoding:'utf8',windowsHide:true,timeout:120000,stdio:['ignore','pipe','pipe']});
  for(const line of output.trim().split(/\r?\n/)){try{const result=JSON.parse(line);if(result.error)throw new Error(result.error);if(result.message)console.log(result.message);if(result.progress)console.log(result.progress);}catch(error){if(error instanceof SyntaxError)continue;throw error;}}
  console.log('Keep this caption with the video. Inbox delivery is not public publication. If the result is uncertain, use Check upload status in Suno Promo before retrying.');
}
if(require.main===module)main().catch(error=>{console.error(error.stdout?'The uploader did not confirm delivery. Check upload status in Suno Promo before retrying.':error.message||'Could not prepare this draft.');process.exitCode=1;});
