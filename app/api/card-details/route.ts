import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { isCardEdition } from '@/lib/card-edition';
import { enrichCard } from '@/lib/card-catalog';
export const maxDuration = 30;
export async function POST(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const body = await request.json();
    for (const field of ['name', 'number', 'language']) if (typeof body[field] !== 'string' || !body[field] || body[field].length > 200) return NextResponse.json({ error: 'Add a name, card number and language.' }, { status: 400 });
    if (body.catalog_id && (typeof body.catalog_id !== 'string' || !/^[a-zA-Z0-9.\-]+$/.test(body.catalog_id))) return NextResponse.json({ error: 'Invalid catalogue selection.' }, { status: 400 });
    if (body.edition && !isCardEdition(body.edition)) return NextResponse.json({error:'Choose a supported edition.'},{status:400});
    const result = await enrichCard(body, body.catalog_id);
    return NextResponse.json(result);
  } catch { return NextResponse.json({ error: 'Could not look up this card. You can still enter the details manually.' }, { status: 503 }); }
}
