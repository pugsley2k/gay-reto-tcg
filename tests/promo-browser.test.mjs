import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {build}=require('esbuild');const {chromium}=require('playwright');
let browser,server,base,output;const decisions=[];let stale=false;
const name='Tentacruel';const art='https://images.pokemontcg.io/ecard2/H26_hires.png';
const card={id:'fixture-card',name,price:16000,available:true,sold_at:null,image_url:art,front_image_url:'/actual-front.jpg',back_image_url:'/actual-back.jpg',set:'Aquapolis',number:'H26/H32',language:'English',condition:null,edition:'Not applicable',grading:{company:'GetGraded',grade:'7 Excellent',confirmed:true,cert_number:'00744256'}};
const draft={card_id:card.id,revision:1,state:'pending',Card:{name,price:16000}};
before(async()=>{
 output=mkdtempSync(join(tmpdir(),'card-promo-test-'));
 const bundled=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Studio from './src/components/CardPromoStudio';import seller from './src/components/SellerStudio.module.css';import Product from './src/components/ProductDetail';import{CartProvider}from'./src/components/CartProvider';import{drawCardPromo,loadPromoImage}from'./src/lib/card-promo-renderer';window.promoTools={drawCardPromo,loadPromoImage};const card=${JSON.stringify(card)};createRoot(document.getElementById('root')).render(<main className={seller.studio}>{location.search.includes('product')?<CartProvider><Product card={card}/></CartProvider>:<Studio/>}</main>);`,resolveDir:resolve('.'),loader:'tsx'},bundle:true,write:false,outdir:output,jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'},plugins:[{name:'next-link-fixture',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"import React from 'react';export default function Link(p){return React.createElement('a',p)}",loader:'js',resolveDir:resolve('.')}));}}]});
 const js=bundled.outputFiles.find(f=>f.path.endsWith('.js')).text;const css=bundled.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'';
 const image=process.env.PROMO_TEST_ARTWORK?readFileSync(process.env.PROMO_TEST_ARTWORK):readFileSync('public/showcase-charizard.png');
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');const json=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
  if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(js);return;}
  if(url.pathname==='/api/admin/card-promos'){
   if(req.method==='POST'){let raw='';for await(const c of req)raw+=c;decisions.push(JSON.parse(raw));if(stale){json({error:'Listing changed. Refresh the promo before exporting.'},409);return;}json({message:'Recorded'});return;}
   if(url.searchParams.has('cardId')){json({cardId:card.id,revision:1,name,price:'£160.00',facts:'Aquapolis · #H26/H32 · GetGraded 7 Excellent',url:'https://www.gayretrotcg.com/cards/fixture-card',style:'tidal',seconds:8,artwork:'/api/admin/card-promos/image?revision=1',caption:'Now available: Tentacruel\n£160.00 + delivery.\nCheck current price and availability.'});return;}
   json({drafts:[draft]});return;
  }
  if(url.pathname==='/gay-retro-flat.webp'){res.setHeader('Content-Type','image/webp');res.end(readFileSync('public/gay-retro-flat.webp'));return;}
  if(url.pathname==='/api/admin/card-promos/image'||url.pathname==='/art.png'||url.pathname.startsWith('/actual-')){res.setHeader('Content-Type','image/png');res.end(image);return;}
  if(url.pathname==='/placeholder.png'){res.setHeader('Content-Type','image/png');res.end(readFileSync('public/placeholder.png'));return;}
  res.setHeader('Content-Type','text/html');res.end(`<html><head><style>:root{--studio-border:#ffffff30;--studio-bg:#191b20;--studio-text:#f0eee7;--studio-muted:#b6b9ba;--studio-accent:#faeac4;--studio-panel:#242930}body{background:#191b20;color:#f0eee7;font:14px/1.7 Arial;padding:32px;margin:0}#root{max-width:1100px;margin:auto}button{cursor:pointer;color:#faeac4;background:#252a30;border:1px solid #ffffff40;border-radius:4px;padding:10px 14px}button:disabled{opacity:.5}*{box-sizing:border-box}a{color:#faeac4}${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));if(output){if(dirname(output)!==resolve(tmpdir())||!basename(output).startsWith('card-promo-test-'))throw Error('Unsafe test cleanup path');rmSync(output,{recursive:true,force:true});}});
async function page(t,mobile=false){const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:1100},reducedMotion:'reduce'});t.after(()=>context.close());const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));return p;}
test('studio renders a real MP4 with current price and artwork; no publishing requests',async(t)=>{
 stale=false;decisions.length=0;const p=await page(t);await p.goto(base);await p.getByRole('button',{name:'Preview promo',exact:true}).click();await p.getByRole('button',{name:'Export MP4',exact:true}).waitFor();
 if(process.env.PROMO_TEST_SCREENSHOT)await p.screenshot({path:process.env.PROMO_TEST_SCREENSHOT,fullPage:true});
 await p.getByRole('button',{name:'Export MP4',exact:true}).click();const link=p.getByRole('link',{name:/Download MP4/});await link.waitFor({timeout:20000});assert.equal(await link.evaluate(a=>getComputedStyle(a).color!==getComputedStyle(a).backgroundColor),true,'Download link must remain readable inside Seller Studio');
 const video=await p.evaluate(async()=>{const a=document.querySelector('a[download]');const b=await(await fetch(a.href)).blob();const v=document.createElement('video');v.src=a.href;await new Promise((ok,no)=>{v.onloadedmetadata=ok;v.onerror=no;});return{type:b.type,size:b.size,width:v.videoWidth,height:v.videoHeight,duration:v.duration};});
 assert.equal(video.type,'video/mp4');assert.ok(video.size>10000);assert.equal(video.width,1080);assert.equal(video.height,1920);assert.ok(video.duration>=7.5&&video.duration<10,JSON.stringify(video));assert.deepEqual(decisions,[{cardId:card.id,revision:1,decision:'exported'}]);
 if(process.env.PROMO_TEST_VIDEO){const bytes=await p.evaluate(async()=>Array.from(new Uint8Array(await(await fetch(document.querySelector('a[download]').href)).arrayBuffer())));writeFileSync(process.env.PROMO_TEST_VIDEO,Buffer.from(bytes));}
 console.log('MP4 validation',JSON.stringify(video));
});
test('changed stock after rendering prevents a download',async(t)=>{
 stale=true;try{const p=await page(t);await p.goto(base);await p.getByRole('button',{name:'Preview promo',exact:true}).click();await p.getByRole('button',{name:'Export MP4',exact:true}).click();await p.getByRole('alert').filter({hasText:'Listing changed'}).waitFor({timeout:20000});assert.equal(await p.getByRole('link',{name:/Download MP4/}).count(),0);}finally{stale=false;}
});
test('mobile preview and colour treatment stay usable within the viewport',async(t)=>{
 const p=await page(t,true);await p.goto(base);await p.getByRole('button',{name:'Preview promo',exact:true}).click();await p.getByLabel('Colour treatment').selectOption('ember');assert.equal(await p.locator('canvas').isVisible(),true);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(process.env.PROMO_TEST_MOBILE_SCREENSHOT)await p.screenshot({path:process.env.PROMO_TEST_MOBILE_SCREENSHOT,fullPage:true});
});
test('product shows catalogue artwork first and requests physical photos only after View photos',async(t)=>{
 const p=await page(t);const requests=[];p.on('request',r=>requests.push(r.url()));await p.route(art,r=>r.fulfill({contentType:'image/png',body:readFileSync('public/showcase-charizard.png')}));await p.goto(base+'/?product');
 await p.getByRole('button',{name:'View photos',exact:true}).waitFor();assert.equal(requests.some(url=>url.includes('/actual-')),false);assert.equal(await p.locator('img').first().getAttribute('src'),art);
 await p.getByRole('button',{name:'View photos',exact:true}).click();assert.equal(await p.locator('img').first().getAttribute('src'),'/actual-front.jpg');await p.getByRole('button',{name:'Actual card — back',exact:true}).click();assert.equal(await p.locator('img').first().getAttribute('src'),'/actual-back.jpg');await p.getByRole('button',{name:'Back to artwork',exact:true}).click();assert.equal(await p.locator('img').first().getAttribute('src'),art);
});
