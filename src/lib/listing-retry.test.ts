import test from 'node:test';
import assert from 'node:assert/strict';
import { validClientId, sameListing } from './listing-retry';
test('batch references must be UUID v4 values',()=>{
 assert.equal(validClientId('c0dc48e3-eb7c-4bc5-ab9c-8f63e3e51cc5'),true);
 for(const id of ['',undefined,'existing-card',42])assert.equal(validClientId(id),false);
});
test('a retry is recognised only when the saved listing still matches',()=>{
 const listing={name:'Pikachu',price:500,available:true,image_url:'https://example.com/card.jpg',set:null};
 assert.equal(sameListing({...listing,id:'saved'},listing),true);
 assert.equal(sameListing({...listing,available:false},listing),false);
 assert.equal(sameListing({...listing,price:100},listing),false);
 assert.equal(sameListing({...listing,image_url:'https://example.com/other.jpg'},listing),false);
});
