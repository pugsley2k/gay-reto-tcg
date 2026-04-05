import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

    // Convert image to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    // Determine media type
    const mimeType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    // Call Claude claude-3-haiku (fast + cheap vision model)
    const message = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: PROMPT,
            },
          ],
        },
      ],
    });

    const raw = (message.content[0].type === 'text' ? message.content[0].text : '').trim();

    // Extract JSON from response (strip any accidental markdown wrapping)
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
