import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth, clerkClient } from '@clerk/nextjs/server';
import { validateListing } from '../../src/lib/card-listing';
import { validClientId, sameListing } from '../../src/lib/listing-retry';
import { isCardEdition } from '../../src/lib/card-edition';
import { isCardCondition } from '../../src/lib/card-condition';
import {verifyCertificate} from '../../src/lib/cert-verification';
import { checkoutOrigin } from '../../src/lib/checkout-session';
import {isCardArtwork} from '../../src/lib/card-artwork';
import {enrichCard,normaliseName} from '../../src/lib/card-catalog';
export const config = {maxDuration:30};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method || '')) {
    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).json({ message: 'Method not allowed.' });
  }
  try {
    const { userId } = getAuth(req);
    if (!userId || (await (await clerkClient()).users.getUser(userId)).publicMetadata.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }
    if (req.method !== 'GET') {
      try { checkoutOrigin(req); } catch { return res.status(403).json({ message: 'Invalid request origin.' }); }
    }
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return res.status(503).json({ message: 'Secure inventory uploads are not configured yet. Add the server-only Supabase key.' });
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    if (req.method === 'GET') {
      const page = Math.max(0, Number(req.query.page) || 0);
      if (!Number.isSafeInteger(page) || page > 10000) return res.status(400).json({ message: 'Invalid page.' });
      const result = await supabase.from('Card').select('id,name,number,set,holo_type,language,price,image_url,available,condition,edition,grading,sold_at').order('id').range(page * 500, page * 500 + 499);
      if (result.error) return res.status(503).json({ message: 'Could not load inventory.' });
      return res.json({ cards: result.data });
    }
    if (req.method === 'DELETE') {
      if (typeof req.body?.id !== 'string') return res.status(400).json({ message: 'A card ID is required.' });
      const result = await supabase.rpc('edit_inventory_card', { p_id: req.body.id, p_updates: {}, p_delete: true });
      if (result.error) return res.status(409).json({ message: inventoryError(result.error.message) });
      return res.json({ message: 'Card deleted.' });
    }
    if (req.method === 'PATCH') {
      const { id, price, image_url, holo_type, condition, edition, available } = req.body ?? {};
      if (typeof id !== 'string' && typeof id !== 'number') return res.status(400).json({ message: 'A card ID is required.' });
      const updates: Record<string, unknown> = {};
      if (available !== undefined) {
        if (typeof available !== 'boolean') return res.status(400).json({ message: 'Invalid availability.' });
        updates.available = available;
      }
      if (edition !== undefined) {
        if (edition !== null && !isCardEdition(edition)) return res.status(400).json({message:'Choose a supported edition.'});
        updates.edition = edition;
      }
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
      const { error } = await supabase.rpc('edit_inventory_card', { p_id: String(id), p_updates: updates, p_delete: false });
      if (error) return res.status(409).json({ message: inventoryError(error.message) });
      return res.status(200).json({ message: 'Card updated.' });
    }
    let listing;
    try { listing = validateListing(req.body); }
    catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid card details.' }); }
    if(listing.grading && listing.available && !isCardArtwork(listing.image_url)) {
      try {
        const [number,total]=String(listing.number||'').split('/');
        const match=await enrichCard({name:listing.name!,number,total,language:listing.language,finish:listing.holo_type,edition:listing.edition},undefined,{artworkOnly:true});
        if(!match.matched||!('image_url' in match)||!isCardArtwork(match.image_url)||!('set' in match)||!listing.set||normaliseName(match.set||'')!==normaliseName(listing.set))throw Error();
        listing={...listing,image_url:match.image_url};
      }catch {return res.status(400).json({message:'No matching catalogue artwork was found for this slab. Choose the matching catalogue card before publishing; your photo and details are still here.'});}
    }
    if(listing.grading&&listing.available){const check=await verifyCertificate(listing.grading,{name:listing.name!,number:listing.number||'',set:listing.set||''});if(check.status==='mismatch')return res.status(400).json({message:check.message});}
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
function inventoryError(message: string) {
  return /reserved for checkout|Sold cards|Card not found/.test(message) ? message : 'Could not change this card. Check for existing orders or stock reservations.';
}
