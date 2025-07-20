import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// --- CONFIGURATION ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --- CONSTANTS for VALID DATA ---
const VALID_RARITIES = [
    'Common', 'Uncommon', 'Rare', 'Double Rare', 'Ultra Rare', 
    'Illustration Rare', 'Special Illustration Rare', 'Hyper Rare', 'Promo', 'N/A'
];

const VALID_FINISHES = [
    'EX Holo', 'Full Art', 'GX Holo', 'Holo', 'Non-Holo', 'Normal', 
    'Reverse Holo', 'Textured Holo', 'Unknown', 'VMAX Holo', 'VSTAR Holo'
];


// ==================================================================
// --- RARITY CORRECTION FUNCTIONS ---
// ==================================================================

async function fetchIncorrectRarityCards() {
  console.log("🔎 Searching for cards with incorrect or missing rarity values...");
  
  // Updated query to find cards where rarity is NOT in the valid list OR is NULL
  const { data, error } = await supabase
    .from("Card")
    .select("id, image_url, rarity")
    .or(`rarity.not.in.(${VALID_RARITIES.map(r => `'${r}'`).join(',')}),rarity.is.null`);

  if (error) {
    console.error("❌ Supabase fetch error (Rarity):", error);
    return [];
  }
  
  console.log(`Found ${data.length} cards with incorrect rarities.`);
  return data;
}

async function getCorrectRarityFromImage(imageUrl: string): Promise<string | null> {
  if (!imageUrl) {
    console.warn("⚠️ Skipping card with no image URL.");
    return null;
  }
  const prompt = `
    You are a Pokémon TCG expert. Your only job is to identify the rarity of the card in the image based on the symbol at the bottom (●, ◆, ★, etc.).
    - The rarity MUST be one of: ${VALID_RARITIES.join(', ')}.
    - If no symbol is visible or it's unclear, return 'N/A'.
    - **Do not base your answer on the card's shininess or finish.** Focus only on the rarity symbol.
    Return a single JSON object with one key: {"rarity": "TheRarity"}.
  `.trim();

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrl } }] }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    const parsed = JSON.parse(result.choices[0].message.content?.trim() || "{}");
    return parsed.rarity && VALID_RARITIES.includes(parsed.rarity) ? parsed.rarity : null;
  } catch (err) {
    console.error("❌ OpenAI error or JSON parse fail (Rarity):", err);
    return null;
  }
}

async function updateCardRarity(id: number, oldRarity: string, newRarity: string) {
  if (oldRarity === newRarity) return;
  const { error } = await supabase.from("Card").update({ rarity: newRarity }).eq("id", id);
  if (error) {
    console.error(`❌ Failed to update rarity for card ${id}:`, error);
  } else {
    console.log(`✅ Updated card ${id}: Rarity changed from '${oldRarity || 'NULL'}' → '${newRarity}'`);
  }
}


// ==================================================================
// --- FINISH CORRECTION FUNCTIONS ---
// ==================================================================

async function fetchIncorrectFinishCards() {
    console.log("🔎 Searching for cards with incorrect or missing finish values...");

    // Updated query to find cards where finish is NOT in the valid list OR is NULL
    const { data, error } = await supabase
      .from("Card")
      .select("id, image_url, finish")
      .or(`finish.not.in.(${VALID_FINISHES.map(f => `'${f}'`).join(',')}),finish.is.null`);
  
    if (error) {
      console.error("❌ Supabase fetch error (Finish):", error);
      return [];
    }
    
    console.log(`Found ${data.length} cards with incorrect finishes.`);
    return data;
}
  
async function getCorrectFinishFromImage(imageUrl: string): Promise<string | null> {
    if (!imageUrl) {
      console.warn("⚠️ Skipping card with no image URL.");
      return null;
    }
    const prompt = `
      You are a Pokémon TCG expert. Your only job is to identify the finish of the card in the image (e.g., is it holographic, reverse holo, or normal?).
      - The finish MUST be one of these exact values: ${VALID_FINISHES.join(', ')}.
      - **Do not base your answer on the rarity symbol.** Focus only on the card's visual appearance (shine, texture, etc.).
      Return a single JSON object with one key: {"finish": "TheFinish"}.
    `.trim();
  
    try {
      const result = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrl } }] }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });
      const parsed = JSON.parse(result.choices[0].message.content?.trim() || "{}");
      return parsed.finish && VALID_FINISHES.includes(parsed.finish) ? parsed.finish : null;
    } catch (err) {
      console.error("❌ OpenAI error or JSON parse fail (Finish):", err);
      return null;
    }
}
  
async function updateCardFinish(id: number, oldFinish: string, newFinish: string) {
    if (oldFinish === newFinish) return;
    const { error } = await supabase.from("Card").update({ finish: newFinish }).eq("id", id);
    if (error) {
        console.error(`❌ Failed to update finish for card ${id}:`, error);
    } else {
        console.log(`✅ Updated card ${id}: Finish changed from '${oldFinish || 'NULL'}' → '${newFinish}'`);
    }
}


// ==================================================================
// --- MAIN EXECUTION ---
// ==================================================================

async function main() {
  // --- Run Rarity Correction ---
  console.log("\n--- Starting Rarity Correction Script ---");
  const incorrectRarityCards = await fetchIncorrectRarityCards();
  if (incorrectRarityCards.length > 0) {
    for (const card of incorrectRarityCards) {
      console.log(`-------------------------------------------------`);
      console.log(`Processing card ID: ${card.id} (Current Rarity: '${card.rarity || 'NULL'}')`);
      const correctedRarity = await getCorrectRarityFromImage(card.image_url);
      if (correctedRarity) {
        await updateCardRarity(card.id, card.rarity, correctedRarity);
      } else {
        console.log(`- Could not determine correct rarity for card ${card.id}. Skipping.`);
      }
      await new Promise(resolve => setTimeout(resolve, 500)); 
    }
  }
  console.log("🏁 Rarity correction finished.");

  // --- Run Finish Correction ---
  console.log("\n--- Starting Finish Correction Script ---");
  const incorrectFinishCards = await fetchIncorrectFinishCards();
  if (incorrectFinishCards.length > 0) {
    for (const card of incorrectFinishCards) {
        console.log(`-------------------------------------------------`);
        console.log(`Processing card ID: ${card.id} (Current Finish: '${card.finish || 'NULL'}')`);
        const correctedFinish = await getCorrectFinishFromImage(card.image_url);
        if (correctedFinish) {
            await updateCardFinish(card.id, card.finish, correctedFinish);
        } else {
            console.log(`- Could not determine correct finish for card ${card.id}. Skipping.`);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  console.log("🏁 Finish correction finished.");
}

// Run the script
main();
