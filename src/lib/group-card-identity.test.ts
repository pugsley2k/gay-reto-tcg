import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGroupIdentities} from './group-card-identity';
import {listingPhotoIssue,catalogueOnlyAllowed} from './listing-photo-policy';
import {validateListing} from './card-listing';
test('group recognition keeps physical duplicates and abstains on unreadable fields',()=>{
 const card={name:'Venusaur ex',card_number:null,language:'English',position:'Row 2'};
 const result=parseGroupIdentities({cards:[card,card,{name:null,language:'invented',slab:true}],warnings:['Glare']});
 assert.equal(result.cards.length,3);assert.equal(result.cards[0].card_number,'');assert.equal(result.cards[2].language,'');assert.equal(result.cards[2].slab,true);assert.equal(result.warnings[0],'Glare');
 assert.throws(()=>parseGroupIdentities({cards:'bad'}));
});
test('server rejects catalogue-only publishing at the threshold and accepts matching cheap artwork',()=>{
 const card={name:'Pikachu',language:'English',available:true,price:1999,image_url:'https://images.pokemontcg.io/base1/58.png'};
 assert.equal(validateListing(card).front_image_url,null);
 assert.throws(()=>validateListing({...card,price:2000}),/individual photo/);
 assert.throws(()=>validateListing({...card,image_url:'https://example.com/group-photo.jpg'}),/artwork/);
 assert.equal(validateListing({...card,price:2000,front_image_url:'https://example.com/individual.jpg'}).price,2000);
});
test('catalogue-only threshold is strictly below £20 and excludes slabs or unmatched artwork',()=>{
 assert.equal(catalogueOnlyAllowed(1999,false,true),true);
 for(const price of [2000,2001,NaN,0,-1])assert.equal(catalogueOnlyAllowed(price,false,true),false);
 assert.equal(catalogueOnlyAllowed(1000,true,true),false);
 assert.equal(catalogueOnlyAllowed(1000,false,false),false);
 assert.equal(listingPhotoIssue(1999,false,false,true),'');
 assert.match(listingPhotoIssue(2000,false,false,true),/individual photo/);
 assert.match(listingPhotoIssue(1000,true,false,true),/slab/);
 assert.match(listingPhotoIssue(1000,false,false,false),/artwork/);
 assert.equal(listingPhotoIssue(5000,false,true,true),'');
});
