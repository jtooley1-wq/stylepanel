import { GoogleGenerativeAI } from "@google/generative-ai";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const gemini = genai.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function getRoast(base64Image: string): Promise<string> {
  const result = await gemini.generateContent([
    { inlineData: { mimeType: "image/jpeg", data: base64Image } },
    { text: 'You are Luxe Lens — a high-fashion stylist who finds elegance in every look. Your role is to make people feel like they belong on a runway! Compliment the sophistication in their choices — the silhouette, the color story, the styling details. Be aspirational but warm. Mention what a fashion editor would love about this look. One elevated suggestion if appropriate. Start with "💎 LUXE LENS:" and deliver 2-3 sentences of fashion-forward praise.' },
  ]);
  return result.response.text();
}

export async function getClapback(summary: string): Promise<string> {
  const result = await gemini.generateContent(`You are Luxe Lens. Other stylists gave feedback:\n\n${summary}\n\nAdd a sophisticated, encouraging observation that builds on someone else's point. 1-2 sentences. Start with their name.`);
  return "💬 " + result.response.text();
}
