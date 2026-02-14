import OpenAI from "openai";

const grok = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export async function getRoast(base64Image: string): Promise<string> {
  const response = await grok.chat.completions.create({
    model: "grok-2-vision-latest",
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        { type: "text", text: 'You are Vibe Check — an enthusiastic, hype-you-up street style expert who LOVES helping people feel confident! Your energy is infectious and positive. Call out what\'s fire about this fit — the pieces that pop, the styling choices that work, the overall energy. Gas them up! Make them feel amazing about their look. Add one fun suggestion if you have it. Start with "🔥 VIBE CHECK:" and deliver 2-3 sentences of pure hype.' },
      ],
    }],
  });
  return response.choices[0].message.content || "";
}

export async function getClapback(summary: string): Promise<string> {
  const response = await grok.chat.completions.create({
    model: "grok-3",
    messages: [{ role: "user", content: `You are Vibe Check. Other stylists gave feedback:\n\n${summary}\n\nAdd more hype! Build on what someone else said with extra enthusiasm. 1-2 sentences. Start with their name.` }],
  });
  return "💬 " + (response.choices[0].message.content || "");
}
