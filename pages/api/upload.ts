import type { NextApiRequest, NextApiResponse } from 'next';
import { v2 as cloudinary } from 'cloudinary';
import formidable, { File as FormidableFile } from 'formidable'; // Import File type
import fs from 'fs';
import { getAuth, clerkClient } from '@clerk/nextjs/server';

// Configure Cloudinary - ENSURE THESE ARE CORRECT IN YOUR .env.local
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req);
  if (!userId || (await (await clerkClient()).users.getUser(userId)).publicMetadata.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('Cloudinary credentials are not set in environment variables.');
    return res.status(500).json({ error: 'Server configuration error: Cloudinary credentials missing.' });
  }

  const form = formidable({ maxFileSize: 4 * 1024 * 1024, maxFiles: 1,
    filter: part => ['image/jpeg', 'image/png', 'image/webp'].includes(part.mimetype || '') });

  try {
    const [fields, files] = await form.parse(req);

    const fileArray = files.file;

    if (!fileArray || fileArray.length === 0) {
      console.log('No file uploaded by formidable.');
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const uploadedFile = fileArray[0] as FormidableFile; // Assert type here

    if (!uploadedFile || !uploadedFile.filepath) {
      console.log('File path is missing after formidable parsing.');
      return res.status(400).json({ error: 'File path is missing after parsing.' });
    }

    // Log details of the parsed file
    console.log('File parsed by formidable:', {
      filepath: uploadedFile.filepath,
      originalFilename: uploadedFile.originalFilename,
      newFilename: uploadedFile.newFilename,
      mimetype: uploadedFile.mimetype,
      size: uploadedFile.size,
    });

    // Check if file size is 0, which might indicate an issue
    if (uploadedFile.size === 0) {
      console.error('Parsed file size is 0. Original filename:', uploadedFile.originalFilename);
      return res.status(400).json({ error: 'Uploaded file is empty or corrupt.' });
    }

    // Upload the file from its temporary path to Cloudinary
    const result = await cloudinary.uploader.upload(uploadedFile.filepath, {
      folder: 'gay-reto-tcg/cards',
      // resource_type: "image" // Cloudinary usually auto-detects, but can be explicit
    });

    console.log('Cloudinary Upload Result:', result);
    return res.status(200).json({ url: result.secure_url, public_id: result.public_id });

  } catch (error: any) {
    console.error('--- Full Upload Error Stack ---');
    console.error(error); // Log the full error object for more details
    console.error('--- End of Full Error Stack ---');

    let errorMessage = 'Upload failed due to an unexpected error.';
    let statusCode = 500;

    if (error.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    // Specifically check for Cloudinary's http_code or general error structure
    if (error.http_code) { // This is what Cloudinary often returns for its errors
      statusCode = error.http_code;
      // If it's a 400 from Cloudinary saying "Invalid image file", we pass that along.
    }
    
    // Ensure a response is always sent
    return res.status(statusCode).json({ error: errorMessage, details: error });
  }
}

