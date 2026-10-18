export const SITE_ORIGIN = 'https://www.gayretrotcg.com';
export const DEFAULT_DESCRIPTION = 'Browse Pokémon singles in English, Japanese and Korean at Gay Retro TCG.';
export const SEO_PAGES = {
  '/': { currentTitle: 'GAY RETRO TCG', title: 'Pokémon Singles | Gay Retro TCG', description: DEFAULT_DESCRIPTION },
  '/shop': { currentTitle: 'GAY RETRO TCG', title: 'Shop Pokémon Cards | Gay Retro TCG', description: 'Explore Pokémon singles at Gay Retro TCG. Browse card listings, photographs, prices and condition details before adding a card to your basket.' },
  '/delivery': { currentTitle: 'Delivery | Gay Retro TCG', title: 'UK Delivery & Postage | Gay Retro TCG', description: 'Read Gay Retro TCG’s UK dispatch times, Royal Mail delivery options and postage information. Your exact delivery charge is shown before payment.' },
  '/returns': { currentTitle: 'Returns | Gay Retro TCG', title: 'Returns & Refunds | Gay Retro TCG', description: 'Find out how to request a return from Gay Retro TCG, contact us about a card and read our cancellation and refund information.' },
  '/contact': { currentTitle: 'Contact | Gay Retro TCG', title: 'Contact Gay Retro TCG | Cards & Orders', description: 'Contact Gay Retro TCG for help with Pokémon cards, orders, delivery or returns. Find our email address and UK correspondence details.' },
} as const;
export type SeoPath = keyof typeof SEO_PAGES;
export type SeoDocument = { path: SeoPath; title: string | null; description: string | null; revision: number };
