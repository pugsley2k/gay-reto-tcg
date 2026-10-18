import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/seo-pages';
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/cart', '/success', '/debug', '/sign-in', '/sign-up'] }, sitemap: `${SITE_ORIGIN}/sitemap.xml` };
}
