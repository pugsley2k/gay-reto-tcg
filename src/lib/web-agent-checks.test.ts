import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectMarkup, inspectPage, safeAuditPath } from './web-agent-checks';
import { fetchPublicPage } from './web-agent-runner';
import { SITE_ORIGIN } from './seo-pages';

const page = { path:'/shop',status:200,body:'<title>GAY RETRO TCG</title><meta content="Current text" name="description"><h1>Shop</h1>',contentType:'text/html',durationMs:3 };
test('metadata draft records the exact before/after without changing source metadata', () => {
  const doc = {path:'/shop' as const,title:null,description:null,revision:0};
  const result=inspectPage(page,doc); const draft=result.actions.find(a=>a.kind==='seo_metadata')!;
  assert.deepEqual(draft.snapshot.before,{title:'GAY RETRO TCG',description:'Current text',canonical:''});
  assert.equal((draft.snapshot.after as {canonical:string}).canonical,`${SITE_ORIGIN}/shop`);
  assert.equal(doc.revision,0); assert.equal(draft.id,inspectPage(page,doc).actions[0].id);
});
test('approved metadata is not replaced by another template draft', () => {
  const result=inspectPage(page,{path:'/shop',title:'Owner title',description:'Owner description',revision:1});
  assert.ok(!result.actions.some(a=>a.kind==='seo_metadata'));
  assert.ok(result.actions.some(a=>a.title.includes('not visible')));
});
test('failed or non-HTML page retains previous SEO findings', () => {
  for(const bad of [{...page,status:503},{...page,error:'timeout'},{...page,contentType:'application/json'}]) {
    const result=inspectPage(bad); assert.deepEqual(result.checked,['maintenance:/shop']); assert.equal(result.actions[0].scope,'maintenance');
  }
});
test('extractor reads streamed metadata and ignores script text, comments and attribute ordering', () => {
  const parsed=inspectMarkup(`<script>"<title>Fake</title><meta name='robots' content='noindex'>"</script><!-- <h1>fake</h1> --><div></div><title>Cards &amp; Gifts &#x1F496;</title><meta content='Real &quot;description&quot;' name='description'/><link href='${SITE_ORIGIN}/shop' rel='canonical'><h1>Shop</h1>`);
  assert.equal(parsed.title,'Cards & Gifts 💖');assert.equal(parsed.description,'Real "description"');assert.equal(parsed.noindex,false);assert.equal(parsed.h1,1);
});
test('product JSON-LD must be valid JSON and contain a Product type',()=>{
  assert.equal(inspectMarkup('<script type="application/ld+json">{"@graph":[{"@type":"Product"}]}</script>').productSchema,true);
  assert.equal(inspectMarkup('<script type="application/ld+json">not JSON Product</script>').productSchema,false);
});
test('crawl whitelist excludes credentials, external hosts, query strings and sensitive paths',()=>{
  const products=new Set(['/cards/abc']);
  for(const link of ['https://evil.test/shop','http://127.0.0.1/admin','//evil.test/shop','https://user:pass@www.gayretrotcg.com/shop','/api/paypal/create-order','/admin/control','/cart','/shop?delete=true','/images/../../api/order','/cards/not-a-live-card','/shop#filter']) assert.equal(safeAuditPath(link,products),null,link);
  for(const link of ['/shop','/cards/abc','/favicon.png','/images/card.jpg']) assert.equal(safeAuditPath(link,products),link);
});
test('crawler does not follow redirects or forward credentials',async()=>{
  let options: RequestInit | undefined;
  const stub:typeof fetch=async(_url,init)=>{options=init;return new Response('',{status:302,headers:{location:'http://127.0.0.1'}});};
  const result=await fetchPublicPage('/shop',new AbortController().signal,stub);
  assert.equal(result.status,302);assert.equal(options?.redirect,'manual');assert.equal((options?.headers as Record<string,string>).Authorization,undefined);
});
test('crawler cancels oversized pages and reports incomplete inspection',async()=>{
  const result=await fetchPublicPage('/shop',new AbortController().signal,async()=>new Response('x'.repeat(512*1024+1),{headers:{'content-type':'text/html'}}));
  assert.match(result.error!,/512 KiB/);assert.equal(result.body,'');
});
test('crawler returns a stable useful failure for network errors',async()=>{
  const result=await fetchPublicPage('/shop',new AbortController().signal,async()=>{throw new Error('secret internal host');});
  assert.match(result.error!,/could not be checked/);assert.ok(!result.error!.includes('secret'));
});
test('crawler files must have actual expected content, not an HTML fallback',()=>{
  assert.equal(inspectPage({...page,path:'/sitemap.xml'}).actions.length,1);
  assert.equal(inspectPage({...page,path:'/robots.txt',body:`User-agent: *\nSitemap: ${SITE_ORIGIN}/sitemap.xml`}).actions.length,0);
});
