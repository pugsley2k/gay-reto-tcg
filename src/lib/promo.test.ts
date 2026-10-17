import test from 'node:test';
import assert from 'node:assert/strict';
import {promoDiscount} from './promo';
test('MEW5 discounts the merchandise subtotal in whole pennies',()=>{
 assert.deepEqual(promoDiscount(1299,' mew5 '),{code:'MEW5',amount:65});
 assert.equal(promoDiscount(10000,'MEW5').amount,500);
 assert.equal(promoDiscount(30,'MEW5').amount,2);
 assert.equal(promoDiscount(0,'MEW5').amount,0);
 assert.equal(promoDiscount(1000,undefined).amount,0);
});
test('unknown codes and injected discount objects are rejected',()=>{
 for(const input of ['MEW100','INVALID',{code:'MEW5',amount:99999},['MEW5'],5])assert.throws(()=>promoDiscount(1000,input));
 for(const subtotal of [-1,12.5,NaN])assert.throws(()=>promoDiscount(subtotal,'MEW5'));
});
