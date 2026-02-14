import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { editedImageUrl } = await req.json();

    console.log("Animating image:", editedImageUrl);

    const videoPrompt = "The person confidently turns to show their outfit from different angles, with a subtle smile. Smooth, elegant motion like a fashion showcase.";

    const videoResult = await fal.subscribe("xai/grok-imagine-video/image-to-video", {
      input: {
        prompt: videoPrompt,
        image_url: editedImageUrl,
        duration: "6",
        resolution: "720p",
      },
      logs: true,
    });

    console.log("Video result:", JSON.stringify(videoResult.data, null, 2));

    const videoUrl = videoResult.data?.video?.url;

    if (!videoUrl) {
      throw new Error("No video URL in response");
    }

    return NextResponse.json({ videoUrl });
  } catch (error) {
    console.error("Animate error:", error);
    return NextResponse.json(
      { error: "Failed to animate image" },
      { status: 500 }
    );
  }
}
