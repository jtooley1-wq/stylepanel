import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { put } from '@vercel/blob';

const grok = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export async function POST(req: NextRequest) {
  try {
    const { suggestion, imageBase64 } = await req.json();

    // Upload image to Vercel Blob to get a public URL
    const buffer = Buffer.from(imageBase64, 'base64');
    const blob = await put(`stylepanel-${Date.now()}.jpg`, buffer, {
      access: 'public',
      contentType: 'image/jpeg',
    });
    
    console.log("Image uploaded to:", blob.url);

    // Very simple animation prompt - just describe motion, not content
    const videoPrompt = "Animate this image with subtle natural movement. The person slowly turns their head slightly, blinks naturally, and gives a gentle smile. Camera holds steady.";
    
    console.log("Video prompt:", videoPrompt);

    // Start video generation with the public image URL
    const requestBody = {
      model: "grok-imagine-video",
      prompt: videoPrompt,
      image_url: blob.url,
      duration: 6,
      resolution: "720p",
    };
    
    console.log("Request body:", JSON.stringify({...requestBody, image_url: blob.url.substring(0, 50) + "..."}));

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
      
      if (statusData.status === "done" || statusData.video?.url) {
        const videoUrl = statusData.video?.url;
        if (videoUrl) {
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
