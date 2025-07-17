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

function normalizeFinish(input: string | null | undefined): string {
  return (input || "").trim().toUpperCase().replace(/\s+/g, "");
}

async function fetchKnownFinishes(keys: string[]): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("finishes")
    .select("*")
    .in("code", keys);

  if (error) {
    console.error("❌ Supabase fetch error:", error);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of data) {
    map[row.code] = row.name;
  }

  console.log("📦 Fetched known finishes:", map);
  return map;
}

async function storeFinishes(map: Record<string, string>) {
  const payload = Object.entries(map).map(([code, name]) => ({ code, name }));
  console.log("💾 Writing finishes to Supabase:", payload);

  const { error } = await supabase.from("finishes").upsert(payload);
  if (error) {
    console.error("❌ Supabase insert error:", error);
  } else {
    console.log("✅ Inserted finishes into Supabase");
  }
}

async function resolveViaOpenAI(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};

  const prompt = `
You are a Pokémon TCG expert. Map these finish types to their proper display names. Return a JSON object like:
{ "RH": "Reverse Holo", "H": "Holo", "N": "Non-Holo", ... }

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
    console.log("🔮 OpenAI resolved finishes:", parsed);
    return parsed;
  } catch (err) {
    console.error("❌ OpenAI error or parse fail:", err);
    return {};
  }
}

(async () => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Card?select=finish`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
  });

  if (!res.ok) {
    console.error("❌ Failed to fetch finishes from Supabase:", await res.text());
    return;
  }

  const rows = (await res.json()) as { finish: string }[];
  const allKeys = Array.from(
    new Set(rows.map((r) => normalizeFinish(r.finish)).filter(Boolean))
  );
  console.log("🧠 Normalized finish keys:", allKeys);

  const known = await fetchKnownFinishes(allKeys);
  const unknownKeys = allKeys.filter((key) => !(key in known));

  let aiResults: Record<string, string> = {};
  if (unknownKeys.length > 0) {
    aiResults = await resolveViaOpenAI(unknownKeys);
    await storeFinishes(aiResults);
  }

  const fullMap = { ...known, ...aiResults };

// Apply human-readable finish labels to Card table
for (const [code, label] of Object.entries(fullMap)) {
  const { error } = await supabase
    .from("Card")
    .update({ finish: label })
    .eq("finish", code);

  if (error) {
    console.error(`❌ Failed to update cards with finish ${code}:`, error);
  } else {
    console.log(`✅ Updated cards with finish '${code}' → '${label}'`);
  }
}


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

  console.log("✅ Final finish options returned:", options);
})();
