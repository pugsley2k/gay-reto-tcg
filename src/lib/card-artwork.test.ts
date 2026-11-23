import test from 'node:test';
import assert from 'node:assert/strict';
import {isListingPhoto,listingArtwork,showsListingPhoto} from './card-artwork';

const photo='https://htgchoxjicmmyyeeedag.supabase.co/storage/v1/object/public/card-photos/vinted/10932102780-front.jpg';
const art='https://assets.tcgdex.net/en/xy/xy8/49/high.webp';

test('catalogue artwork wins when the listing has it',()=>{
  assert.equal(listingArtwork({image_url:art,front_image_url:photo}),art);
  assert.equal(showsListingPhoto({image_url:art,front_image_url:photo}),false);
});
test('the photo of the actual card replaces the placeholder',()=>{
  for(const image_url of [null,'','https://assets.tcgdex.net/en/sv/sv03.5/125/high.webp']){
    assert.equal(listingArtwork({image_url,front_image_url:photo}),photo);
    assert.equal(showsListingPhoto({image_url,front_image_url:photo}),true);
  }
});
test('the placeholder is only used when there is neither artwork nor a photo',()=>{
  assert.equal(listingArtwork({image_url:null,front_image_url:null}),'/placeholder.png');
  assert.equal(listingArtwork({}),'/placeholder.png');
});
test('only photos from the shop card-photos bucket are used',()=>{
  assert.equal(isListingPhoto(photo),true);
  for(const value of ['https://evil.test/card-photos/x.jpg','http://htgchoxjicmmyyeeedag.supabase.co/storage/v1/object/public/card-photos/x.jpg','https://htgchoxjicmmyyeeedag.supabase.co/storage/v1/object/public/other/x.jpg','javascript:alert(1)',null,42])assert.equal(isListingPhoto(value),false);
});
