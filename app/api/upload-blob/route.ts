import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, filename } = await req.json();
    
    // Convert base64 to buffer
    const buffer = Buffer.from(imageBase64, 'base64');
    
    // Upload to Vercel Blob
    const blob = await put(filename || 'image.jpg', buffer, {
      access: 'public',
      contentType: 'image/jpeg',
    });
    
    console.log("Uploaded to blob:", blob.url);
    
    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("Blob upload error:", error);
    return NextResponse.json({ error: "Failed to upload" }, { status: 500 });
  }
}
