import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import OpenAI from "openai";

fal.config({
  credentials: process.env.FAL_KEY,
});

const grok = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export async function POST(req: NextRequest) {
  try {
    const { suggestion, imageBase64 } = await req.json();

    console.log("Step 1: Creating edit prompt from suggestion...");
    
    const editPromptResponse = await grok.chat.completions.create({
      model: "grok-3",
      messages: [
        {
          role: "user",
          content: `Based on this fashion advice: "${suggestion}"

Create a short, specific image editing instruction (1 sentence) that describes exactly what to change in the photo. Focus on clothing, accessories, or styling changes. Keep the person's face and body the same. Example: "Add a gold bracelet to their wrist and change their top to a navy blazer." Start directly with the edit instruction.`,
        },
      ],
    });

    const editPrompt = editPromptResponse.choices[0].message.content || "";
    console.log("Edit prompt:", editPrompt);

    console.log("Step 2: Editing image with fal.ai...");
    const editResult = await fal.subscribe("xai/grok-imagine-image/edit", {
      input: {
        prompt: editPrompt,
        image_url: `data:image/jpeg;base64,${imageBase64}`,
      },
      logs: true,
    });

    console.log("Edit result:", JSON.stringify(editResult.data, null, 2));
    
    const editedImageUrl = editResult.data?.images?.[0]?.url;
    
    if (!editedImageUrl) {
      throw new Error("No edited image URL in response");
    }

    // Return just the edited image - animation happens in separate call
    return NextResponse.json({ editedImageUrl, editPrompt });

  } catch (error) {
    console.error("Imagine error:", error);
    return NextResponse.json(
      { error: "Failed to edit image" },
      { status: 500 }
    );
  }
}
