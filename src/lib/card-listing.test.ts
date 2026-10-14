import test from 'node:test';
import assert from 'node:assert/strict';
import { validateListing } from './card-listing';
const card = { name: ' Pikachu ', price: 199, available: false, image_url: 'https://res.cloudinary.com/example/card.jpg', language: 'English', number: '025' };
test('listing keeps prices in pence and drafts unavailable', () => {
  const listing = validateListing(card);
  assert.equal(listing.name, 'Pikachu'); assert.equal(listing.price, 199); assert.equal(listing.available, false);
});
test('invalid data and unsafe image URLs are rejected', () => {
  for (const patch of [{ name: '' }, { price: 1.1 }, { price: -1 }, { available: 'true' }, { language: 'unknown' }, { image_url: 'javascript:alert(1)' }, { image_url: 'https://user:pass@example.com/image.jpg' }]) {
    assert.throws(() => validateListing({ ...card, ...patch }));
  }
});


test('condition is preserved and unsupported or invented grades are rejected',()=>{
 for(const condition of ['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged'])assert.equal(validateListing({...card,condition}).condition,condition);
 assert.equal(validateListing(card).condition,null);
 for(const condition of ['Mint 10','Good',123])assert.throws(()=>validateListing({...card,condition}));
});


test('edition is stored separately from rarity and finish',()=>{
 for(const edition of ['1st Edition','Unlimited','Not applicable'])assert.equal(validateListing({...card,edition}).edition,edition);
 assert.equal(validateListing(card).edition,null);
 assert.throws(()=>validateListing({...card,edition:'Secret Rare'}));
});
