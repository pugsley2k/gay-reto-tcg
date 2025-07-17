import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --- Helpers ---
function normalizeFinish(input: string): string {
  return input?.trim().toUpperCase().replace(/\s+/g, "") || "";
}

async function fetchKnownFinishes(keys: string[]): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("finishes").select("*").in("code", keys);
  if (error) {
    console.error("❌ Supabase fetch error:", error);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of data || []) {
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

async function resolveFinishesViaOpenAI(cards: { id: number; name: string }[]): Promise<Record<number, string>> {
  if (cards.length === 0) return {};

  const prompt = `
You are a Pokémon TCG expert. For each of the following card names, identify their finish type (e.g., "Holo", "Reverse Holo", "Non-Holo"). Return a JSON object where the key is the card name and the value is the finish:

Example:
{ "Pikachu (Base Set)": "Non-Holo", "Charizard (Holo Rare)": "Holo" }

Cards:
${cards.map((c) => `- ${c.name}`).join("\n")}
  `.trim();

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const raw = result.choices[0].message.content?.trim() || "{}";
    const parsed = JSON.parse(raw);

    const mapped: Record<number, string> = {};
    for (const card of cards) {
      if (parsed[card.name]) {
        mapped[card.id] = parsed[card.name];
      }
    }

    console.log("🔮 OpenAI resolved finishes:", mapped);
    return mapped;
  } catch (err) {
    console.error("❌ OpenAI error or parse fail:", err);
    return {};
  }
}

async function main() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Card?select=id,name,finish`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
  });

  if (!res.ok) {
    console.error("❌ Failed to fetch cards:", await res.text());
    return;
  }

  const allCards = (await res.json()) as { id: number; name: string; finish: string | null }[];
  const cardsToUpdate = allCards.filter((c) => !c.finish || c.finish.trim() === "");

  console.log(`🧠 Found ${cardsToUpdate.length} cards missing finish`);

  const resolved = await resolveFinishesViaOpenAI(cardsToUpdate);
  const finishLabels = Array.from(new Set(Object.values(resolved)));

  const normalized: Record<string, string> = {};
  for (const label of finishLabels) {
    const norm = normalizeFinish(label);
    normalized[norm] = label;
  }

  await storeFinishes(normalized);

  for (const [id, label] of Object.entries(resolved)) {
    const { error } = await supabase.from("Card").update({ finish: label }).eq("id", id);
    if (error) {
      console.error(`❌ Failed to update card ${id}:`, error);
    } else {
      console.log(`✅ Updated card ${id} with finish '${label}'`);
    }
  }

  console.log("🏁 Done.");
}

main();
