import { serverDb } from './server-db';
import { inspectPage, safeAuditPath, webAction, type PageObservation, type WebAction } from './web-agent-checks';
import { SEO_PAGES, SITE_ORIGIN, type SeoDocument } from './seo-pages';
import { EXAMPLE_CARD_ID } from './example-listing';
import type { CheckCard } from './agent-checks';

export async function fetchPublicPage(path: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<PageObservation> {
  const started = Date.now();
  try {
    // Manual redirects are essential: a public route must not redirect our server into a private network.
    const response = await fetcher(SITE_ORIGIN + path, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]), headers: { 'User-Agent': 'Googlebot (compatible; GayRetroSiteCheck/1.0)', Accept: 'text/html,application/xml,text/plain;q=0.9,*/*;q=0.1' } });
    const contentType = response.headers.get('content-type') || '';
    let body = '';
    // Images need a status check, not a download. Text responses have a strict size cap.
    if (/text\/|xml|json/.test(contentType) && response.status === 200) {
      const reader = response.body?.getReader(); const decoder = new TextDecoder(); let bytes = 0;
      if (reader) { try { while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > 512 * 1024) throw new Error('Page exceeded the 512 KiB audit limit; inspect it manually.'); body += decoder.decode(chunk.value, { stream: true }); } body += decoder.decode(); } finally { await reader.cancel(); } }
    } else { await response.body?.cancel(); }
    return { path, status: response.status, contentType, body, durationMs: Date.now() - started };
  } catch (error) {
    return { path, status: 0, contentType: '', body: '', durationMs: Date.now() - started, error: error instanceof Error && error.message.startsWith('Page exceeded') ? error.message : 'The page could not be checked within the time limit. Retry before deciding whether it is down.' };
  }
}

async function mapLimited<T>(items: string[], fn: (path: string) => Promise<T>) {
  const results: T[] = new Array(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => { while (cursor < items.length) { const index = cursor++; results[index] = await fn(items[index]); } }));
  return results;
}
export async function runWebChecks(runId: string, cards: CheckCard[]) {
  const db = serverDb();
  const documents = await db.from('web_page_metadata').select('path,title,description,revision');
  if (documents.error || documents.data.length !== Object.keys(SEO_PAGES).length) throw new Error('SEO approval storage is not ready. Earlier website findings have been kept.');
  const products = cards.filter(c => c.id !== EXAMPLE_CARD_ID && (c.available || c.sold_at)).map(c => `/cards/${encodeURIComponent(c.id)}`);
  // Rotate a three-product sample daily, while retaining unsampled findings.
  const offset = products.length ? Math.floor(Date.now() / 86400000) * 3 % products.length : 0;
  const sample = [...products.slice(offset), ...products.slice(0, offset)].slice(0, 3);
  const paths = [...Object.keys(SEO_PAGES), ...sample, '/robots.txt', '/sitemap.xml'];
  const signal = AbortSignal.timeout(18000);
  const pages = await mapLimited(paths, path => fetchPublicPage(path, signal));
  const actions: WebAction[] = []; const checked: string[] = []; const linked = new Set<string>(); const allowedProducts = new Set(products);
  for (const page of pages) {
    const result = inspectPage(page, (documents.data as SeoDocument[]).find(d => d.path === page.path));
    actions.push(...result.actions); checked.push(...result.checked);
    for (const link of result.links) { const safe = safeAuditPath(link, allowedProducts); if (safe && !paths.includes(safe)) linked.add(safe); }
  }
  const extraPaths = [...linked].sort().slice(0, 6);
  const resources = await mapLimited(extraPaths, path => fetchPublicPage(path, signal));
  for (const resource of resources) {
    checked.push(`maintenance:${resource.path}`);
    if (resource.error || resource.status !== 200) actions.push(webAction({ scope: 'maintenance', kind: 'web_review', path: resource.path, title: `Check linked resource: ${resource.path}`, detail: resource.error || `A linked public resource returned HTTP ${resource.status}. Review the link or asset before changing it.`, severity: 'warning', snapshot: { status: resource.status } }));
  }
  const saved = await db.rpc('save_web_agent_findings', { p_run: runId, p_actions: actions, p_checked: checked });
  if (saved.error) throw new Error('Website findings could not be saved. Earlier findings have been kept.');
  return { status: pages.some(p => p.error || p.status !== 200) || resources.some(p => p.error || p.status !== 200) ? 'attention' : 'completed',
    pages: pages.length - 2, products: sample.length, totalProducts: products.length, resources: resources.length + 2, seoFindings: actions.filter(a => a.scope === 'seo').length, maintenanceFindings: actions.filter(a => a.scope === 'maintenance').length,
    checkedAt: new Date().toISOString(), coverage: 'Five core pages, up to three rotating products, crawler files and up to six linked resources. External links and images are not fetched. No browser speed or security scan.' };
}
