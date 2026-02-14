import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import convert from "heic-convert";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    // Convert HEIC to JPEG if needed
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".heic") || fileName.endsWith(".heif")) {
      const outputBuffer = await convert({
        buffer: buffer,
        format: "JPEG",
        quality: 0.85,
      });
      buffer = Buffer.from(outputBuffer);
    }

    // Resize for preview
    const previewBuffer = await sharp(buffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const base64 = previewBuffer.toString("base64");
    const preview = `data:image/jpeg;base64,${base64}`;

    return NextResponse.json({ preview });
  } catch (error) {
    console.error("Preview error:", error);
    return NextResponse.json({ error: "Failed to process image" }, { status: 500 });
  }
}
