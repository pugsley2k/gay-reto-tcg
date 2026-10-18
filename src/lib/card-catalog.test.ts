import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesCard, marketQuote, resolveFinish, catalogImageUrl, enrichCard, type CatalogCard } from './card-catalog';
const card: CatalogCard = {id:'sv01-245',name:'Gardevoir ex',localId:'245',rarity:'Special illustration rare',set:{name:'Scarlet & Violet',cardCount:{official:198}},variants:{holo:true,normal:false,reverse:false},pricing:{tcgplayer:{unit:'USD',updated:'2026-10-14',holofoil:{marketPrice:68.5}}}};
test('matching requires the printing number, name and printed set total',()=>{
 assert.equal(matchesCard(card,{name:'Gardevoir ex',number:'0245',total:'198',language:'English'}),true);
 for(const change of [{total:'199'},{name:'Mega Gardevoir ex'},{number:'244'}])assert.equal(matchesCard(card,{name:'Gardevoir ex',number:'245',total:'198',language:'English',...change}),false);
});
test('non-English cards require their original printed names',()=>{
 assert.equal(matchesCard(card,{name:'Gardevoir ex',original_name:'サーナイトex',number:'245',language:'Japanese'}),false);
});
test('ambiguous finishes do not receive a guessed market price',()=>{
 const ambiguous={...card,variants:{normal:true,holo:true,reverse:true}};
 assert.equal(resolveFinish(ambiguous),null);assert.equal(marketQuote(ambiguous,null),null);
 assert.equal(marketQuote(card,'Reverse Holo'),null);
});
test('single-variant cards use the matching market quote',()=>{
 assert.equal(resolveFinish(card),'Holo Rare');assert.equal(marketQuote(card,'Holo Rare')?.amount,68.5);
});
test('holo Cardmarket references use the holo trend, never the generic non-holo trend',()=>{
 const holo={...card,pricing:{cardmarket:{unit:'EUR',updated:new Date().toISOString(),trend:5.75,'trend-holo':42.51}}};
 assert.equal(marketQuote(holo,'Holo Rare','Not applicable')?.amount,42.51);
 assert.equal(marketQuote({...holo,pricing:{cardmarket:{unit:'EUR',updated:new Date().toISOString(),trend:5.75}}},'Holo Rare','Not applicable'),null);
 assert.equal(marketQuote(holo,'Normal','Not applicable')?.amount,5.75);
});
test('suffix OCR errors are corrected only with a matching printed total',()=>{
 assert.equal(matchesCard(card,{name:'Gardevoir GX',number:'245',total:'198',language:'English'}),true);
 assert.equal(matchesCard(card,{name:'Gardevoir GX',number:'245',language:'English'}),false);
 assert.equal(matchesCard(card,{name:'Gardevoir GX',number:'245',total:'199',language:'English'}),false);
});


test('catalogue images must use the trusted host and scanned language',()=>{
 const imageCard={...card,image:'https://assets.tcgdex.net/en/sv/sv01/245'};
 assert.equal(catalogImageUrl(imageCard,'English'),'https://assets.tcgdex.net/en/sv/sv01/245/high.webp');
 assert.equal(catalogImageUrl(imageCard,'Japanese'),null);
 for(const image of [undefined,'https://evil.example/en/sv/245','https://assets.tcgdex.net.evil.example/en/245','https://assets.tcgdex.net/en/245?redirect=x'])assert.equal(catalogImageUrl({...card,image},'English'),null);
});
for(const status of [200,404])test('matched catalogue image availability: '+status,async(t)=>{
 const imageCard={...card,pricing:undefined,image:'https://assets.tcgdex.net/en/sv/sv01/245'};
 t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
  if(init?.method==='HEAD')return new Response(null,{status,headers:{'content-type':'image/webp'}});
  return Response.json(imageCard);
 });
 const result=await enrichCard({name:'Gardevoir ex',number:'245',language:'English'},card.id);
 assert.equal(result.matched,true);
 assert.equal('image_url' in result?result.image_url:null,status===200?'https://assets.tcgdex.net/en/sv/sv01/245/high.webp':null);
});


test('vintage prices require the correct edition and never use a general market quote',()=>{
 const vintage={...card,variants:{holo:true,firstEdition:true}};
 assert.equal(marketQuote(vintage,'Holo Rare'),null);
 assert.equal(marketQuote(vintage,'Holo Rare','1st Edition'),null);
 assert.equal(marketQuote(vintage,'Holo Rare','Unlimited'),null);
 const priced={...vintage,pricing:{tcgplayer:{unit:'USD',updated:'2026-10-14','1st-edition-holofoil':{marketPrice:999},'unlimited-holofoil':{marketPrice:200}}}};
 assert.equal(marketQuote(priced,'Holo Rare','1st Edition')?.amount,999);
 assert.equal(marketQuote(priced,'Holo Rare','Unlimited')?.amount,200);
});


test('Base Set Charizard standard Unlimited quote requires the verified product ID',()=>{
 const standard:CatalogCard={...card,id:'base1-4',variants:{holo:true,firstEdition:true},pricing:{tcgplayer:{unit:'USD',updated:'2026-10-16',holofoil:{productId:42382,marketPrice:954.65}}}};
 assert.equal(marketQuote(standard,'Holo Rare','Unlimited')?.amount,954.65);
 assert.equal(marketQuote(standard,'Holo Rare','1st Edition'),null);
 assert.equal(marketQuote(standard,'Holo Rare'),null);
 assert.equal(marketQuote({...standard,id:'base1-2'},'Holo Rare','Unlimited'),null);
 assert.equal(marketQuote({...standard,pricing:{tcgplayer:{unit:'USD',updated:'2026-10-16',holofoil:{productId:999,marketPrice:954.65}}}},'Holo Rare','Unlimited'),null);
});
