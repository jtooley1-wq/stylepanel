import * as claude from "./claude";
import * as grok from "./grok";
// import * as gemini from "./gemini";  // Disabled - rate limit issues
import * as openai from "./openai";

export const agents = {
  claude: { name: "Style Sage", icon: "✨", ...claude },
  grok: { name: "Vibe Check", icon: "🔥", ...grok },
  // gemini: { name: "Luxe Lens", icon: "💎", ...gemini },
  gpt: { name: "Closet Coach", icon: "👔", ...openai },
};

export type AgentId = keyof typeof agents;
