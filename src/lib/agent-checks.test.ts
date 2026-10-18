import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectStore,type CheckCard} from './agent-checks';
import {makeTikTokPack} from './tiktok-pack';
const card:CheckCard={id:'card',name:'Tentacruel',price:1000,available:true,image_url:'https://example.test/front.jpg',front_image_url:'https://example.test/front.jpg',back_image_url:'https://example.test/back.jpg',condition:'Lightly Played',updatedAt:'2026-10-18T12:00:00',sold_at:null};
test('complete listings need no review and demo stock is excluded',()=>{
  const result=inspectStore([{...card,price:10},{...card,id:'demo-gardevoir-ex',price:0}],[]);
  assert.equal(result.actions.length,0);assert.equal(result.summary.available,1);assert.equal(result.summary.modelCalls,0);
});
test('the same finding is deduplicated; changed listings require a new approval',()=>{
  const bad={...card,price:0};const first=inspectStore([bad],[]).actions[0];
  assert.equal(first.kind,'withdraw_listing');assert.equal(first.id,inspectStore([bad],[]).actions[0].id);
  assert.notEqual(first.id,inspectStore([{...bad,updatedAt:'2026-10-18T13:00:00'}],[]).actions[0].id);
});
test('uncertain payment is flagged without any stock release',()=>{
  const result=inspectStore([],[{id:'order',checkout_state:'capturing',created_at:'2026-10-18T10:00:00Z',capture_started_at:'2026-10-18T10:00:00Z',paid_at:null,dispatched_at:null}],Date.parse('2026-10-18T10:05:00Z'));
  assert.equal(result.actions[0].kind,'review_payment');assert.equal(result.summary.heldPayments,1);
});
test('TikTok exports are factual inbox drafts, exclude sold cards, and expire',()=>{
  const social={...card,set:'Aquapolis',number:'H26',condition:'Lightly Played',sold_at:null};
  const pack=makeTikTokPack(social,new Date('2026-10-18T12:00:00Z'));
  assert.equal(pack.mode,'tiktok-inbox');assert.equal(pack.expiresAt,'2026-10-19T12:00:00.000Z');assert.match(pack.caption,/£10.00/);
  assert.throws(()=>makeTikTokPack({...social,available:false}));
});
