import test from 'node:test';
import assert from 'node:assert/strict';
import {readGrading,completeGrading,pricingGrade} from './card-grading';
import {resolveCatalogEdition} from './card-catalog';
import {validateListing} from './card-listing';
import {sameListing} from './listing-retry';
import {gradedPrice,verifiedGradedQuote} from './graded-pricing';
const grading={company:'PSA',grade:'10',cert_number:'00123456',confirmed:true};
const identity={name:'Charizard',number:'4',set:'Base Set',language:'English',edition:'Unlimited',finish:'Holo Rare'};
const quote={...identity,...grading,amount:1234.56,currency:'GBP',basis:'sold',date:new Date().toISOString().slice(0,10),url:'https://example.com/sold/123'};
const urls=new Set([quote.url]);
const card={name:'Charizard',number:'4',language:'English',image_url:'https://example.com/slab.jpg',front_image_url:'https://example.com/slab.jpg',available:true,price:120000,grading};
test('slab reading preserves leading zeroes, full grade qualifiers and missing fields',()=>{
 assert.equal(readGrading(grading)?.cert_number,'00123456');
 assert.equal(readGrading({...grading,grade:'10 Black Label'})?.grade,'10 Black Label');
 assert.equal(completeGrading(readGrading({})),false);
 assert.equal(readGrading(null),null);
});
test('publishing requires a complete confirmed slab label and the actual slab photo',()=>{
 assert.deepEqual(validateListing(card).grading,grading);
 assert.equal(validateListing({...card,image_url:'https://assets.tcgdex.net/en/base/base1/4/high.webp'}).front_image_url,card.front_image_url);
 assert.equal(validateListing({...card,condition:'Near Mint'}).condition,null);
 for(const patch of [{grading:{...grading,confirmed:false}},{grading:{...grading,cert_number:''}},{front_image_url:null}])assert.throws(()=>validateListing({...card,...patch}));
 assert.equal(sameListing({grading:{grade:'10',company:'PSA',confirmed:true,cert_number:'00123456'}},{grading}),true);
 assert.equal(sameListing({grading:{...grading,grade:'9'}},{grading}),false);
});
test('only an exact recent cited graded price is accepted',()=>{
 assert.equal(verifiedGradedQuote(quote,identity,grading,urls)?.gbp,'1234.56');
 for(const patch of [{company:'CGC'},{grade:'9'},{grade:'10 Pristine'},{edition:'1st Edition'},{language:'Japanese'},{finish:'Reverse Holo'},{set:'Base Set 2'},{basis:'asking'},{currency:'BTC'},{url:'https://invented.example/price'},{date:'2020-01-01'},{amount:Infinity}])assert.equal(verifiedGradedQuote({...quote,...patch},identity,grading,urls),null);
 assert.equal(verifiedGradedQuote(quote,identity,grading,new Set()),null);
 assert.equal(verifiedGradedQuote({...quote,grade:'10'},identity,{...grading,grade:'10+'},urls),null);
});
test('ordinary grade descriptions normalise without erasing premium designations',()=>{
 assert.equal(pricingGrade('7 Excellent'),'7');assert.equal(pricingGrade('EXCELLENT 7'),'7');
 assert.equal(verifiedGradedQuote({...quote,grade:'10 Gem Mint'},identity,grading,urls)?.gbp,'1234.56');
 for(const value of ['10 Pristine','10 Black Label','10+','10 OC'])assert.notEqual(pricingGrade(value),'10');
});
test('English e-reader edition resolves from known catalogue variants only',()=>{
 const card={id:'ecard2-H26',name:'Tentacruel',localId:'H26',set:{name:'Aquapolis',cardCount:{official:147}},variants:{firstEdition:false}};
 assert.equal(resolveCatalogEdition(card,{language:'English'}),'Not applicable');
 assert.equal(resolveCatalogEdition(card,{language:'Japanese'}),null);
 assert.equal(resolveCatalogEdition({...card,id:'base1-4'},{language:'English'}),null);
 assert.equal(resolveCatalogEdition(card,{language:'English',edition:'1st Edition'}),'1st Edition');
});
test('missing certificates do not block pricing and different graders stay comparisons only',async(t)=>{
 const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-only';t.after(()=>{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;});
 let called=false;t.mock.method(globalThis,'fetch',async()=>{called=true;return Response.json({output:[{type:'web_search_call',action:{sources:[{url:quote.url}]}},{content:[{type:'output_text',text:JSON.stringify({quote:{...quote,company:'PSA'},comparisons:[{...quote,company:'PSA'}]})}]}]});});
 const result=await gradedPrice(identity,{...grading,company:'GetGraded',cert_number:''});
 assert.equal(called,true);assert.equal(result.pricing,null);assert.equal(result.comparisons?.[0].company,'PSA');assert.equal(result.comparisons?.[0].gbp,'1234.56');
});
test('undated guides are comparison-only and generic grade bands are never called PSA prices',()=>{
 const url='https://www.pricecharting.com/game/pokemon-aquapolis/tentacruel-h26';const sources=new Set([url]);
 const identity={name:'Tentacruel',number:'H26',set:'Aquapolis',language:'English',edition:'Not applicable',finish:'Holo Rare'};
 const grading={company:'Mixed graders',grade:'7',cert_number:'',confirmed:false};
 const data={...identity,company:'Mixed graders',grade:'7',amount:180,currency:'USD',basis:'guide',date:null,url};
 assert.equal(verifiedGradedQuote(data,identity,grading,sources),null);
 assert.equal(verifiedGradedQuote(data,identity,grading,sources,true)?.date_kind,'accessed');
 assert.equal(verifiedGradedQuote({...data,company:'PSA'},identity,{...grading,company:'PSA'},sources,true),null);
 assert.equal(verifiedGradedQuote({...data,basis:'sold'},identity,grading,sources,true),null);
 assert.equal(verifiedGradedQuote({...data,number:'H26/H32',edition:'Unlimited'},identity,grading,sources,true)?.original,180);
});
test('graded enrichment never leaks a raw quote or catalogue photo when graded research has no evidence',async(t)=>{
 const {enrichCard}=await import('./card-catalog');
 const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-only';
 t.after(()=>{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;});
 t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
   if(String(input).includes('openai.com'))return Response.json({output:[{content:[{type:'output_text',text:'{"quote":null}'}]}]});
   if(init?.method==='HEAD')return new Response(null,{status:200,headers:{'content-type':'image/webp'}});
   return Response.json({id:'base1-4',name:'Charizard',localId:'4',set:{name:'Base Set',cardCount:{official:102}},variants:{holo:true,firstEdition:true},pricing:{tcgplayer:{unit:'USD',updated:new Date().toISOString(),holofoil:{productId:42382,marketPrice:500}}}});
 });
 const result=await enrichCard({...identity,grading,total:'102'},'base1-4');
 assert.equal(result.matched,true);assert.equal('pricing' in result&&result.pricing,null);assert.equal('image_url' in result&&result.image_url,null);
});
test('graded research parses cited evidence and converts USD using a fresh server rate',async(t)=>{
 const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-only';
 t.after(()=>{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;});
 t.mock.method(globalThis,'fetch',async(input:unknown)=>String(input).includes('frankfurter')?Response.json({date:quote.date,rates:{GBP:0.75}}):Response.json({output:[{type:'web_search_call',action:{sources:[{url:quote.url}]}},{content:[{type:'output_text',text:JSON.stringify({quote:{...quote,amount:100,currency:'USD'}})}]}]}));
 const result=await gradedPrice(identity,grading);
 assert.equal(result.pricing?.gbp,'75.00');assert.equal(result.pricing?.currency,'USD');assert.equal(result.pricing?.url,quote.url);
});
