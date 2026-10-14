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
