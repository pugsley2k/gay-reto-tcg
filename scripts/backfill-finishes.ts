import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --- Step 1: Get list of valid finish codes ---
async function getValidFinishCodes(): Promise<string[]> {
  const { data, error } = await supabase.from("finishes").select("code");
  if (error || !data) {
    console.error("❌ Failed to fetch finish codes:", error);
    return [];
  }
  return data.map((row) => row.code);
}

// --- Step 2: Fetch cards missing a finish ---
async function getCardsNeedingFinish() {
  const { data, error } = await supabase
    .from("Card")
    .select("id, name, rarity, holo_type, image_url, scan_url")
    .is("finish", null);

  if (error) {
    console.error("❌ Failed to fetch cards needing finishes:", error);
    return [];
  }

  return data;
}

// --- Step 3: Ask OpenAI for a finish code ---
async function getFinishFromAI(card: any, validCodes: string[]): Promise<string | null> {
  const prompt = `
You are a Pokémon TCG expert. Given the details of a card, identify the type of finish (card style).

Only return one of the following valid finish codes exactly:
${validCodes.map((f) => `- ${f}`).join("\n")}

Card:
Name: ${card.name}
Rarity: ${card.rarity}
Holo Type: ${card.holo_type || "(none)"}

Finish Code:`.trim();

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const finish = result.choices[0].message.content?.trim();
    if (validCodes.includes(finish!)) {
      return finish!;
    }

    console.warn(`⚠️ Finish code "${finish}" not recognized.`);
    return null;
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    return null;
  }
}

// --- Step 4: Update the Card row ---
async function updateCardFinish(cardId: number, finish: string) {
  const { error } = await supabase.from("Card").update({ finish }).eq("id", cardId);
  if (error) {
    console.error(`❌ Failed to update Card ID ${cardId}:`, error);
  } else {
    console.log(`✅ Updated Card ID ${cardId} with finish: ${finish}`);
  }
}

// --- Main Runner ---
(async () => {
  const validCodes = await getValidFinishCodes();
  const cards = await getCardsNeedingFinish();

  for (const card of cards) {
    const finish = await getFinishFromAI(card, validCodes);
    if (finish) {
      await updateCardFinish(card.id, finish);
    }
  }

  console.log("🏁 Done populating finishes.");
})();
