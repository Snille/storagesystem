import { NextResponse } from "next/server";
import { fetchAvailableModels } from "@/lib/ai-models";
import type { AiProvider } from "@/lib/types";

function asProvider(value: string): AiProvider {
  return value === "openai" || value === "anthropic" || value === "openrouter" || value === "openwebui"
    ? value
    : "lmstudio";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      provider?: string;
      baseUrl?: string;
      apiKey?: string;
    };

    const models = await fetchAvailableModels({
      provider: asProvider(String(payload.provider ?? "lmstudio")),
      baseUrl: String(payload.baseUrl ?? "").trim(),
      apiKey: String(payload.apiKey ?? "").trim()
    });

    return NextResponse.json({ models });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load models." },
      { status: 500 }
    );
  }
}
