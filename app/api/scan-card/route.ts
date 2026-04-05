import { NextRequest, NextResponse } from 'next/server';

const PROMPT = `You are a Pokémon card expert. Carefully examine this card image and extract the following information.

Return ONLY a raw JSON object with no markdown, no code blocks, no explanation. Example format:
{"name":"Pikachu","card_number":"35","card_total":"108","language":"English"}

Rules:
- "name" must be the English Pokémon or card name (translate if Japanese)
- "card_number" and "card_total": look very carefully at the BOTTOM of the card for a small number like "035/108" or "25/165". The number BEFORE the slash is card_number (strip leading zeros), the number AFTER the slash is card_total. Read each digit individually and do not guess — common mistakes are confusing 3 and 2, 0 and 6, 1 and 7. If you are not confident, return null.
- "language" must be exactly "Japanese" if the card text is in Japanese, or "English" if in English
- Do not include any text outside the JSON object`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = (file.type || 'image/jpeg') as string;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `OpenAI error: ${text}` }, { status: 500 });
    }

    const data = await response.json();
    const raw = (data.choices?.[0]?.message?.content ?? '').trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: `Could not parse response: ${raw}` }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      english_name: parsed.name ?? null,
      japanese_name: null,
      card_number: parsed.card_number ? String(parsed.card_number).replace(/^0+/, '') : null,
      card_total: parsed.card_total ? String(parsed.card_total) : null,
      language: parsed.language ?? null,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
