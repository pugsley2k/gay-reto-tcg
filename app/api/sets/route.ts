import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getFullSetNames(dirtySets: string[]): Promise<Record<string, string>> {
  const prompt = `
You are a Pokémon TCG expert. Given a list of raw set codes or partial names, return a cleaned mapping from raw codes to their official English set names. Be smart about handling spacing, capitalization, and abbreviations.

Example:
- SV1a → Scarlet & Violet – Triplet Beat
- sm12a → Sun & Moon – Tag All Stars
- sv02 → Scarlet & Violet – Paldea Evolved

Now, map the following set identifiers:
${dirtySets.map(s => `- ${s}`).join("\n")}

Return the output as JSON object: {"rawCode": "Official Set Name"}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  const text = completion.choices[0].message.content?.trim() || "{}";
  return JSON.parse(text);
}

export async function GET() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Card?select=set`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      },
    }
  );

  if (!res.ok) {
    console.error("❌ Failed to fetch sets from Supabase:", await res.text());
    return NextResponse.json({ error: "Failed to fetch sets" }, { status: 500 });
  }

  const rows = (await res.json()) as { set: string }[];

  const rawSets = Array.from(
    new Set(rows.map((row: any) => row.set).filter(Boolean))
  );

  const fullNameMap = await getFullSetNames(rawSets);

  const options = Object.entries(fullNameMap)
    .map(([raw, name]) => ({ value: raw, label: name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return NextResponse.json({ sets: options });
}
