import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// Force Node runtime to allow process.env usage
export const runtime = "nodejs";

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --- Helpers ---
function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

async function fetchKnownSetNames(codes: string[]): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("setnames")
    .select("*")
    .in("code", codes);

  if (error) {
    console.error("❌ Supabase fetch error:", error);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of data) {
    map[row.code] = row.name;
  }

  console.log("📦 Fetched known setnames:", map);
  return map;
}

async function storeSetNames(map: Record<string, string>) {
  const payload = Object.entries(map).map(([code, name]) => ({ code, name }));
  console.log("💾 Writing to Supabase:", payload);

  const { error } = await supabase.from("setnames").upsert(payload);
  if (error) {
    console.error("❌ Supabase insert error:", error);
  } else {
    console.log("✅ Inserted set names into Supabase");
  }
}

async function resolveViaOpenAI(codes: string[]): Promise<Record<string, string>> {
  if (codes.length === 0) return {};

  const prompt = `
You are a Pokémon TCG expert. Map these set codes to full official English set names. Return JSON like:
{ "SV01": "Scarlet & Violet – Base Set", ... }

Codes:
${codes.map((c) => `- ${c}`).join("\n")}
  `.trim();

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const raw = result.choices[0].message.content?.trim() || "{}";
    const parsed = JSON.parse(raw);
    console.log("🔮 OpenAI resolved set names:", parsed);
    return parsed;
  } catch (err) {
    console.error("❌ OpenAI error or parse fail:", err);
    return {};
  }
}

// --- Route Handler ---
export async function GET() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Card?select=set`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
  });

  if (!res.ok) {
    const msg = await res.text();
    console.error("❌ Failed to fetch sets from Supabase:", msg);
    return NextResponse.json({ error: "Failed to fetch sets" }, { status: 500 });
  }

  const rows = (await res.json()) as { set: string }[];
  console.log("🧠 RAW Supabase rows:", rows);

  const allCodes = Array.from(
    new Set(rows.map((r) => normalizeCode(r.set)).filter(Boolean))
  );
  console.log("🧠 Normalized codes:", allCodes);

  const known = await fetchKnownSetNames(allCodes);
  const unknownCodes = allCodes.filter((code) => !(code in known));

  let aiResults: Record<string, string> = {};
  if (unknownCodes.length > 0) {
    aiResults = await resolveViaOpenAI(unknownCodes);
    await storeSetNames(aiResults);
  }

  const fullMap = { ...known, ...aiResults };

  // Deduplicate by label
  const labelToCode = new Map<string, string>();
  for (const [code, label] of Object.entries(fullMap)) {
    const normLabel = label.trim();
    if (!labelToCode.has(normLabel)) {
      labelToCode.set(normLabel, code);
    }
  }

  const options = Array.from(labelToCode.entries())
    .map(([label, value]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  console.log("✅ Final options returned:", options);

  return NextResponse.json({ sets: options });
}
