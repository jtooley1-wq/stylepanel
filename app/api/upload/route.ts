import { NextRequest } from "next/server";
import { agents, AgentId } from "@/lib/ai";
import sharp from "sharp";
import convert from "heic-convert";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("image") as File;

  if (!file) {
    return new Response("No image provided", { status: 400 });
  }

  // Convert to buffer
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

  // Resize for API
  const resizedBuffer = await sharp(buffer)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();

  const base64Image = resizedBuffer.toString("base64");

  // Create streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const roasts: { agent: AgentId; name: string; body: string }[] = [];

      // Process each agent sequentially
      for (const [agentId, agent] of Object.entries(agents) as [AgentId, typeof agents.claude][]) {
        send("agent-start", { agent: agentId, name: agent.name });

        try {
          const roast = await agent.getRoast(base64Image);
          roasts.push({ agent: agentId, name: agent.name, body: roast });
          send("roast", { agent: agentId, name: agent.name, body: roast });
        } catch (err) {
          send("agent-error", { agent: agentId, error: (err as Error).message });
        }
      }

      // Generate clapbacks
      if (roasts.length >= 2) {
        send("status", { message: "Generating clapbacks..." });

        const roastSummary = roasts
          .map((r) => `${r.name}: "${r.body}"`)
          .join("\n\n");

        for (const [agentId, agent] of Object.entries(agents) as [AgentId, typeof agents.claude][]) {
          send("clapback-start", { agent: agentId });

          try {
            const clapback = await agent.getClapback(roastSummary);
            send("clapback", { agent: agentId, name: agent.name, body: clapback });
          } catch (err) {
            send("agent-error", { agent: agentId, phase: "clapback", error: (err as Error).message });
          }
        }
      }

      send("complete", {});
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
