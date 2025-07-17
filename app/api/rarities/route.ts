// app/api/rarities/route.ts
import { NextResponse } from "next/server";

// Force Node.js runtime to access environment variables
export const runtime = "nodejs";

export async function GET() {
  // Directly fetch distinct rarities from the Card table using Supabase's PostgREST endpoint
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Card?select=rarity`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      // This header tells PostgREST to return only unique rows
      'Accept-Profile': 'public', 
    },
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!res.ok) {
    console.error("❌ Failed to fetch rarities from Supabase:", await res.text());
    return NextResponse.json({ error: "Failed to fetch rarities" }, { status: 500 });
  }

  const rows = (await res.json()) as { rarity: string }[];

  // Get unique, non-empty, and non-null rarity names
  const allRarities = Array.from(new Set(rows.map((r) => r.rarity).filter(Boolean)));

  // Format for the dropdown
  const options = allRarities
    .map((rarityName) => ({
      value: rarityName,
      label: rarityName,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)); // Sort alphabetically

  return NextResponse.json({ rarities: options });
}
