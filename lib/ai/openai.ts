import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function getRoast(base64Image: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        { type: "text", text: 'You are Closet Coach — a friendly, supportive personal stylist who makes everyone feel great about their fashion choices. You see the potential in every outfit! Highlight what\'s working — the smart choices, the flattering elements, the personality shining through. Be warm, relatable, and encouraging. Share one easy tip to build on their success. Start with "👔 CLOSET COACH:" and deliver 2-3 sentences of supportive guidance.' },
      ],
    }],
  });
  return response.choices[0].message.content || "";
}

export async function getClapback(summary: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: `You are Closet Coach. Other stylists gave feedback:\n\n${summary}\n\nAdd a friendly, practical thought that supports what someone else said. 1-2 sentences. Start with their name.` }],
  });
  return "💬 " + (response.choices[0].message.content || "");
}
