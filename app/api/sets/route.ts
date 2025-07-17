import { NextResponse } from "next/server";

function normalizeSetName(set: string): string {
  if (!set) return "";
  let s = set.trim().toUpperCase().replace(/\s+/g, "");

  // Normalize common formats (e.g., SV1 -> SV01, SV 1a -> SV01A)
  s = s.replace(/^SV(\d)$/, (_, d) => `SV0${d}`);
  s = s.replace(/^SV(\d)([A-Z])$/, (_, d, l) => `SV0${d}${l}`);
  return s;
}

export async function GET() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Card?select=set`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      },
    }
  );

  if (!res.ok) {
    console.error("❌ Failed to fetch sets from Supabase:", await res.text());
    return NextResponse.json({ error: "Failed to fetch sets" }, { status: 500 });
  }

  const rows = await res.json();

  const cleanedSets = Array.from(
    new Set(
      rows
        .map((row: any) => normalizeSetName(row.set))
        .filter(Boolean)
    )
  ).sort();

  return NextResponse.json({ sets: cleanedSets });
}
