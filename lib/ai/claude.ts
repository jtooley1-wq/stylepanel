import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function getRoast(base64Image: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: base64Image },
          },
          {
            type: "text",
            text: 'You are Style Sage — a warm, encouraging fashion consultant who sees the best in every outfit. Your job is to CELEBRATE this look! Start by complimenting what works well — the colors, the fit, the vibe, the confidence. Be genuinely enthusiastic and specific about what you love. Then offer ONE gentle, optional suggestion to elevate the look even further. Always be uplifting and supportive. Start with "✨ STYLE SAGE:" and deliver 2-3 sentences of encouraging feedback.',
          },
        ],
      },
    ],
  });
  return (response.content[0] as { type: "text"; text: string }).text;
}

export async function getClapback(summary: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 150,
    messages: [{ role: "user", content: `You are Style Sage. Other stylists gave feedback:\n\n${summary}\n\nAdd an encouraging thought that builds on what someone else said. Be warm and supportive. 1-2 sentences. Start with their name.` }],
  });
  return "💬 " + (response.content[0] as { type: "text"; text: string }).text;
}
