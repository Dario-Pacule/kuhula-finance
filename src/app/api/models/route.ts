import { NextResponse } from "next/server";
import type { ModelOption, ProviderId } from "@/lib/ai-providers";

export async function POST(req: Request) {
  try {
    const { provider, apiKey } = await req.json();

    if (!provider) {
      return NextResponse.json({ error: "Provider não fornecido" }, { status: 400 });
    }

    let models: ModelOption[] = [];

    if (provider === "gemini") {
      if (!apiKey) return NextResponse.json({ error: "Chave API necessária" }, { status: 400 });
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!res.ok) throw new Error(`Gemini API Error: ${res.statusText}`);
      const data = await res.json();
      
      models = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: any) => ({
          id: m.name.replace("models/", ""),
          label: m.displayName || m.name.replace("models/", ""),
          free: true // Assumindo free para simplificar na lista dinâmica
        }));
    } 
    else if (provider === "groq") {
      if (!apiKey) return NextResponse.json({ error: "Chave API necessária" }, { status: 400 });
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!res.ok) throw new Error(`Groq API Error: ${res.statusText}`);
      const data = await res.json();
      models = (data.data || []).map((m: any) => ({
        id: m.id,
        label: m.id,
        free: true
      }));
    }
    else if (provider === "openrouter") {
      // OpenRouter doesn't strictly need API key to list public models
      const res = await fetch("https://openrouter.ai/api/v1/models");
      if (!res.ok) throw new Error(`OpenRouter API Error: ${res.statusText}`);
      const data = await res.json();
      models = (data.data || []).map((m: any) => ({
        id: m.id,
        label: m.name || m.id,
        free: m.pricing?.prompt === "0" && m.pricing?.completion === "0"
      }));
    }
    else if (provider === "openai") {
      if (!apiKey) return NextResponse.json({ error: "Chave API necessária" }, { status: 400 });
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!res.ok) throw new Error(`OpenAI API Error: ${res.statusText}`);
      const data = await res.json();
      models = (data.data || [])
        .filter((m: any) => m.id.includes("gpt")) // Simplification
        .map((m: any) => ({
          id: m.id,
          label: m.id,
          free: false
        }));
    }
    else {
      return NextResponse.json({ error: "Provider não suportado para listagem dinâmica" }, { status: 400 });
    }

    // Sort alphabetically by label
    models.sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json({ models });

  } catch (error: any) {
    console.error("Erro em /api/models:", error);
    return NextResponse.json({ error: error.message || "Erro desconhecido" }, { status: 500 });
  }
}
