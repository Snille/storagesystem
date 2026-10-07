import { afterEach, describe, expect, it, vi } from "vitest";
import { extractJsonObject, generateAiText, type AiConfig } from "@/lib/ai-client";

type Call = { url: string; body: Record<string, unknown>; headers: Record<string, string> };

function mockFetch(responses: Array<{ status?: number; json?: unknown; text?: string }>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
      const next = responses.shift() ?? { json: {} };
      return new Response(next.text ?? JSON.stringify(next.json), { status: next.status ?? 200 });
    })
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const image = { contentType: "image/jpeg", base64: "QUJD" };
const request = { system: "sys", userText: "hello", images: [image], jsonSchema: { name: "s", schema: { type: "object" } } };

describe("generateAiText", () => {
  it("sends Open WebUI the chat-completions format, images included", async () => {
    const calls = mockFetch([{ json: { choices: [{ message: { content: "{\"a\":1}" } }] } }]);
    const config: AiConfig = { provider: "openwebui", baseUrl: "http://webui/api", model: "m" };

    await expect(generateAiText(config, request)).resolves.toBe("{\"a\":1}");
    expect(calls[0].url).toBe("http://webui/api/chat/completions");
    expect(calls[0].body.messages).toEqual([
      { role: "system", content: "sys" },
      {
        role: "user",
        content: [
          { type: "text", text: "hello" },
          { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } }
        ]
      }
    ]);
    expect(calls[0].body).not.toHaveProperty("input");
  });

  it("sends OpenAI the Responses format with the JSON schema", async () => {
    const calls = mockFetch([{ json: { output_text: "ok" } }]);
    const config: AiConfig = { provider: "openai", baseUrl: "https://api.openai.com/v1", model: "m", apiKey: "k" };

    await generateAiText(config, request);
    expect(calls[0].url).toBe("https://api.openai.com/v1/responses");
    expect(calls[0].headers.Authorization).toBe("Bearer k");
    expect(calls[0].body.text).toEqual({ format: { type: "json_schema", name: "s", schema: { type: "object" }, strict: true } });
    expect(JSON.stringify(calls[0].body.input)).toContain("\"type\":\"input_image\"");
  });

  it("sends Anthropic the Messages format", async () => {
    const calls = mockFetch([{ json: { content: [{ type: "text", text: "svar" }] } }]);
    const config: AiConfig = { provider: "anthropic", baseUrl: "https://api.anthropic.com", model: "m", apiKey: "k" };

    await expect(generateAiText(config, { ...request, maxTokens: 50 })).resolves.toBe("svar");
    expect(calls[0].url).toBe("https://api.anthropic.com/v1/messages");
    expect(calls[0].headers["x-api-key"]).toBe("k");
    expect(calls[0].body).toEqual(expect.objectContaining({ max_tokens: 50, system: "sys" }));
  });

  it("loads an unloaded LM Studio model once and tries again", async () => {
    const calls = mockFetch([{ status: 400, text: "Model unloaded" }, { json: {} }, { json: { output_text: "klar" } }]);
    const config: AiConfig = { provider: "lmstudio", baseUrl: "http://lm:1234/v1", model: "m" };

    await expect(generateAiText(config, { userText: "hej" })).resolves.toBe("klar");
    expect(calls.map((call) => call.url)).toEqual([
      "http://lm:1234/v1/responses",
      "http://lm:1234/api/v1/models/load",
      "http://lm:1234/v1/responses"
    ]);
  });

  it("reports HTTP errors with the status", async () => {
    mockFetch([{ status: 500, text: "kaputt" }]);
    const config: AiConfig = { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", model: "m", apiKey: "k" };
    await expect(generateAiText(config, { userText: "x" })).rejects.toThrow("AI-anropet misslyckades: 500 kaputt");
  });
});

describe("extractJsonObject", () => {
  it.each([
    ["{\"a\":1}", "{\"a\":1}"],
    ["Here you go:\n```json\n{\"a\":{\"b\":2}}\n```", "{\"a\":{\"b\":2}}"],
    ["{\"text\":\"a } inside\"} trailing", "{\"text\":\"a } inside\"}"],
    ["no json", "no json"]
  ])("extracts from %j", (input, expected) => {
    expect(extractJsonObject(input)).toBe(expected);
  });
});
