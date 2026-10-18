import type { Metadata } from 'next';
import { serverDb } from './server-db';
import { DEFAULT_DESCRIPTION, SEO_PAGES, SITE_ORIGIN, type SeoPath } from './seo-pages';

// No cached approval state: the next request sees an approved change or rollback.
export async function pageMetadata(path: SeoPath): Promise<Metadata> {
  const fallback = { title: SEO_PAGES[path].currentTitle, description: DEFAULT_DESCRIPTION };
  try {
    const { data, error } = await serverDb().from('web_page_metadata').select('title,description').eq('path', path).single();
    if (error || !data?.title || !data.description) return fallback;
    return { title: data.title, description: data.description, alternates: { canonical: path },
      openGraph: { title: data.title, description: data.description, url: SITE_ORIGIN + path, siteName: 'Gay Retro TCG', type: 'website', images: ['/brand-share.png'] },
      twitter: { card: 'summary', title: data.title, description: data.description, images: ['/brand-share.png'] } };
  } catch { return fallback; }
}
