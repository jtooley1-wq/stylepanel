"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type AgentId = "claude" | "grok" | "gpt";

interface Feedback {
  agent: AgentId;
  name: string;
  body: string;
  isClapback?: boolean;
}

interface AgentStatus {
  status: "waiting" | "active" | "complete" | "error";
  text: string;
}

const agentConfig: Record<AgentId, { name: string; icon: string; color: string; borderColor: string }> = {
  claude: { name: "The Sage", icon: "🪶", color: "text-amber-800", borderColor: "border-amber-700" },
  grok: { name: "The Maverick", icon: "⚡", color: "text-rose-800", borderColor: "border-rose-700" },
  gpt: { name: "The Curator", icon: "📿", color: "text-indigo-800", borderColor: "border-indigo-700" },
};

async function convertHeicToJpeg(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch("/api/preview", { method: "POST", body: formData });
  const data = await response.json();
  return data.preview;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [submittedPreview, setSubmittedPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImagining, setIsImagining] = useState(false);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [transformedVideo, setTransformedVideo] = useState<string | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentId, AgentStatus>>({
    claude: { status: "waiting", text: "Awaiting..." },
    grok: { status: "waiting", text: "Awaiting..." },
    gpt: { status: "waiting", text: "Awaiting..." },
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return;
    
    const processFile = async () => {
      const fileName = file.name.toLowerCase();
      const isHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif');
      
      if (isHeic) {
        setIsLoadingPreview(true);
        try {
          const converted = await convertHeicToJpeg(file);
          setPreview(converted);
        } catch (err) {
          console.error("HEIC conversion failed:", err);
        } finally {
          setIsLoadingPreview(false);
        }
      } else {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
      }
    };
    
    processFile();
  }, [file]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(null);
      setSelectedIndex(null);
      setTransformedVideo(null);
    }
  };

  const resetAgentStatuses = () => {
    setAgentStatuses({
      claude: { status: "waiting", text: "Awaiting..." },
      grok: { status: "waiting", text: "Awaiting..." },
      gpt: { status: "waiting", text: "Awaiting..." },
    });
  };

  const updateAgentStatus = (agent: AgentId, status: AgentStatus["status"], text: string) => {
    setAgentStatuses((prev) => ({ ...prev, [agent]: { status, text } }));
  };

  const handleUpload = async () => {
    if (!file || !preview) return;
    setIsProcessing(true);
    setFeedback([]);
    setSelectedIndex(null);
    setTransformedVideo(null);
    setSubmittedPreview(preview);
    resetAgentStatuses();

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n");
          let event = "", data = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7);
            if (line.startsWith("data: ")) data = line.slice(6);
          }
          if (event && data) {
            const d = JSON.parse(data);
            if (d.agent && !(d.agent in agentConfig)) continue;
            switch (event) {
              case "agent-start":
                updateAgentStatus(d.agent, "active", "Consulting...");
                break;
              case "roast":
                updateAgentStatus(d.agent, "complete", "Complete");
                setFeedback((prev) => [...prev, { agent: d.agent, name: d.name, body: d.body }]);
                break;
              case "clapback-start":
                updateAgentStatus(d.agent, "active", "Reflecting...");
                break;
              case "clapback":
                updateAgentStatus(d.agent, "complete", "Complete");
                setFeedback((prev) => [...prev, { agent: d.agent, name: d.name, body: d.body, isClapback: true }]);
                break;
              case "agent-error":
                updateAgentStatus(d.agent, "error", `Error`);
                break;
            }
          }
        }
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImagine = async () => {
    const selected = initialFeedback[selectedIndex!];
    if (!selected || !submittedPreview) return;
    setIsImagining(true);
    setTransformedVideo(null);
    
    try {
      const response = await fetch("/api/imagine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestion: selected.body,
          imageBase64: submittedPreview.split(",")[1],
        }),
      });
      const data = await response.json();
      if (data.videoUrl) {
        setTransformedVideo(data.videoUrl);
      } else if (data.error) {
        console.error("Imagine error:", data.error);
      }
    } catch (err) {
      console.error("Imagine failed:", err);
    } finally {
      setIsImagining(false);
    }
  };

  const initialFeedback = feedback.filter((f) => !f.isClapback);
  const additionalThoughts = feedback.filter((f) => f.isClapback);

  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-100 via-amber-50/30 to-stone-100">
      <div className="h-2 bg-gradient-to-r from-amber-800 via-amber-600 to-amber-800" />
      
      <div className="max-w-4xl mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-0.5 bg-amber-800/30 self-center" />
            <span className="mx-4 text-amber-800/60 text-2xl">✦</span>
            <div className="w-16 h-0.5 bg-amber-800/30 self-center" />
          </div>
          <h1 className="font-serif text-5xl font-bold mb-3 text-stone-800 tracking-wide">
            Style Panel
          </h1>
          <p className="font-serif text-lg text-stone-600 italic">
            Where Elegance Meets Expertise
          </p>
          <div className="flex justify-center gap-6 mt-8">
            {(Object.entries(agentConfig) as [AgentId, typeof agentConfig.claude][]).map(([id, agent]) => (
              <div 
                key={id} 
                className={`flex items-center gap-2 px-4 py-2 border ${agent.borderColor} bg-white/60 ${agentStatuses[id].status === "active" ? "animate-pulse" : ""}`}
              >
                <span>{agent.icon}</span>
                <span className={`font-serif text-sm ${agent.color}`}>{agent.name}</span>
              </div>
            ))}
          </div>
        </header>

        {/* Upload Section */}
        <Card className="bg-white/70 backdrop-blur border-2 border-amber-800/20 p-8 mb-8 shadow-lg rounded-none">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-800/30 to-transparent" />
            <h2 className="font-serif text-sm uppercase tracking-[0.3em] text-stone-600">Present Your Attire</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-800/30 to-transparent" />
          </div>
          
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed p-12 text-center cursor-pointer transition-all ${file ? "border-amber-700 bg-amber-50/50" : "border-stone-300 hover:border-amber-700 hover:bg-amber-50/30"}`}
          >
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*,.heic,.heif" 
              onChange={handleFileSelect} 
              className="hidden" 
            />
            {isLoadingPreview ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-amber-800/30 border-t-amber-800 rounded-full animate-spin" />
                <p className="font-serif text-stone-600 italic">Converting image...</p>
              </div>
            ) : preview ? (
              <img src={preview} alt="Preview" className="max-h-72 mx-auto shadow-md" />
            ) : file ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-amber-800/30 border-t-amber-800 rounded-full animate-spin" />
                <p className="font-serif text-stone-600 italic">Loading...</p>
              </div>
            ) : (
              <>
                <div className="text-5xl mb-4">👗</div>
                <p className="font-serif text-stone-600">
                  <span className="text-amber-800 font-semibold">Click to select</span> your ensemble
                </p>
              </>
            )}
            {file && preview && <p className="text-amber-800 mt-3 font-serif italic">{file.name}</p>}
          </div>
          
          <Button 
            onClick={handleUpload} 
            disabled={!file || !preview || isProcessing || isLoadingPreview} 
            className="w-full mt-6 bg-amber-800 hover:bg-amber-900 text-amber-50 py-6 text-lg font-serif tracking-wide rounded-none"
          >
            {isProcessing ? "✦ Consultants are deliberating..." : "✦ Request Consultation"}
          </Button>
        </Card>

        {/* Processing Panel */}
        {isProcessing && (
          <Card className="bg-white/70 backdrop-blur border-2 border-amber-800/20 p-8 mb-8 shadow-lg rounded-none">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-6 h-6 border-2 border-amber-800/30 border-t-amber-800 rounded-full animate-spin" />
              <h3 className="font-serif text-lg text-stone-700 italic">The panel convenes...</h3>
            </div>
            <div className="space-y-4">
              {(Object.entries(agentConfig) as [AgentId, typeof agentConfig.claude][]).map(([id, agent]) => (
                <div 
                  key={id} 
                  className={`flex items-center gap-4 p-4 border-l-2 transition-all ${
                    agentStatuses[id].status === "active" 
                      ? `${agent.borderColor} bg-amber-50/50` 
                      : agentStatuses[id].status === "complete" 
                      ? `${agent.borderColor} bg-white/50` 
                      : "border-stone-200 opacity-50"
                  }`}
                >
                  <span className="text-2xl">{agent.icon}</span>
                  <div>
                    <div className={`font-serif font-semibold ${agent.color}`}>{agent.name}</div>
                    <div className="text-sm text-stone-500 italic">{agentStatuses[id].text}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Feedback Display */}
        {initialFeedback.length > 0 && (
          <Card className="bg-white/70 backdrop-blur border-2 border-amber-800/20 overflow-hidden shadow-lg rounded-none">
            {submittedPreview && (
              <div className="bg-stone-100 p-6 border-b-2 border-amber-800/20">
                <img src={submittedPreview} alt="Your attire" className="max-h-96 mx-auto shadow-md" />
              </div>
            )}
            
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-800/30 to-transparent" />
                <h3 className="font-serif text-sm uppercase tracking-[0.3em] text-stone-600">The Panel&apos;s Counsel</h3>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-800/30 to-transparent" />
              </div>
              
              <p className="text-center text-stone-500 italic mb-6 font-serif text-sm">
                Select a recommendation to see yourself transformed
              </p>
              
              <div className="space-y-4">
                {initialFeedback.map((f, i) => {
                  const isSelected = selectedIndex === i;
                  return (
                    <div 
                      key={i} 
                      onClick={() => setSelectedIndex(i)}
                      className={`p-5 border-l-4 cursor-pointer transition-all hover:bg-amber-50/70 ${agentConfig[f.agent]?.borderColor || "border-stone-400"} ${
                        isSelected 
                          ? "bg-amber-100/80 ring-2 ring-amber-600" 
                          : "bg-white/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{agentConfig[f.agent]?.icon}</span>
                        <span className={`font-serif font-semibold ${agentConfig[f.agent]?.color || "text-stone-600"}`}>
                          {agentConfig[f.agent]?.name}
                        </span>
                        {isSelected && (
                          <span className="ml-auto bg-amber-800 text-amber-50 text-xs px-3 py-1 font-serif">✓ SELECTED</span>
                        )}
                      </div>
                      <p className="text-stone-700 leading-relaxed font-serif">{f.body}</p>
                    </div>
                  );
                })}
              </div>
              
              {selectedIndex !== null && (
                <Button 
                  onClick={handleImagine}
                  disabled={isImagining}
                  className="w-full mt-6 bg-stone-800 hover:bg-stone-900 text-stone-50 py-6 text-lg font-serif tracking-wide rounded-none"
                >
                  {isImagining ? "✦ Creating your transformation... (this may take a minute)" : "✦ Bring This Look to Life"}
                </Button>
              )}
              
              {transformedVideo && (
                <div className="mt-8 pt-8 border-t-2 border-amber-800/20">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-800/30 to-transparent" />
                    <h3 className="font-serif text-sm uppercase tracking-[0.3em] text-stone-600">Your Transformation</h3>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-800/30 to-transparent" />
                  </div>
                  <video 
                    src={transformedVideo} 
                    controls 
                    autoPlay 
                    loop
                    className="max-h-[500px] mx-auto shadow-lg rounded"
                  />
                </div>
              )}

              {additionalThoughts.length > 0 && (
                <>
                  <div className="flex items-center gap-3 my-8">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-800/30 to-transparent" />
                    <h3 className="font-serif text-sm uppercase tracking-[0.3em] text-stone-600">Further Reflections</h3>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-800/30 to-transparent" />
                  </div>
                  <div className="space-y-4 ml-4">
                    {additionalThoughts.map((f, i) => (
                      <div 
                        key={i} 
                        className={`p-4 border-l-2 bg-stone-50/50 ${agentConfig[f.agent]?.borderColor || "border-stone-400"}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span>{agentConfig[f.agent]?.icon}</span>
                          <span className={`font-serif font-semibold text-sm ${agentConfig[f.agent]?.color || "text-stone-600"}`}>
                            {agentConfig[f.agent]?.name}
                          </span>
                        </div>
                        <p className="text-stone-600 leading-relaxed font-serif text-sm">{f.body}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>
        )}
        
        <div className="flex justify-center mt-12">
          <div className="w-16 h-0.5 bg-amber-800/30 self-center" />
          <span className="mx-4 text-amber-800/40 text-xl">✦</span>
          <div className="w-16 h-0.5 bg-amber-800/30 self-center" />
        </div>
      </div>
    </main>
  );
}
