import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
const staticSetNames: Record<string, string> = {
  // Scarlet & Violet (English & Japanese)
  SV01: "Scarlet & Violet – Base Set",
  SV01S: "Scarlet & Violet – Scarlet ex",
  SV01V: "Scarlet & Violet – Violet ex",
  SV01A: "Scarlet & Violet – Triplet Beat",
  SV02: "Scarlet & Violet – Paldea Evolved",
  SV02P: "Scarlet & Violet – Snow Hazard",
  SV02D: "Scarlet & Violet – Clay Burst",
  SV03: "Scarlet & Violet – Obsidian Flames",
  SV03A: "Scarlet & Violet – Raging Surf",
  SV04: "Scarlet & Violet – Paradox Rift",
  SV04M: "Scarlet & Violet – Ancient Roar",
  SV04P: "Scarlet & Violet – Future Flash",
  SV05: "Scarlet & Violet – Temporal Forces",
  SV05A: "Scarlet & Violet – Wild Force / Cyber Judge",
  SV06: "Scarlet & Violet – Twilight Masquerade",
  SV06A: "Scarlet & Violet – Night Wanderer",
  SVP: "Scarlet & Violet – Promos",

  // Sword & Shield (English & Japanese)
  SWSH01: "Sword & Shield – Base Set",
  S1H: "Sword & Shield – Sword",
  S1W: "Sword & Shield – Shield",
  SWSH02: "Sword & Shield – Rebel Clash",
  S2: "Sword & Shield – Rebellion Crash",
  SWSH03: "Sword & Shield – Darkness Ablaze",
  S3: "Sword & Shield – Infinity Zone",
  SWSH04: "Sword & Shield – Vivid Voltage",
  S4: "Sword & Shield – Amazing Volt Tackle",
  SWSH05: "Sword & Shield – Battle Styles",
  S5I: "Sword & Shield – Single Strike Master",
  S5R: "Sword & Shield – Rapid Strike Master",
  SWSH06: "Sword & Shield – Chilling Reign",
  S6H: "Sword & Shield – Silver Lance",
  S6K: "Sword & Shield – Jet-Black Spirit",
  SWSH07: "Sword & Shield – Evolving Skies",
  S7D: "Sword & Shield – Skyscraping Perfection",
  S7R: "Sword & Shield – Blue Sky Stream",
  SWSH08: "Sword & Shield – Fusion Strike",
  S8: "Sword & Shield – Fusion Arts",
  SWSH09: "Sword & Shield – Brilliant Stars",
  S9: "Sword & Shield – Star Birth",
  SWSH10: "Sword & Shield – Astral Radiance",
  S10D: "Sword & Shield – Time Gazer",
  S10P: "Sword & Shield – Space Juggler",
  SWSH11: "Sword & Shield – Lost Origin",
  S11: "Sword & Shield – Lost Abyss",
  SWSH12: "Sword & Shield – Silver Tempest",
  S12: "Sword & Shield – Paradigm Trigger",
  SWSH12A: "Sword & Shield – VSTAR Universe",
  S12A: "Sword & Shield – VSTAR Universe",
  SWSHP: "Sword & Shield – Promos",

  // Sun & Moon
  SM01: "Sun & Moon – Base Set",
  SM02: "Sun & Moon – Guardians Rising",
  SM03: "Sun & Moon – Burning Shadows",
  SM04: "Sun & Moon – Crimson Invasion",
  SM05: "Sun & Moon – Ultra Prism",
  SM06: "Sun & Moon – Forbidden Light",
  SM07: "Sun & Moon – Celestial Storm",
  SM08: "Sun & Moon – Lost Thunder",
  SM09: "Sun & Moon – Team Up",
  SM10: "Sun & Moon – Unbroken Bonds",
  SM11: "Sun & Moon – Unified Minds",
  SM12: "Sun & Moon – Cosmic Eclipse",
  SM12A: "Sun & Moon – Tag All Stars",
  SMP: "Sun & Moon – Promos",

  // XY Era
  XY01: "XY – Base Set",
  XY02: "XY – Flashfire",
  XY03: "XY – Furious Fists",
  XY04: "XY – Phantom Forces",
  XY05: "XY – Primal Clash",
  XY06: "XY – Roaring Skies",
  XY07: "XY – Ancient Origins",
  XY08: "XY – BREAKthrough",
  XY09: "XY – BREAKpoint",
  XY10: "XY – Fates Collide",
  XY11: "XY – Steam Siege",
  XY12: "XY – Evolutions",
  XYA: "XY – Promos",

  // Black & White
  BW01: "Black & White – Base Set",
  BW02: "Black & White – Emerging Powers",
  BW03: "Black & White – Noble Victories",
  BW04: "Black & White – Next Destinies",
  BW05: "Black & White – Dark Explorers",
  BW06: "Black & White – Dragons Exalted",
  BW07: "Black & White – Boundaries Crossed",
  BW08: "Black & White – Plasma Storm",
  BW09: "Black & White – Plasma Freeze",
  BW10: "Black & White – Plasma Blast",
  BW11: "Black & White – Legendary Treasures",
  BWP: "Black & White – Promos",

  // EX Era
  EX1: "EX – Ruby & Sapphire",
  EX2: "EX – Sandstorm",
  EX3: "EX – Dragon",
  EX4: "EX – Team Magma vs Team Aqua",
  EX5: "EX – Hidden Legends",
  EX6: "EX – FireRed & LeafGreen",
  EX7: "EX – Team Rocket Returns",
  EX8: "EX – Deoxys",
  EX9: "EX – Emerald",
  EX10: "EX – Unseen Forces",
  EX11: "EX – Delta Species",
  EX12: "EX – Legend Maker",
  EX13: "EX – Holon Phantoms",
  EX14: "EX – Crystal Guardians",
  EX15: "EX – Dragon Frontiers",
  EX16: "EX – Power Keepers",

  // Promos & Other
  BASE: "Base Set",
  JUNGLE: "Jungle",
  FOSSIL: "Fossil",
  TR: "Team Rocket",
  GYM1: "Gym Heroes",
  GYM2: "Gym Challenge",
  NEO1: "Neo Genesis",
  NEO2: "Neo Discovery",
  NEO3: "Neo Revelation",
  NEO4: "Neo Destiny",
  E1: "Expedition",
  E2: "Aquapolis",
  E3: "Skyridge",
};



let cachedResult: { value: string; label: string }[] | null = null;

function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

async function getOpenAISetNames(rawCodes: string[]): Promise<Record<string, string>> {
  const prompt = `
You are a Pokémon TCG expert. Map these raw set codes to their official English set names. Be consistent and precise.

Return the result in JSON format: {"rawCode": "Full Set Name"}

Codes:
${rawCodes.map((c) => `- ${c}`).join("\n")}
  `.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const raw = completion.choices[0].message.content?.trim() || "{}";
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.error("❌ OpenAI error or failed to parse response:", err);
    return {};
  }
}

export async function GET() {
  if (cachedResult) {
    return NextResponse.json({ sets: cachedResult });
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Card?select=set`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
  });

  if (!res.ok) {
    console.error("❌ Failed to fetch sets from Supabase:", await res.text());
    return NextResponse.json({ error: "Failed to fetch sets" }, { status: 500 });
  }

  const rows = (await res.json()) as { set: string }[];

  const rawCodes = Array.from(
    new Set(rows.map((row) => normalizeCode(row.set)).filter(Boolean))
  );

  // First resolve all from staticSetNames
  const knownEntries: Record<string, string> = {};
  const unknownCodes: string[] = [];

  for (const code of rawCodes) {
    if (staticSetNames[code]) {
      knownEntries[code] = staticSetNames[code];
    } else {
      unknownCodes.push(code);
    }
  }

  const aiEntries = await getOpenAISetNames(unknownCodes);
  const fullMap = { ...knownEntries, ...aiEntries };

  // Deduplicate based on label
  const unique = new Map<string, string>();
  for (const [code, label] of Object.entries(fullMap)) {
    const normLabel = label.trim();
    if (!unique.has(normLabel)) {
      unique.set(normLabel, code);
    }
  }

  const options = Array.from(unique.entries())
    .map(([label, value]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  cachedResult = options;
  return NextResponse.json({ sets: cachedResult });
}
