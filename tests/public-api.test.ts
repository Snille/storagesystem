import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDataDir, TEST_API_KEY } from "./helpers";

// No photo source or AI engine in tests: album listing is empty and photos are placeholders.
vi.mock("@/lib/photo-source", () => ({
  fetchAlbumAssets: vi.fn(async () => []),
  fetchAlbumAssetsCached: vi.fn(async () => []),
  fetchAssetThumbnailResponse: vi.fn(async () => new Response(Buffer.from("img"), { headers: { "content-type": "image/jpeg" } })),
  fetchAssetOriginalResponse: vi.fn(async () => new Response(Buffer.from("img"), { headers: { "content-type": "image/jpeg" } }))
}));

const { GET: health } = await import("@/app/api/public/health/route");
const { GET: search } = await import("@/app/api/public/search/route");
const { POST: ask } = await import("@/app/api/public/ask/route");
const { GET: box } = await import("@/app/api/public/boxes/[boxId]/route");
const { GET: thumbnail } = await import("@/app/api/public/assets/[assetId]/thumbnail/route");

const BASE = "http://lager.test";
const auth = { "x-api-key": TEST_API_KEY };
let testDir: ReturnType<typeof createTestDataDir>;

beforeAll(() => {
  testDir = createTestDataDir();
  // No network in tests: every AI call fails, so /ask must fall back to the local answer.
  vi.stubGlobal("fetch", vi.fn(async () => {
    throw new Error("network disabled in tests");
  }));
});

afterAll(() => {
  vi.unstubAllGlobals();
  testDir.cleanup();
});

// These are the fields Snille/storagesystem-ha reads (result.py, api.py, binary_sensor.py).
function expectHaMatchShape(match: Record<string, unknown>) {
  expect(match).toEqual(
    expect.objectContaining({
      boxId: expect.any(String),
      label: expect.any(String),
      locationId: expect.any(String),
      location: { system: expect.any(String), shelf: expect.any(String), slot: expect.any(String) },
      itemKeywords: expect.any(Array),
      photos: expect.any(Array)
    })
  );
}

function askRequest(query: string) {
  return new Request(`${BASE}/api/public/ask`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ query })
  });
}

describe("public API contract used by Home Assistant", () => {
  it("rejects requests without the key", async () => {
    const response = await health(new Request(`${BASE}/api/public/health`));
    expect(response.status).toBe(401);
  });

  it("health returns ok, service and date", async () => {
    for (const headers of [auth, { authorization: `Bearer ${TEST_API_KEY}` }]) {
      const response = await health(new Request(`${BASE}/api/public/health`, { headers }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, service: "lagersystem", date: expect.any(String) });
    }
  });

  it("search returns count and matches with Swedish location labels", async () => {
    const response = await search(new Request(`${BASE}/api/public/search?q=lödtenn&limit=5`, { headers: auth }));
    const body = await response.json();

    expect(body.query).toBe("lödtenn");
    expect(body.count).toBe(body.matches.length);
    expect(body.matches[0].boxId).toBe("IVAR-G-H6-P1-A");
    expectHaMatchShape(body.matches[0]);
    expect(body.matches[0].location).toEqual({ system: "Lagerhylla: G", shelf: "Hylla 6", slot: "Plats: 1A" });
    expect(body.matches[0].sessionId).toBe("S-1");
    expect(body.matches[0].summary).toContain("Lödtenn");
  });

  it("search can answer in another language", async () => {
    const response = await search(new Request(`${BASE}/api/public/search?q=lödtenn&lang=en`, { headers: auth }));
    const body = await response.json();
    expect(body.matches[0].location).toEqual({ system: "Shelving unit: G", shelf: "Shelf 6", slot: "Slot: 1A" });
  });

  it("photo URLs carry a per-photo signature, never the API key", async () => {
    const response = await search(new Request(`${BASE}/api/public/search?q=lödtenn`, { headers: auth }));
    const photo = (await response.json()).matches[0].photos[0];

    expect(photo.thumbnailUrl).toMatch(/\/api\/public\/assets\/asset-label\/thumbnail\?sig=/);
    expect(photo.originalUrl).toMatch(/\/original\?sig=/);
    expect(photo.thumbnailUrl).not.toContain(TEST_API_KEY);

    const params = { params: Promise.resolve({ assetId: "asset-label" }) };
    const signed = await thumbnail(new Request(new URL(photo.thumbnailUrl, BASE)), params);
    expect(signed.status).toBe(200);

    const otherPhoto = await thumbnail(
      new Request(new URL(photo.thumbnailUrl.replace("asset-label", "asset-inside"), BASE)),
      { params: Promise.resolve({ assetId: "asset-inside" }) }
    );
    expect(otherPhoto.status).toBe(401);

    const oldStyleLink = await thumbnail(new Request(`${BASE}/api/public/assets/asset-label/thumbnail?key=${TEST_API_KEY}`), params);
    expect(oldStyleLink.status).toBe(200);
  });

  it("ask falls back to the local answer when no AI engine works", async () => {
    const body = await (await ask(askRequest("skruv"))).json();

    expect(body).toEqual(
      expect.objectContaining({
        query: "skruv",
        source: "search",
        count: 1,
        answer: "Träskruvar finns i Bänk: 2, Yta: Under, Plats: 1A."
      })
    );
    expectHaMatchShape(body.matches[0]);
  });

  it("ask answers no-match in the app language", async () => {
    const body = await (await ask(askRequest("xyzzy"))).json();
    expect(body.answer).toBe("Jag hittade ingen tydlig träff för \"xyzzy\".");
  });

  it("box returns one box, and a 404 with a message for unknown ids", async () => {
    const found = await box(new Request(`${BASE}/api/public/boxes/IVAR-G-H6-P1-A`, { headers: auth }), {
      params: Promise.resolve({ boxId: "IVAR-G-H6-P1-A" })
    });
    expectHaMatchShape(await found.json());

    const missing = await box(new Request(`${BASE}/api/public/boxes/NOPE`, { headers: auth }), {
      params: Promise.resolve({ boxId: "NOPE" })
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Lådan kunde inte hittas." });
  });
});
