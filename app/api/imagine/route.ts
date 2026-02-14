import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const grok = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export async function POST(req: NextRequest) {
  try {
    const { suggestion, imageBase64 } = await req.json();
    
    console.log("Received image base64 length:", imageBase64?.length);

    // Create an animation prompt that explicitly preserves the source image
    const promptResponse = await grok.chat.completions.create({
      model: "grok-3",
      messages: [
        {
          role: "user",
          content: `Based on this fashion advice: "${suggestion}"

Create a simple animation prompt (1 sentence) for animating THIS EXACT PHOTO. The animation should show subtle natural movement like the person slightly turning their head, smiling, or adjusting their pose. Do NOT describe changing clothes or appearance - just describe simple animation of the existing image. Example: "Animate this photo with the person slowly turning their head and giving a warm smile." Start with "Animate this photo with..."`,
        },
      ],
    });

    const videoPrompt = promptResponse.choices[0].message.content || "";
    console.log("Video prompt:", videoPrompt);

    const imageUrl = `data:image/jpeg;base64,${imageBase64}`;

    // Start video generation with image-to-video
    const requestBody = {
      model: "grok-imagine-video",
      prompt: videoPrompt,
      image_url: imageUrl,
      duration: 6,
    };

    const startResponse = await fetch("https://api.x.ai/v1/videos/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const startData = await startResponse.json();
    console.log("Start response:", JSON.stringify(startData, null, 2));

    if (startData.error) {
      throw new Error(typeof startData.error === 'string' ? startData.error : JSON.stringify(startData.error));
    }

    if (startData.video?.url) {
      return NextResponse.json({ videoUrl: startData.video.url, prompt: videoPrompt });
    }

    const requestId = startData.request_id;
    
    if (!requestId) {
      throw new Error("No request_id returned");
    }

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 90;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
        headers: {
          "Authorization": `Bearer ${process.env.XAI_API_KEY}`,
        },
      });
      
      const statusData = await statusResponse.json();
      console.log(`Poll attempt ${attempts + 1}:`, statusData.status || "video ready");
      
      if (statusData.status === "done" || statusData.video?.url) {
        const videoUrl = statusData.video?.url;
        if (videoUrl) {
          console.log("Video ready:", videoUrl);
          return NextResponse.json({ videoUrl, prompt: videoPrompt });
        }
      }
      
      if (statusData.status === "expired" || statusData.status === "failed" || statusData.error) {
        throw new Error("Video generation failed: " + JSON.stringify(statusData));
      }
      
      attempts++;
    }

    throw new Error("Video generation timed out");
  } catch (error) {
    console.error("Imagine error:", error);
    return NextResponse.json(
      { error: "Failed to generate video" },
      { status: 500 }
    );
  }
}
