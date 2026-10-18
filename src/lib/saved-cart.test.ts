import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSavedCart } from './saved-cart';
const card = { id:'card-one',name:'Pikachu',price:1000,quantity:1,imageUrl:'/placeholder.png',condition:'Near mint',edition:'Unlimited' };
test('saved cards restore their display details and pence prices',()=>{
  assert.deepEqual(parseSavedCart(JSON.stringify([card])),[card]);
});
test('damaged storage cannot prevent valid cards or the storefront from loading',()=>{
  for(const value of [null,'{invalid','null','{}']) assert.deepEqual(parseSavedCart(value),[]);
  assert.deepEqual(parseSavedCart(JSON.stringify([null,{},'x',{...card,price:'1000'},card])),[card]);
});
test('restoration respects one physical copy per listing and the checkout size limit',()=>{
  assert.deepEqual(parseSavedCart(JSON.stringify([{...card,quantity:3},card])),[card]);
  assert.equal(parseSavedCart(JSON.stringify(Array.from({length:101},(_,i)=>({...card,id:String(i)})))).length,100);
});
