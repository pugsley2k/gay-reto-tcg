import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

// --- SETUP ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// --- Normalizer ---
function normalizeCode(input: string): string | null {
  const raw = input.trim();

  // Skip already verbose names
  if (raw.length > 10 && /\s/.test(raw)) return null;

  return raw.toUpperCase().replace(/\s+/g, "");
}

// --- Main Function ---
async function run() {
  console.log("🔄 Fetching all card sets...");
  const { data: cards, error } = await supabase.from("Card").select("id,set");

  if (error || !cards) {
    console.error("❌ Failed to fetch cards:", error);
    return;
  }

  const codeToIds: Record<string, string[]> = {};
  const longNameIds: { id: string; set: string }[] = [];

  for (const card of cards) {
    const norm = normalizeCode(card.set);
    if (!norm) {
      longNameIds.push({ id: card.id, set: card.set }); // already resolved
      continue;
    }
    if (!codeToIds[norm]) codeToIds[norm] = [];
    codeToIds[norm].push(card.id);
  }

  const codes = Object.keys(codeToIds);
  console.log("🧠 Unique short codes found:", codes);

  // Ask OpenAI to resolve them
  const prompt = `
You are a Pokémon TCG expert. Map these set codes to full official English set names. Return valid JSON:
{ "SV3": "Scarlet & Violet — Obsidian Flames", ... }

Codes:
${codes.map((c) => `- ${c}`).join("\n")}
  `.trim();

  let resolved: Record<string, string> = {};
  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4",
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    resolved = JSON.parse(result.choices[0].message.content || "{}");
    console.log("🔮 OpenAI resolved sets:", resolved);
  } catch (e) {
    console.error("❌ Failed to get OpenAI results or parse JSON:", e);
    return;
  }

  // Build full update map: id → full name
  const updates: { id: string; set: string }[] = [];

  for (const [code, name] of Object.entries(resolved)) {
    for (const id of codeToIds[code]) {
      updates.push({ id, set: name });
    }
  }

  console.log(`💾 Updating ${updates.length} cards in Card table...`);
  for (const { id, set } of updates) {
    const { error } = await supabase.from("Card").update({ set }).eq("id", id);
    if (error) console.error(`❌ Failed to update card ${id}:`, error);
  }

  // Store all mappings in setnames table
  const payload = Object.entries(resolved).map(([code, name]) => ({ code, name }));
  const { error: insertErr } = await supabase.from("setnames").upsert(payload);
  if (insertErr) console.error("❌ Failed to insert setnames:", insertErr);
  else console.log("✅ Stored new setnames.");

  console.log("🎉 Done.");
}

run();
