import { createClient } from '@supabase/supabase-js';
import FoilHome from '@/components/FoilHome';
import { pageMetadata } from '@/lib/page-metadata';
import { PUBLIC_CARD_FIELDS, type ProductCard } from '@/lib/products';
export const generateMetadata = () => pageMetadata('/');
export const dynamic = 'force-dynamic';
async function getCards() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { cards: [], failed: true };
  try {
    const { data, error } = await createClient(url, key).from('Card').select(PUBLIC_CARD_FIELDS).eq('available', true).order('createdAt', { ascending: false }).limit(8);
    return { cards: (data ?? []) as unknown as ProductCard[], failed: !!error };
  } catch { return { cards: [], failed: true }; }
}
export default async function HomePage() {
  const { cards, failed } = await getCards();
  return <FoilHome cards={cards} failed={failed} />;
}
