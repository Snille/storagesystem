import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDataDir } from "./helpers";

const assets = [
  { id: "a1", originalFileName: "IMG_1.jpg", fileCreatedAt: "2026-04-01T10:00:00.000Z" },
  { id: "a2", originalFileName: "IMG_2.jpg", fileCreatedAt: "2026-04-01T10:00:05.000Z" }
];

vi.mock("@/lib/photo-source", () => ({
  fetchAlbumAssets: vi.fn(async () => assets),
  fetchAlbumAssetsCached: vi.fn(async () => assets),
  fetchAssetThumbnailResponse: vi.fn(async () => new Response(Buffer.from("img"), { headers: { "content-type": "image/jpeg" } }))
}));

const { analyzeSelectedAssets } = await import("@/lib/analysis");

type Call = { url: string; body: Record<string, unknown> };
const calls: Call[] = [];

function chatReply(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }));
}

let testDir: ReturnType<typeof createTestDataDir>;

beforeAll(() => {
  testDir = createTestDataDir({
    ai: { provider: "openwebui", openwebui: { baseUrl: "http://webui/api", model: "vision", apiKey: "" } }
  });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      calls.push({ url, body });
      const prompt = JSON.stringify(body);

      if (prompt.includes("labelAssetId")) {
        return chatReply("{\"labelAssetId\":\"a2\"}");
      }
      if (calls.length === 1) {
        // Box analysis without photo roles, so the role and label steps run too.
        return chatReply(
          "```json\n" +
            JSON.stringify({
              suggestedBoxId: "IVAR-G-H6-P1-A",
              suggestedLabel: "Lödutrustning",
              suggestedLocationId: "G-H6-P1-A",
              suggestedSummary: "Lödtenn och lödfett.",
              suggestedKeywords: ["lödtenn", "lödfett"],
              suggestedNotes: "",
              confidence: "high",
              suggestedPhotos: []
            }) +
            "\n```"
        );
      }
      return chatReply("{\"photoRole\":\"inside\"}");
    })
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
  testDir.cleanup();
});

describe("analyzeSelectedAssets", () => {
  it("builds a suggestion and sends Open WebUI only chat-format requests", async () => {
    const suggestion = await analyzeSelectedAssets(["a1", "a2"]);

    expect(suggestion.source).toBe("openwebui");
    expect(suggestion.suggestedLabel).toBe("Lödutrustning");
    expect(suggestion.suggestedKeywords).toEqual(["lödtenn", "lödfett"]);
    expect(suggestion.suggestedPhotos.find((photo) => photo.immichAssetId === "a2")?.photoRole).toBe("label");
    expect(suggestion.suggestedPhotos.find((photo) => photo.immichAssetId === "a1")?.photoRole).toBe("inside");

    // 1 box analysis + 2 role checks + 1 label recovery, all as chat completions.
    expect(calls).toHaveLength(4);
    for (const call of calls) {
      expect(call.url).toBe("http://webui/api/chat/completions");
      expect(call.body).toHaveProperty("messages");
      expect(call.body).not.toHaveProperty("input");
    }
  });
});
