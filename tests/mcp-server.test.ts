import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDataDir, TEST_API_KEY } from "./helpers";

vi.mock("@/lib/photo-source", () => ({
  fetchAlbumAssets: vi.fn(async () => []),
  fetchAlbumAssetsCached: vi.fn(async () => []),
  fetchAssetThumbnailResponse: vi.fn(async () => new Response(Buffer.from("jpeg-bytes"), { headers: { "content-type": "image/jpeg" } }))
}));

const { POST, GET } = await import("@/app/api/mcp/route");

let testDir: ReturnType<typeof createTestDataDir>;

beforeAll(() => {
  testDir = createTestDataDir();
});

afterAll(() => {
  testDir.cleanup();
});

async function rpc(body: unknown, key = TEST_API_KEY) {
  const response = await POST(
    new Request("http://lager.test/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body)
    })
  );
  return { status: response.status, body: response.status === 200 ? await response.json() : null };
}

function callTool(name: string, args: Record<string, unknown>) {
  return rpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
}

describe("MCP endpoint", () => {
  it("needs the API key", async () => {
    expect((await rpc({ jsonrpc: "2.0", id: 1, method: "ping" }, "wrong")).status).toBe(401);
  });

  it("initializes and echoes a supported protocol version", async () => {
    const { body } = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
    expect(body.result.protocolVersion).toBe("2025-06-18");
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.serverInfo.name).toBe("storagesystem");
  });

  it("accepts notifications with 202 and refuses GET", async () => {
    expect((await rpc({ jsonrpc: "2.0", method: "notifications/initialized" })).status).toBe(202);
    expect(GET().status).toBe(405);
  });

  it("lists the five read-only tools", async () => {
    const { body } = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(body.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "search_inventory",
      "get_box",
      "list_locations",
      "list_boxes_at_location",
      "get_box_photo"
    ]);
  });

  it("searches without leaking photo URLs or keys", async () => {
    const { body } = await callTool("search_inventory", { query: "lödtenn" });
    expect(body.result.structuredContent.matches[0].boxId).toBe("IVAR-G-H6-P1-A");
    expect(JSON.stringify(body)).not.toContain("sig=");
    expect(JSON.stringify(body)).not.toContain(TEST_API_KEY);
  });

  it("lists locations and the boxes in one", async () => {
    const locations = (await callTool("list_locations", {})).body.result.structuredContent;
    expect(locations.locations).toEqual(
      expect.arrayContaining([expect.objectContaining({ location: "g", title: "Lagerhylla G", boxCount: 1 })])
    );

    const boxes = (await callTool("list_boxes_at_location", { location: "g" })).body.result.structuredContent;
    expect(boxes.boxes[0].label).toBe("Lödutrustning");
  });

  it("returns a photo as image content, preferring the inside photo", async () => {
    const { body } = await callTool("get_box_photo", { box_id: "IVAR-G-H6-P1-A" });
    expect(body.result.content[0]).toEqual({
      type: "image",
      data: Buffer.from("jpeg-bytes").toString("base64"),
      mimeType: "image/jpeg"
    });
    expect(body.result.content[1].text).toContain("(inside)");
  });

  it("reports tool errors as results and protocol errors as errors", async () => {
    expect((await callTool("get_box", { box_id: "NOPE" })).body.result.isError).toBe(true);
    expect((await callTool("search_inventory", {})).body.result.isError).toBe(true);
    expect((await callTool("no_such_tool", {})).body.error.code).toBe(-32602);
    expect((await rpc({ jsonrpc: "2.0", id: 9, method: "nope" })).body.error.code).toBe(-32601);
  });
});
