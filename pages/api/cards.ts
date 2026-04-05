// pages/api/cards.ts
import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

// =================================================================================
// ** ADDED: Debugging logs to check environment variables **
// These logs will appear in your server terminal when the API route is called.
// =================================================================================
console.log('--- Checking Server-Side Environment Variables ---');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Loaded' : 'NOT LOADED');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Loaded' : 'NOT LOADED');
console.log('------------------------------------------------');


// ** UPDATED: Use server-side environment variables **
// These variables do NOT have the NEXT_PUBLIC_ prefix and are only available on the server.
// Make sure you have SUPABASE_URL and SUPABASE_ANON_KEY in your .env.local file.
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or anon key is missing.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // ** UPDATED: Changed table name to 'Card' (case-sensitive) **
    const { error: testError } = await supabase.from('Card').select('id').limit(1);

    if (testError) {
      console.error('Supabase connection test failed:', JSON.stringify(testError, null, 2));
      return res.status(500).json({
        message: "Supabase connection test failed. This is likely an issue with your credentials (URL or anon key) or network policies.",
        details: testError.message,
        source: testError,
      });
    }

    // The form data is in the request body
    const cardData = req.body;

    // Server-side validation
    if (!cardData || typeof cardData !== 'object') {
        return res.status(400).json({ message: "Invalid request body." });
    }
    if (!cardData.name || !cardData.image_url) {
        return res.status(400).json({ message: "Missing required fields: name and image_url are required." });
    }
    if (typeof cardData.price !== 'number' || cardData.price < 0) {
        return res.status(400).json({ message: "Invalid price: Must be a non-negative number." });
    }

    console.log("Connection test passed. Attempting to insert data:", JSON.stringify(cardData, null, 2));

    // ** UPDATED: Changed table name to 'Card' (case-sensitive) **
    const { data, error: insertError } = await supabase
      .from('Card')
      .insert([
        {
          name: cardData.name,
          number: cardData.number,
          set: cardData.set,
          rarity: cardData.rarity,
          price: cardData.price,
          available: cardData.available,
          image_url: cardData.image_url,
          scan_url: cardData.scan_url,
          language: cardData.language,
          holo_type: cardData.holo_type,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Full Supabase insert error object:', JSON.stringify(insertError, null, 2));
      return res.status(400).json({
        message: `Supabase insert error: ${insertError.message}`,
        details: insertError.details,
        code: insertError.code,
        source: insertError,
      });
    }

    return res.status(201).json({ message: 'Card added successfully!', data });

  } catch (err: any) {
    console.error('API route error:', err);
    return res.status(500).json({ message: 'An internal server error occurred.' });
  }
}
