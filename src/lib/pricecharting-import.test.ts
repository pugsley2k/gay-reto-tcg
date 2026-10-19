import test from 'node:test';
import assert from 'node:assert/strict';
import {priceChartingItemUrl,parsePriceChartingItem,importPriceChartingItem} from './pricecharting-import';
import {isCardArtwork} from './card-artwork';
const url='https://www.pricecharting.com/game/pokemon-pitch-black/slowbro-90';
const art='https://storage.googleapis.com/images.pricecharting.com/p44jy5h4fiqq7rwo/240.jpg';
const html=`<h1 id="product_name">Slowbro #90 <a href="/console/pokemon-pitch-black">Pokemon Pitch Black<img src="logo.png"></a></h1><div id="product_details"><div class="cover"><img itemprop="image" src="${art}"></div></div><div id="large-image">${art.replace('240','1600')}</div><td id="used_price"><span class="price js-price">$8.25</span><span>$999.99</span></td><script>VGPC.forex_rates = {"GBP":0.750282};</script><a id="dropdown_selected_currency">USD</a>`;
test('imports product identity, main catalogue image and ungraded GBP price, never sale photos or graded prices',()=>{
 const card=parsePriceChartingItem(html,url);assert.equal(card.name,'Slowbro');assert.equal(card.number,'90');assert.equal(card.set,'Pitch Black');assert.equal(card.price,619);assert.equal(card.image_url,art.replace('240','1600'));assert.match(card.price_note,/ungraded/);assert.equal(isCardArtwork(card.image_url),true);
});
test('missing currency evidence or ungraded guide never becomes a guessed or zero selling price',()=>{
 assert.equal(parsePriceChartingItem(html.replace('"GBP":0.750282','"EUR":0.9'),url).price,null);
 assert.equal(parsePriceChartingItem(html.replace('$8.25','$0.00'),url).price,null);
 assert.equal(parsePriceChartingItem(html.replace('id="used_price"','id="graded_price"'),url).price,null);
 assert.equal(parsePriceChartingItem(html.replace('$8.25','£12.34'),url).price,1234);
});
test('rejects arbitrary hosts, credentials, redirects and non-Pokémon pages',async()=>{
 for(const value of ['https://pricecharting.com.evil.test/game/pokemon-a/b','https://user@pricecharting.com/game/pokemon-a/b','http://pricecharting.com/game/pokemon-a/b','https://pricecharting.com:444/game/pokemon-a/b','https://pricecharting.com/search-products?q=slowbro','https://pricecharting.com/game/mario/a'])assert.throws(()=>priceChartingItemUrl(value));
 assert.equal(priceChartingItemUrl(url+'?tracking=1#prices'),url);
 let options:RequestInit|undefined;
 await importPriceChartingItem(url,async(input,opts)=>{assert.equal(input,url);options=opts;return new Response(html,{headers:{'Content-Type':'text/html'}});});
 assert.equal(options?.redirect,'error');
 await assert.rejects(importPriceChartingItem(url,async()=>new Response('blocked',{status:403})),/could not be read/);
 await assert.rejects(importPriceChartingItem(url,async()=>new Response('x'.repeat(1024*1024+1),{headers:{'Content-Type':'text/html'}})),/too large/);
});
test('rejects missing main artwork, set mismatches and lookalike image hosts',()=>{
 assert.throws(()=>parsePriceChartingItem(html.replace('itemprop="image"','itemprop="sale"'),url));
 assert.throws(()=>parsePriceChartingItem(html.replace('href="/console/pokemon-pitch-black"','href="/console/pokemon-base-set"'),url));
 for(const image of ['https://storage.googleapis.com/other-bucket/x/1600.jpg',art+'?redirect=x',art.replace('storage.googleapis.com','storage.googleapis.com.evil.test')]){assert.equal(isCardArtwork(image),false);assert.throws(()=>parsePriceChartingItem(html.replaceAll(art,image),url));}
});
