import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../pages/api/checkout';
import {orderEmail} from './order-email';
import {royalMailPayload} from './royal-mail-payload';

test('checkout charges and stores the server-priced 5% discount, excluding shipping',async(t)=>{
 let stored:any;let paypal:any;
 const oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,oldKey=process.env.SUPABASE_SECRET_KEY;
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://database.example.com';process.env.SUPABASE_SECRET_KEY='test-only-secret';
 t.after(()=>{if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=oldKey;});
 t.mock.method(globalThis,'fetch',async(url:any,init:any)=>{
   const address=String(url);
   if(address.includes('/rest/v1/Card'))return Response.json([{id:'a',name:'Mew',price:1299,available:true}]);
   if(address.includes('/rest/v1/card_economics'))return Response.json([]);
   if(address.includes('/rpc/reserve_checkout')){const args=JSON.parse(init.body);stored={id:args.p_id,items:args.p_items,shipping:args.p_shipping};return Response.json(stored);}
   if(address.includes('/rest/v1/orders'))return Response.json({id:stored.id});
   if(String(url).endsWith('/v1/oauth2/token'))return Response.json({access_token:'test-token'});
   paypal=JSON.parse(init.body);return Response.json({id:'test-paypal',links:[{rel:'approve',href:'https://www.paypal.com/checkoutnow?token=test'}]});
 });
 let status=200;let result:any;
 const res={setHeader(){},status(value:number){status=value;return this;},json(value:any){result=value;return this;}};
 await handler({method:'POST',cookies:{},body:{requestId:'d870ad10-7d62-4b98-8040-d86b3ab05f71',lineItems:[{cardId:'a',quantity:1,price_data:{unit_amount:1}}],shippingMethod:'tracked-48',promoCode:'mew5'},headers:{origin:'https://www.gayretrotcg.com'}} as any,res as any);
 assert.equal(status,200);assert.ok(result.url);
 assert.equal(stored.shipping.subtotal,1299);assert.equal(stored.shipping.discount,65);assert.equal(stored.shipping.total,1684);assert.equal(stored.shipping.promo_code,'MEW5');
 const amount=paypal.purchase_units[0].amount;
 assert.equal(amount.value,'16.84');assert.equal(amount.breakdown.item_total.value,'12.99');assert.equal(amount.breakdown.discount.value,'0.65');assert.equal(amount.breakdown.shipping.value,'4.50');
 const email=orderEmail(stored,'confirmation');assert.match(email.text,/Gift code MEW5: -£0.65/);assert.match(email.text,/Total paid: £16.84/);
 const postal=royalMailPayload({...stored,paid_at:'2026-10-17T10:00:00Z',customer_email:'buyer@example.com',delivery_address:{address:{address_line_1:'1 Test Road',admin_area_2:'Test Town',postal_code:'AB1 2CD',country_code:'GB'}}},150);
 assert.equal(postal.items[0].subtotal,12.34);assert.equal(postal.items[0].total,16.84);
});

test('an invalid coupon stops checkout before any order or payment request',async(t)=>{
 const oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,oldKey=process.env.SUPABASE_SECRET_KEY;
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://database.example.com';process.env.SUPABASE_SECRET_KEY='test-only-secret';
 t.after(()=>{if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=oldKey;});
 const calls:string[]=[];
 t.mock.method(globalThis,'fetch',async(url:any)=>{calls.push(String(url));return Response.json([{id:'a',name:'Mew',price:1299,available:true}]);});
 let status=200;let result:any;
 const res={setHeader(){},status(value:number){status=value;return this;},json(value:any){result=value;return this;}};
 await handler({method:'POST',cookies:{},body:{requestId:'d870ad10-7d62-4b98-8040-d86b3ab05f71',lineItems:[{cardId:'a',quantity:1}],shippingMethod:'tracked-48',promoCode:'MEW100'},headers:{origin:'https://www.gayretrotcg.com'}} as any,res as any);
 assert.equal(status,400);assert.match(result.error,/not recognised/);assert.equal(calls.length,2);assert.ok(calls.every(url=>/\/rest\/v1\/(Card|card_economics)/.test(url)));
});
