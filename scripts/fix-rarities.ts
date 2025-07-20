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

// This is the list of official, correct rarities.
// Any card with a rarity NOT in this list will be checked.
const VALID_RARITIES = [
    'Common', 'Uncommon', 'Rare', 'Double Rare', 'Ultra Rare', 
    'Illustration Rare', 'Special Illustration Rare', 'Hyper Rare', 'Promo', 'N/A'
];

/**
 * Fetches all cards from the database whose rarity is not in the VALID_RARITIES list.
 * @returns A promise that resolves to an array of cards to be fixed.
 */
async function fetchIncorrectCards() {
  console.log("🔎 Searching for cards with incorrect rarity values...");
  
  // We fetch cards whose rarity is NOT in our list of valid ones.
  const { data, error } = await supabase
    .from("Card")
    .select("id, image_url, rarity")
    .not("rarity", "in", `(${VALID_RARITIES.map(r => `'${r}'`).join(',')})`);

  if (error) {
    console.error("❌ Supabase fetch error:", error);
    return [];
  }
  
  console.log(`Found ${data.length} cards with potentially incorrect rarities.`);
  return data;
}

/**
 * Uses OpenAI's vision model to get the correct rarity for a single card from its image.
 * @param imageUrl The URL of the card image to analyze.
 * @returns A promise that resolves to the corrected rarity string, or null if it fails.
 */
async function getCorrectRarityFromImage(imageUrl: string): Promise<string | null> {
  if (!imageUrl) {
    console.warn("⚠️ Skipping card with no image URL.");
    return null;
  }

  const prompt = `
    You are a Pokémon TCG expert. Your only job is to identify the rarity of the card in the image based on the symbol at the bottom (●, ◆, ★, etc.).
    
    - The rarity MUST be one of: 'Common', 'Uncommon', 'Rare', 'Double Rare', 'Ultra Rare', 'Illustration Rare', 'Special Illustration Rare', 'Hyper Rare', 'Promo'.
    - If no symbol is visible or it's unclear, return 'N/A'.
    - **Do not base your answer on the card's shininess or finish.** Focus only on the rarity symbol.

    Return a single JSON object with one key: {"rarity": "TheRarity"}.
  `.trim();

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o", // Using gpt-4o for speed and efficiency
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const raw = result.choices[0].message.content?.trim() || "{}";
    const parsed = JSON.parse(raw);
    
    if (parsed.rarity && VALID_RARITIES.includes(parsed.rarity)) {
      return parsed.rarity;
    } else {
      console.warn(`⚠️ OpenAI returned an invalid or unexpected rarity: ${parsed.rarity}`);
      return null;
    }

  } catch (err) {
    console.error("❌ OpenAI error or JSON parse fail:", err);
    return null;
  }
}

/**
 * Updates a single card's rarity in the Supabase database.
 * @param id The ID of the card to update.
 * @param oldRarity The original, incorrect rarity.
 * @param newRarity The new, corrected rarity.
 */
async function updateCardRarity(id: number, oldRarity: string, newRarity: string) {
  // No need to update if the value is somehow already correct
  if (oldRarity === newRarity) {
    console.log(`- Rarity for card ${id} is already correct ('${newRarity}'). No update needed.`);
    return;
  }

  const { error } = await supabase
    .from("Card")
    .update({ rarity: newRarity })
    .eq("id", id);

  if (error) {
    console.error(`❌ Failed to update card ${id}:`, error);
  } else {
    console.log(`✅ Updated card ${id}: Rarity changed from '${oldRarity}' → '${newRarity}'`);
  }
}

/**
 * Main function to run the entire correction process.
 */
async function main() {
  console.log("--- Starting Rarity Correction Script ---");
  const incorrectCards = await fetchIncorrectCards();

  if (incorrectCards.length === 0) {
    console.log("🏁 No cards with incorrect rarities found. All done!");
    return;
  }

  for (const card of incorrectCards) {
    console.log(`-------------------------------------------------`);
    console.log(`Processing card ID: ${card.id} (Current Rarity: '${card.rarity}')`);
    
    const correctedRarity = await getCorrectRarityFromImage(card.image_url);

    if (correctedRarity) {
      await updateCardRarity(card.id, card.rarity, correctedRarity);
    } else {
      console.log(`- Could not determine correct rarity for card ${card.id}. Skipping.`);
    }
    
    // Add a small delay to avoid hitting API rate limits too quickly
    await new Promise(resolve => setTimeout(resolve, 500)); 
  }

  console.log("-------------------------------------------------");
  console.log("🏁 Rarity correction script finished.");
}

// Run the script
main();
