import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.CART_TEST_URL || 'http://localhost:12010';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Cart interaction tests must run against a local server.');
const one = {id:'00000000-0000-4000-8000-000000000001',name:'Pikachu test card',price:1000,imageUrl:'/placeholder.png',quantity:1};
const two = {id:'00000000-0000-4000-8000-000000000002',name:'Raichu test card',price:1500,imageUrl:'/placeholder.png',quantity:1};
const catalogue = [one,two].map(card=>({...card,image_url:card.imageUrl,available:true,set:'Test set',language:'English',condition:'Near mint'}));
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});});
after(async()=>{await browser?.close();});

async function shopper(t,{saved=[one],promo='MEW5',blocked=false,stock,delayScripts=false,javaScriptEnabled=true}={}) {
  const context=await browser.newContext({javaScriptEnabled,reducedMotion:'reduce',viewport:{width:1280,height:900}}); t.after(()=>context.close());
  await context.addInitScript(({saved,promo,blocked})=>{
    if(blocked){Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError');}});return;}
    if(!sessionStorage.getItem('cart-test-seeded')){localStorage.setItem('cart',JSON.stringify(saved));localStorage.setItem('cart-promo',promo);sessionStorage.setItem('cart-test-seeded','1');}
    window.cartWrites=[];const write=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(this===localStorage&&key==='cart')window.cartWrites.push(value);return write.call(this,key,value);};
  },{saved,promo,blocked});
  let releaseScripts;const scriptsReady=new Promise(resolve=>{releaseScripts=resolve;});
  if(delayScripts)await context.route('**/_next/**/*.js',async route=>{await scriptsReady;await route.continue();});
  await context.route('**/rest/v1/Card?**',async route=>{
    if(new URL(route.request().url()).searchParams.get('select')==='id,available') {
      if(stock)return stock(route);
      return route.fulfill({json:[one,two].map(c=>({id:c.id,available:true}))});
    }
    return route.fulfill({json:catalogue,headers:{'content-range':'0-1/2'}});
  });
  await context.route('**/api/shop-filters',route=>route.fulfill({json:{}}));
  // Every payment/cancellation request is mocked. No test can reserve or charge real stock.
  const checkout=[];const capture=[];const cancellations=[];
  let captureResult={success:true};
  await context.route('**/api/checkout',route=>{checkout.push(route.request().postDataJSON());return route.fulfill({status:503,json:{error:'Test checkout retry'}});});
  await context.route('**/api/paypal-capture',route=>{capture.push(route.request().postDataJSON());return route.fulfill({json:captureResult});});
  await context.route('**/api/checkout-cancel',route=>{cancellations.push(route.request().postDataJSON());return route.fulfill({json:{cancelled:true}});});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/hydration|did not match|server rendered/i.test(message.text()))errors.push(message.text());});
  t.after(()=>assert.deepEqual(errors.filter(e=>!/Clerk/.test(e)),[],'No page or hydration exceptions'));
  return {context,page,checkout,capture,cancellations,releaseScripts,setCapture:value=>{captureResult=value;}};
}

test('public page text and navigation render with JavaScript disabled',async t=>{
  const {page}=await shopper(t,{javaScriptEnabled:false});
  for(const [path,heading] of [['/','Find your next Pokémon card.'],['/shop','Browse cards'],['/delivery','UK delivery'],['/returns','Returns'],['/contact','Contact']]) {
    const response=await page.goto(base+path);assert.equal(response.status(),200);
    assert.equal(await page.getByRole('heading',{level:1,name:heading,exact:true}).count(),1,path);
    assert.ok(await page.getByRole('link',{name:'GAY RETRO TCG Home',exact:true}).isVisible());
    if(path==='/'&&process.env.CART_TEST_SCREENSHOT)await page.screenshot({path:process.env.CART_TEST_SCREENSHOT,fullPage:false});
  }
  await page.goto(base+'/cart');assert.ok(await page.locator('noscript').isVisible());
  assert.equal(await page.locator('noscript').innerText(),'Enable JavaScript to use the cart and checkout.');
  assert.equal(await page.getByRole('button',{name:'Checkout with PayPal'}).count(),0);
  if(process.env.CART_TEST_PRODUCT_PATH){
    await page.goto(base+process.env.CART_TEST_PRODUCT_PATH);
    assert.equal(await page.locator('h1').count(),1);assert.ok(await page.getByRole('button',{name:'Loading cart…'}).isDisabled());
  }
});

test('saved cart and gift code restore after scripts arrive without an empty-cart flash or overwrite',async t=>{
  const {page,releaseScripts}=await shopper(t,{saved:[one,two],delayScripts:true});
  await page.goto(base+'/cart',{waitUntil:'domcontentloaded'});
  assert.ok(await page.getByText('Loading your saved cart…').isVisible());
  assert.equal(await page.getByRole('heading',{name:'Your cart is empty'}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Checkout with PayPal'}).count(),0);
  releaseScripts();
  await page.getByRole('link',{name:one.name,exact:true}).waitFor();
  assert.equal(await page.getByLabel('Gift code',{exact:true}).inputValue(),'MEW5');
  assert.ok(await page.getByText('£28.25',{exact:true}).isVisible());
  const writes=await page.evaluate(()=>window.cartWrites.map(value=>JSON.parse(value)));
  assert.ok(writes.length>0);assert.ok(writes.every(cards=>cards.length===2),'Restoring a saved cart must not persist the initial empty state');
  await page.reload();await page.getByRole('link',{name:two.name,exact:true}).waitFor();
  assert.equal(await page.getByLabel('Gift code',{exact:true}).inputValue(),'MEW5');
});

test('remove and checkout retry preserve the selected items, promotion and request ID',async t=>{
  const {page,checkout}=await shopper(t,{saved:[one,two]});await page.goto(base+'/cart');
  await page.getByRole('link',{name:one.name,exact:true}).waitFor();
  await page.locator('[class*="cartItem_"]').filter({hasText:one.name}).getByRole('button',{name:'Remove',exact:true}).click();
  assert.equal(await page.getByRole('link',{name:one.name,exact:true}).count(),0);
  for(let attempt=0;attempt<2;attempt++){await page.getByRole('button',{name:'Checkout with PayPal'}).click();await page.getByRole('alert').filter({hasText:'Test checkout retry'}).waitFor();}
  assert.equal(checkout.length,2);assert.equal(checkout[0].requestId,checkout[1].requestId);
  assert.equal(checkout[0].promoCode,'MEW5');assert.equal(checkout[0].shippingMethod,'tracked-48');
  assert.deepEqual(checkout[0].lineItems.map(item=>({id:item.cardId,quantity:item.quantity})),[{id:two.id,quantity:1}]);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('cart')).map(c=>c.id)),[two.id]);
});

test('a delayed stock response removes sold saved cards but keeps newly added cards',async t=>{
  let release;const ready=new Promise(resolve=>{release=resolve;});
  const {page}=await shopper(t,{stock:async route=>{await ready;await route.fulfill({json:[{id:one.id,available:false}]});}});
  await page.goto(base+'/shop');await page.locator('article').filter({hasText:two.name}).getByRole('button',{name:'Add to cart',exact:true}).click();
  release();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cart')).length===1&&JSON.parse(localStorage.getItem('cart'))[0].id.endsWith('0002'));
  await page.getByRole('link',{name:'View cart →',exact:true}).click();await page.waitForURL(base+'/cart');await page.getByRole('link',{name:two.name,exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:one.name,exact:true}).count(),0);
});

test('stock lookup failure keeps a restored cart available for server validation at checkout',async t=>{
  const {page}=await shopper(t,{stock:route=>route.fulfill({status:503,json:{error:'Test stock timeout'}})});
  await page.goto(base+'/cart');await page.getByRole('link',{name:one.name,exact:true}).waitFor();
  assert.ok(await page.getByRole('button',{name:'Checkout with PayPal'}).isEnabled());
});

test('blocked browser storage still allows adding a card and submitting checkout in memory',async t=>{
  const {page,checkout}=await shopper(t,{blocked:true});await page.goto(base+'/shop');
  await page.locator('article').filter({hasText:two.name}).getByRole('button',{name:'Add to cart',exact:true}).click();
  await page.getByRole('link',{name:'View cart →',exact:true}).click();await page.getByRole('link',{name:two.name,exact:true}).waitFor();
  await page.getByRole('button',{name:'Checkout with PayPal'}).click();await page.getByRole('alert').filter({hasText:'Test checkout retry'}).waitFor();
  assert.equal(checkout[0].lineItems[0].cardId,two.id);
});

test('payment capture waits for cart readiness, clears confirmed orders once and does not restore them',async t=>{
  const {page,capture,releaseScripts}=await shopper(t,{delayScripts:true});
  await page.goto(base+'/success?token=TEST-TOKEN',{waitUntil:'domcontentloaded'});assert.equal(capture.length,0);releaseScripts();
  await page.getByRole('heading',{name:'PAYMENT SUCCESSFUL!'}).waitFor();
  await page.waitForFunction(()=>localStorage.getItem('cart')==='[]'&&!localStorage.getItem('cart-promo'));
  await page.waitForTimeout(300);assert.equal(capture.length,1);
  await page.getByRole('link',{name:'Continue Shopping'}).click();
  await page.goto(base+'/cart');await page.getByRole('heading',{name:'Your cart is empty'}).waitFor();
});

test('uncertain payment keeps the cart; explicit status retry clears it only after confirmation',async t=>{
  const {page,capture,setCapture}=await shopper(t);setCapture({pending:true,message:'Payment status is uncertain.'});
  await page.goto(base+'/success?token=TEST-PENDING');await page.getByRole('heading',{name:'Checking your order'}).waitFor();
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('cart')))).length,1);
  setCapture({success:true});await page.getByRole('button',{name:'Check payment status'}).click();await page.getByRole('heading',{name:'PAYMENT SUCCESSFUL!'}).waitFor();
  assert.equal(capture.length,2);await page.waitForFunction(()=>localStorage.getItem('cart')==='[]');
});

test('returning from cancelled checkout releases the attempt without losing the restored cart',async t=>{
  const {page,cancellations}=await shopper(t);
  await page.goto(base+'/cart?cancel_checkout=00000000-0000-4000-8000-000000000099');
  await page.waitForURL(base+'/cart');await page.getByRole('link',{name:one.name,exact:true}).waitFor();
  assert.equal(cancellations.length,1);assert.ok(await page.getByRole('button',{name:'Checkout with PayPal'}).isEnabled());
});

test('mobile cart restores totals and keeps checkout usable',async t=>{
  const {page,checkout}=await shopper(t);await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/cart');await page.getByRole('link',{name:one.name,exact:true}).waitFor();
  assert.ok(await page.getByText('£14.00',{exact:true}).isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'Checkout with PayPal'}).click();await page.getByRole('alert').filter({hasText:'Test checkout retry'}).waitFor();
  assert.equal(checkout.length,1);assert.equal(checkout[0].promoCode,'MEW5');
});
