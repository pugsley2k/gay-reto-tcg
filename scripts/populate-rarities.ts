import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Normalize rarity codes (e.g., trim, uppercase, no spaces)
function normalizeRarity(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

// Fetch known rarities from Supabase
async function fetchKnownRarities(keys: string[]): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("rarities")
    .select("*")
    .in("code", keys);

  if (error) {
    console.error("❌ Supabase fetch error:", error);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of data || []) {
    map[row.code] = row.name;
  }

  console.log("📦 Fetched known rarities:", map);
  return map;
}

// Store new rarity mappings into Supabase
async function storeRarities(map: Record<string, string>) {
  const payload = Object.entries(map).map(([code, name]) => ({ code, name }));
  console.log("💾 Writing rarities to Supabase:", payload);

  const { error } = await supabase.from("rarities").upsert(payload);
  if (error) {
    console.error("❌ Supabase insert error:", error);
  } else {
    console.log("✅ Inserted rarities into Supabase");
  }
}

// Use OpenAI to resolve unknown rarity codes
async function resolveViaOpenAI(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};

  const prompt = `
You are a Pokémon TCG expert. Map these rarity codes to their proper English rarity names. Return a JSON object like:
{ "UC": "Uncommon", "C": "Common", "R": "Rare", ... }

Codes:
${keys.map((r) => `- ${r}`).join("\n")}
  `.trim();

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const raw = result.choices[0].message.content?.trim() || "{}";
    const parsed = JSON.parse(raw);
    console.log("🔮 OpenAI resolved rarities:", parsed);
    return parsed;
  } catch (err) {
    console.error("❌ OpenAI error or parse fail:", err);
    return {};
  }
}

// Update Card table, replacing rarity codes with readable labels
async function applyRarityLabelsToCards(rarityMap: Record<string, string>) {
  for (const [code, label] of Object.entries(rarityMap)) {
    const { error } = await supabase
      .from("Card")
      .update({ rarity: label })
      .eq("rarity", code);

    if (error) {
      console.error(`❌ Failed to update cards with rarity ${code}:`, error);
    } else {
      console.log(`✅ Updated cards with rarity '${code}' → '${label}'`);
    }
  }
}

async function main() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Card?select=rarity`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
  });

  if (!res.ok) {
    console.error("❌ Failed to fetch rarities from Supabase:", await res.text());
    return;
  }

  const rows = (await res.json()) as { rarity: string }[];
  const allKeys = Array.from(
    new Set(rows.map((r) => normalizeRarity(r.rarity)).filter(Boolean))
  );
  console.log("🧠 Normalized rarity keys:", allKeys);

  const known = await fetchKnownRarities(allKeys);
  const unknownKeys = allKeys.filter((key) => !(key in known));

  let aiResults: Record<string, string> = {};
  if (unknownKeys.length > 0) {
    aiResults = await resolveViaOpenAI(unknownKeys);
    await storeRarities(aiResults);
  }

  const fullMap = { ...known, ...aiResults };

  await applyRarityLabelsToCards(fullMap);
  console.log("🏁 Done");
}

main();
