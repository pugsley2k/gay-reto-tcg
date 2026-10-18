import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SEO_PAGES, SITE_ORIGIN } from '@/lib/seo-pages';
import { EXAMPLE_CARD_ID } from '@/lib/example-listing';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const urls: MetadataRoute.Sitemap = Object.keys(SEO_PAGES).map(path => ({ url: SITE_ORIGIN + path }));
  for (let page = 0; page < 20; page++) {
    const { data, error } = await db.from('Card').select('id,updatedAt').or('available.eq.true,sold_at.not.is.null').neq('id', EXAMPLE_CARD_ID).order('id').range(page * 500, page * 500 + 499);
    if (error) throw new Error('Sitemap inventory could not be read.');
    urls.push(...data.map(card => ({ url: `${SITE_ORIGIN}/cards/${encodeURIComponent(card.id)}`, ...(Number.isFinite(Date.parse(card.updatedAt)) ? { lastModified: new Date(card.updatedAt) } : {}) })));
    if (data.length < 500) return urls;
  }
  throw new Error('Sitemap needs pagination before this catalogue can be fully included.');
}
