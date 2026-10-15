import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildShopFilters, type FilterCard } from '@/lib/shop-filters';

export const dynamic = 'force-dynamic';
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Filters unavailable.' }, { status: 503 });
  const client = createClient(url, key);
  const rows: FilterCard[] = [];
  try {
    // Stable pagination avoids silently losing options after the Data API row limit.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client.from('Card').select('set,rarity,holo_type,language,condition,edition').eq('available', true).order('id').range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return NextResponse.json(buildShopFilters(rows), { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } });
  } catch {
    return NextResponse.json({ error: 'Filters unavailable. You can still search by name.' }, { status: 503 });
  }
}
