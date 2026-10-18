import { createHash } from 'node:crypto';
import { SEO_PAGES, SITE_ORIGIN, type SeoDocument, type SeoPath } from './seo-pages';

export type WebAction = { id: string; scope: 'seo' | 'maintenance'; kind: 'seo_metadata' | 'web_review'; path: string; title: string; detail: string; severity: 'attention' | 'warning'; snapshot: Record<string, unknown> };
export type PageObservation = { path: string; status: number; body: string; contentType: string; durationMs: number; error?: string };
export function webAction(action: Omit<WebAction, 'id'>): WebAction {
  return { ...action, id: createHash('sha256').update(JSON.stringify(['web', action])).digest('hex') };
}

// A small extractor for our server-rendered markup, not a browser or JS evaluator.
function decode(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity: string) => {
    if (entity[0] === '#') { const code = parseInt(entity.slice(entity[1]?.toLowerCase() === 'x' ? 2 : 1), entity[1]?.toLowerCase() === 'x' ? 16 : 10); return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''; }
    return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' } as Record<string, string>)[entity.toLowerCase()];
  }).replace(/\s+/g, ' ').trim();
}
function attributes(tag: string) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m => [m[1].toLowerCase(), decode(m[2] ?? m[3] ?? m[4])]));
}
export function inspectMarkup(html: string) {
  const markup = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  const meta = [...markup.matchAll(/<meta\b[^>]*>/gi)].map(m => attributes(m[0]));
  const links = [...markup.matchAll(/<(?:a|link|img)\b[^>]*>/gi)].map(m => attributes(m[0]));
  return { title: decode(markup.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''),
    description: meta.find(m => m.name?.toLowerCase() === 'description')?.content || '',
    canonical: links.find(l => l.rel?.toLowerCase() === 'canonical')?.href || '',
    noindex: meta.some(m => /^(robots|googlebot)$/i.test(m.name || '') && /\bnoindex\b/i.test(m.content || '')),
    h1: [...markup.matchAll(/<h1\b/gi)].length,
    links: links.map(l => l.href || l.src).filter(Boolean),
    productSchema: [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].some(m => {
      try { const value: unknown = JSON.parse(m[1]); const visit = (v: unknown): boolean => !!v && typeof v === 'object' && (Array.isArray(v) ? v.some(visit) : Object.entries(v).some(([k, x]) => k === '@type' && (x === 'Product' || Array.isArray(x) && x.includes('Product')) || visit(x))); return visit(value); } catch { return false; }
    }),
  };
}

export function inspectPage(page: PageObservation, document?: SeoDocument) {
  const actions: WebAction[] = []; const checked = [`maintenance:${page.path}`];
  const add = (scope: WebAction['scope'], title: string, detail: string, snapshot: Record<string, unknown> = {}) => actions.push(webAction({ scope, kind: 'web_review', path: page.path, title, detail, severity: scope === 'maintenance' ? 'warning' : 'attention', snapshot }));
  if (page.error || page.status !== 200) {
    add('maintenance', `Check ${page.path}`, page.error || `The public URL returned HTTP ${page.status}. Review the route or redirect before changing the website.`, { status: page.status });
    return { actions, checked, links: [] as string[] };
  }
  if (page.path === '/robots.txt' || page.path === '/sitemap.xml') {
    const valid = page.path === '/robots.txt' ? /User-agent:/i.test(page.body) && page.body.includes(`${SITE_ORIGIN}/sitemap.xml`) : /<urlset\b/.test(page.body) && page.body.includes(`${SITE_ORIGIN}/shop`);
    if (!valid) add('maintenance', `Review ${page.path}`, 'The response does not contain the expected crawler configuration. Review its contents before changing it.');
    return { actions, checked, links: [] as string[] };
  }
  if (!page.contentType.includes('text/html')) {
    add('maintenance', `Unexpected response at ${page.path}`, 'This public page did not return HTML. Review the deployment and routing.');
    return { actions, checked, links: [] as string[] };
  }
  checked.push(`seo:${page.path}`);
  const parsed = inspectMarkup(page.body);
  if (parsed.noindex) add('seo', `Indexing blocked on ${page.path}`, 'This public page contains a noindex directive. Review whether that is intentional; no indexing setting was changed.');
  if (!parsed.h1) add('seo', `Check the page heading on ${page.path}`, 'No H1 was found in the server HTML. Review the page heading and client rendering before changing visible content.');
  const template = SEO_PAGES[page.path as SeoPath];
  if (template && document && document.revision === 0) {
    actions.push(webAction({ scope: 'seo', kind: 'seo_metadata', path: page.path, severity: 'attention', title: `Review search preview: ${page.path}`,
      detail: 'Publish the exact title, description and canonical URL below. Social previews use the same text. Visible page content, prices and URLs stay as they are.',
      snapshot: { revision: document.revision, before: { title: parsed.title, description: parsed.description, canonical: parsed.canonical }, after: { title: template.title, description: template.description, canonical: SITE_ORIGIN + page.path } } }));
  } else {
    if (!parsed.title || !parsed.description) add('seo', `Missing search text on ${page.path}`, 'The server HTML is missing a page title or meta description. Review the metadata implementation.');
    if (parsed.canonical !== SITE_ORIGIN + page.path) add('seo', `Review canonical URL on ${page.path}`, 'The canonical URL is missing or points elsewhere. Review the preferred public URL before changing it.', { observed: parsed.canonical, expected: SITE_ORIGIN + page.path });
    if (document?.title && (parsed.title !== document.title || parsed.description !== document.description)) add('seo', `Approved metadata is not visible on ${page.path}`, 'The public response differs from your approved title or description. Check deployment and caching before making another change.');
  }
  if (page.path.startsWith('/cards/') && !parsed.productSchema) add('seo', `Product search data: ${page.path}`, 'No Product JSON-LD was found. A code change can add structured data from verified listing details. Review that change before deployment; no claims or product data were invented.');
  return { actions, checked, links: parsed.links };
}

// Never crawl arbitrary URLs, payment/auth/admin routes, query strings, or external hosts.
export function safeAuditPath(input: string, products: Set<string>): string | null {
  try {
    const url = new URL(input, SITE_ORIGIN);
    if (url.origin !== SITE_ORIGIN || url.username || url.password || url.search || url.hash) return null;
    return Object.hasOwn(SEO_PAGES, url.pathname) || products.has(url.pathname) || ['/robots.txt','/sitemap.xml','/favicon.png','/apple-touch-icon.png','/brand-share.png','/site.webmanifest'].includes(url.pathname) || /^\/images\/[a-zA-Z0-9_/-]+\.(png|jpg|jpeg|webp|svg)$/i.test(url.pathname) ? url.pathname : null;
  } catch { return null; }
}
