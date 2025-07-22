// pages/api/image-proxy.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get the image URL from the query parameters
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Image URL is required' });
  }

  try {
    // Fetch the image from the external source
    const imageResponse = await fetch(url);

    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }

    // Get the image data as a buffer
    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Get the original content type (e.g., 'image/png')
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    // Set the correct content-type header and send the image data back to the client
    res.setHeader('Content-Type', contentType);
    res.send(Buffer.from(imageBuffer));

  } catch (error: any) {
    console.error('Image proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy image', details: error.message });
  }
}
