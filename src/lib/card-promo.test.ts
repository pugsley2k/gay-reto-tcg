import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCardPromo,promoStyle,type PromoCard} from './card-promo';
import {isCardArtwork,listingArtwork} from './card-artwork';
const card:PromoCard={id:'real-card',name:'Tentacruel',price:16000,available:true,sold_at:null,image_url:'https://images.pokemontcg.io/ecard2/H26_hires.png',front_image_url:'https://res.cloudinary.com/shop/slab.jpg',back_image_url:null,set:'Aquapolis',number:'H26/H32',condition:null,grading:{company:'GetGraded',grade:'7 Excellent',confirmed:true}};
test('promo uses catalogue artwork, current pence price and exact confirmed listing facts',()=>{
 const result=makeCardPromo(card,4);assert.equal(result.price,'£160.00');assert.equal(result.style,'tidal');assert.equal(result.revision,4);assert.match(result.caption,/GetGraded 7 Excellent/);assert.match(result.caption,/delivery/);assert.equal(JSON.stringify(result).includes('cloudinary'),false);assert.equal(result.artwork,'/api/admin/card-promos/image?cardId=real-card&revision=4');
});
test('photos, sold/draft/demo stock and invalid prices cannot become promos',()=>{
 for(const patch of [{image_url:card.front_image_url},{image_url:null},{sold_at:'2026-10-18'},{available:false},{id:'demo-charizard'},{price:0},{price:1.2}])assert.throws(()=>makeCardPromo({...card,...patch},1));
 assert.equal(listingArtwork({...card,image_url:card.front_image_url}),'/placeholder.png');
});
test('artwork allowlist rejects redirects, credentials and lookalike hosts',()=>{
 for(const url of ['https://assets.tcgdex.net.evil.test/en/a/high.webp','https://user@images.pokemontcg.io/base1/4.png','https://images.pokemontcg.io/base1/4.png?redirect=x','http://images.pokemontcg.io/base1/4.png','https://res.cloudinary.com/anything.jpg'])assert.equal(isCardArtwork(url),false);
 assert.equal(isCardArtwork('https://assets.tcgdex.net/en/sv/sv01/245/high.webp'),true);assert.equal(promoStyle('Charizard'),'ember');
});
