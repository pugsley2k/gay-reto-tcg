// route.ts

import { NextResponse } from "next/server";


export const runtime = "nodejs"; // <-- Add this line

// This is the full, simplified route handler.
// You can replace the entire content of your route.ts with this.
export async function GET() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Card?select=set`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
    // Optional: Add caching to speed up subsequent requests
    next: { revalidate: 3600 }, // Re-fetch every hour
  });

  if (!res.ok) {
    console.error("❌ Failed to fetch sets from Supabase:", await res.text());
    return NextResponse.json({ error: "Failed to fetch sets" }, { status: 500 });
  }

  const rows = (await res.json()) as { set: string }[];

  // Get unique, non-empty set names
  const allSets = Array.from(new Set(rows.map((r) => r.set).filter(Boolean)));

  // Format for the dropdown, using the name for both value and label
  const options = allSets
    .map((setName) => ({
      value: setName,
      label: setName,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)); // Sort alphabetically

  console.log("✅ Final options returned:", options);

  return NextResponse.json({ sets: options });
}