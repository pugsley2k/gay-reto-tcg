import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "../lib/supabase";


export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

async function fetchKnownSetNames(codes: string[]): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("SetNames")
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
  return map;
}

async function storeSetNames(map: Record<string, string>) {
  const payload = Object.entries(map).map(([code, name]) => ({ code, name }));
  const { error } = await supabase.from("SetNames").upsert(payload);
  if (error) {
    console.error("❌ Supabase insert error:", error);
  }
}

async function resolveViaOpenAI(codes: string[]): Promise<Record<string, string>> {
  const prompt = `
You are a Pokémon TCG expert. Map these set codes to full official English set names. Return JSON like:
{ "CODE": "Set Name" }

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
    return JSON.parse(raw);
  } catch (err) {
    console.error("❌ OpenAI failure:", err);
    return {};
  }
}

export async function GET() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Card?select=set`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch sets" }, { status: 500 });
  }

  const rows = (await res.json()) as { set: string }[];
  const allCodes = Array.from(new Set(rows.map(r => normalizeCode(r.set)).filter(Boolean)));

  const known = await fetchKnownSetNames(allCodes);
  const unknownCodes = allCodes.filter(code => !(code in known));

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

  return NextResponse.json({ sets: options });
}
