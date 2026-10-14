import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth, clerkClient } from '@clerk/nextjs/server';
import { validateListing } from '../../src/lib/card-listing';
import { validClientId, sameListing } from '../../src/lib/listing-retry';
import { isCardCondition } from '../../src/lib/card-condition';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['POST', 'PATCH'].includes(req.method || '')) {
    res.setHeader('Allow', ['POST', 'PATCH']);
    return res.status(405).json({ message: 'Method not allowed.' });
  }
  try {
    const { userId } = getAuth(req);
    if (!userId || (await (await clerkClient()).users.getUser(userId)).publicMetadata.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return res.status(503).json({ message: 'Secure inventory uploads are not configured yet. Add the server-only Supabase key.' });
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    if (req.method === 'PATCH') {
      const { id, price, image_url, holo_type, condition } = req.body ?? {};
      if (typeof id !== 'string' && typeof id !== 'number') return res.status(400).json({ message: 'A card ID is required.' });
      const updates: Record<string, unknown> = {};
      if (condition !== undefined) {
        if (condition !== null && !isCardCondition(condition)) return res.status(400).json({ message: 'Choose a supported card condition.' });
        updates.condition = condition;
      }
      if (price !== undefined) {
        if (!Number.isSafeInteger(price) || price < 0 || price > 10000000) return res.status(400).json({ message: 'Invalid price.' });
        updates.price = price;
      }
      if (image_url !== undefined) {
        if (typeof image_url !== 'string' || !image_url.startsWith('https://') || image_url.length > 2048) return res.status(400).json({ message: 'Invalid image URL.' });
        updates.image_url = image_url;
      }
      if (holo_type !== undefined) {
        if (typeof holo_type !== 'string' || holo_type.length > 100) return res.status(400).json({ message: 'Invalid finish.' });
        updates.holo_type = holo_type;
      }
      if (!Object.keys(updates).length) return res.status(400).json({ message: 'No changes provided.' });
      const { data, error } = await supabase.from('Card').update(updates).eq('id', id).select('id').maybeSingle();
      if (error) return res.status(503).json({ message: 'Could not update the card. Try again.' });
      if (!data) return res.status(404).json({ message: 'Card not found.' });
      return res.status(200).json({ message: 'Card updated.' });
    }
    let listing;
    try { listing = validateListing(req.body); }
    catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid card details.' }); }
    const clientId = req.body.client_id;
    if (clientId !== undefined && !validClientId(clientId)) return res.status(400).json({ message: 'Invalid listing reference.' });
    const { data, error } = await supabase.from('Card').insert(clientId ? { ...listing, id: clientId } : listing).select('id').single();
    if (error?.code === '23505' && clientId) {
      const { data: existing } = await supabase.from('Card').select('*').eq('id', clientId).single();
      if (existing && sameListing(existing, listing)) return res.status(200).json({ message: 'Card already saved.', data: { id: clientId } });
      return res.status(409).json({ message: 'This card was already saved with different details. Check Seller studio before retrying.' });
    }
    if (error) return res.status(503).json({ message: 'Could not save this card. Your details are still here; please try again.' });
    return res.status(201).json({ message: 'Card saved.', data });
  } catch {
    return res.status(500).json({ message: 'Could not complete this request. Please try again.' });
  }
}
