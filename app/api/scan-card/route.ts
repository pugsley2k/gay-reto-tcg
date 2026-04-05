import { NextRequest, NextResponse } from 'next/server';

const PROMPT = `You are a Pokémon card expert fluent in English, Japanese, and Korean. Carefully examine this card image.

Return ONLY a raw JSON object with no markdown, no code blocks, no explanation. Example format:
{"name":"Charizard ex","original_name":"リザードンex","card_number":"125","card_total":"197","language":"Japanese"}

Rules:
- "name": ALWAYS the English Pokémon/card name, even if the card is in another language. Translate from Japanese or Korean if needed. Examples: ピカチュウ→Pikachu, 리자몽→Charizard, リザードンex→Charizard ex, 뮤츠→Mewtwo
- "original_name": the name exactly as printed on the card (may be Japanese kanji/katakana or Korean hangul). If English, same as "name".
- "card_number" and "card_total": look very carefully at the BOTTOM of the card for a number like "035/108" or "25/165". Strip leading zeros from card_number. Read each digit individually — common mistakes: 3↔2, 0↔6, 1↔7. Return null if not confident.
- "language": exactly one of "English", "Japanese", or "Korean" based on the card's text/script. Japanese uses kanji/katakana/hiragana. Korean uses hangul (박, 피카츄 etc).
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
      signal: AbortSignal.timeout(8000),
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
      original_name: parsed.original_name ?? parsed.name ?? null,
      japanese_name: parsed.language === 'Japanese' ? (parsed.original_name ?? null) : null,
      card_number: parsed.card_number ? String(parsed.card_number).replace(/^0+/, '') : null,
      card_total: parsed.card_total ? String(parsed.card_total) : null,
      language: parsed.language ?? null,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
