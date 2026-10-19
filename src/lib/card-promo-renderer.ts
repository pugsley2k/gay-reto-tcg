import {PROMO_SECONDS,type CardPromo,type PromoStyle} from './card-promo';
export const PROMO_WIDTH=1080, PROMO_HEIGHT=1920;
const palettes:Record<PromoStyle,[string,string,string]>={gold:['#e5b844','#faeac4','#191b20'],ember:['#ff754a','#ffe0a6','#211614'],tidal:['#6ee7dd','#daf8ee','#101d26'],neon:['#cc9bff','#efe2ff','#1a1529']};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const out=(n:number)=>1-Math.pow(1-clamp(n),3);
export async function loadPromoImage(url:string):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not load promo artwork. Refresh the listing and try again.'));img.src=url;});
}
function text(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,max:number,size:number,color:string,weight=800){
  ctx.fillStyle=color;ctx.font=`${weight} ${size}px Arial, sans-serif`;while(ctx.measureText(value).width>max&&size>18){size-=2;ctx.font=`${weight} ${size}px Arial, sans-serif`;}ctx.fillText(value,x,y,max);
}
function contained(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number){const s=Math.min(w/img.naturalWidth,h/img.naturalHeight);ctx.drawImage(img,x+(w-img.naturalWidth*s)/2,y+(h-img.naturalHeight*s)/2,img.naturalWidth*s,img.naturalHeight*s);}
/** All motion is a pure function of seconds, shared by preview and MP4 recording. */
export function drawCardPromo(canvas:HTMLCanvasElement,promo:CardPromo,artwork:HTMLImageElement,logo:HTMLImageElement,time:number,style:PromoStyle=promo.style){
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas rendering is unavailable.');
  const [accent,cream,bg]=palettes[style];const t=Math.min(PROMO_SECONDS,Math.max(0,time));
  ctx.save();ctx.setTransform(canvas.width/PROMO_WIDTH,0,0,canvas.height/PROMO_HEIGHT,0,0);ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1920);
  const glow=ctx.createRadialGradient(490,850,50,490,850,820);glow.addColorStop(0,accent+'42');glow.addColorStop(1,bg);ctx.fillStyle=glow;ctx.fillRect(0,0,1080,1920);
  // A restrained moving field leaves the card artwork and offer readable.
  for(let i=0;i<22;i++){const x=78+((i*137)%850),y=330+((i*193-t*(12+i%4*4)+1600)%1200);ctx.globalAlpha=.12+(i%4)*.045;ctx.fillStyle=accent;ctx.beginPath();ctx.arc(x,y,2+i%3,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
  contained(ctx,logo,76,128,360,136);
  text(ctx,'THE COLLECTOR’S NEXT FIND',76,305,830,22,cream,600);
  const headline=out((t-.15)/.5);ctx.save();ctx.globalAlpha=headline;ctx.translate(-100*(1-headline),0);text(ctx,'NOW AVAILABLE',72,438,850,88,accent,900);ctx.restore();
  const entry=out((t-.32)/.9);const turn=Math.sin(Math.min(t,6)/6*Math.PI)*.035;
  ctx.save();ctx.globalAlpha=entry;ctx.translate(510,907+160*(1-entry));ctx.rotate(-.13*(1-entry)+turn);ctx.scale(.8+.2*entry,.8+.2*entry);
  ctx.shadowColor='#000000aa';ctx.shadowBlur=55;ctx.shadowOffsetY=30;ctx.fillStyle='#0a0d10';ctx.beginPath();ctx.roundRect(-295,-407,590,814,28);ctx.fill();ctx.shadowColor='transparent';
  if(promo.slab){
    const {header,company,grade}=promo.slab;
    ctx.fillStyle='#373c42';ctx.beginPath();ctx.roundRect(-295,-407,590,814,28);ctx.fill();
    const label=ctx.createLinearGradient(0,-385,0,-265);label.addColorStop(0,header.background);label.addColorStop(.65,header.background);label.addColorStop(1,header.accent);
    ctx.fillStyle=label;ctx.fillRect(-270,-385,540,120);
    text(ctx,'GRADED CARD',-250,-351,210,16,header.text,600);
    text(ctx,company,-250,-298,270,34,header.text,800);
    text(ctx,grade,40,-313,205,34,header.text,800);
    contained(ctx,artwork,-270,-245,540,595);
    text(ctx,'Illustrative holder · view actual photos online',-255,382,510,17,'#eeeeee',500);
  }else contained(ctx,artwork,-286,-398,572,796);
  // Light travels around the artwork; it never replaces or alters its printing.
  ctx.strokeStyle=accent+'88';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-298,-410,596,820,29);ctx.stroke();ctx.restore();
  const offer=out((t-1.12)/.45);ctx.save();ctx.globalAlpha=offer;ctx.translate(0,35*(1-offer));
  text(ctx,promo.name.toUpperCase(),76,1420,830,70,cream,900);
  text(ctx,promo.facts,78,1466,820,25,cream,500);
  text(ctx,promo.price,74,1570,560,94,accent,900);text(ctx,'+ DELIVERY',590,1548,300,25,cream,600);
  ctx.restore();
  const cta=out((t-2)/.4);ctx.globalAlpha=cta;ctx.fillStyle=t>6.2?accent:cream;ctx.beginPath();ctx.roundRect(76,1630,820,92,12);ctx.fill();text(ctx,'SHOP AT GAYRETROTCG.COM',105,1690,760,36,bg,900);
  text(ctx,'Catalogue artwork · View actual-card photos online',78,1780,820,22,cream,500);
  text(ctx,'Check current price and availability before buying.',78,1818,820,21,cream,500);
  ctx.restore();
}
export function promoRecordingType(){
  if(typeof MediaRecorder==='undefined')return null;
  return ['video/mp4;codecs=avc1.42001E','video/mp4;codecs=avc1','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type))||null;
}
export async function recordCardPromo(canvas:HTMLCanvasElement,promo:CardPromo,artwork:HTMLImageElement,logo:HTMLImageElement,style:PromoStyle,progress:(n:number)=>void,signal:AbortSignal):Promise<Blob>{
  const mimeType=promoRecordingType();if(!mimeType)throw new Error('MP4 export is unavailable in this browser. Open Seller Studio in current Chrome or Edge.');
  if(document.hidden)throw new Error('Keep this tab visible while exporting.');
  const stream=canvas.captureStream(30);const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:8_000_000});
  return new Promise((resolve,reject)=>{
    const chunks:Blob[]=[];let frame=0;let ended=false;let failure:Error|undefined;
    const cleanup=()=>{cancelAnimationFrame(frame);stream.getTracks().forEach(track=>track.stop());document.removeEventListener('visibilitychange',visibility);signal.removeEventListener('abort',abort);};
    const stop=(error?:Error)=>{if(ended)return;ended=true;failure=error;cancelAnimationFrame(frame);if(recorder.state!=='inactive')recorder.stop();else{cleanup();reject(error||new Error('Recording stopped.'));}};
    const visibility=()=>{if(document.hidden)stop(new Error('Export stopped because the tab was hidden. Keep it visible and retry.'));};
    const abort=()=>stop(new Error('Export cancelled.'));
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    recorder.onerror=()=>stop(new Error('MP4 recording failed. Try current Chrome or Edge.'));
    recorder.onstop=()=>{cleanup();if(failure){reject(failure);return;}const blob=new Blob(chunks,{type:'video/mp4'});if(blob.size<1000)reject(new Error('Empty recording. Please retry.'));else resolve(blob);};
    document.addEventListener('visibilitychange',visibility);signal.addEventListener('abort',abort,{once:true});
    try{
      drawCardPromo(canvas,promo,artwork,logo,0,style);recorder.start(250);const started=performance.now();
      const tick=(now:number)=>{if(ended)return;const seconds=(now-started)/1000;try{drawCardPromo(canvas,promo,artwork,logo,seconds,style);progress(clamp(seconds/PROMO_SECONDS));if(seconds>=PROMO_SECONDS)stop();else frame=requestAnimationFrame(tick);}catch(error){stop(error instanceof Error?error:new Error('Rendering failed.'));}};
      frame=requestAnimationFrame(tick);if(signal.aborted)abort();
    }catch(error){cleanup();reject(error);}
  });
}
