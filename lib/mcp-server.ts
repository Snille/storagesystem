import { z } from "zod";
import { readInventoryData } from "@/lib/data-store";
import { presentLocation } from "@/lib/location-presentation";
import { fetchAssetThumbnailResponse } from "@/lib/photo-source";
import { getPublicBoxById, getPublicLocationLabels, searchPublicInventory } from "@/lib/public-api";
import { readAppSettingsSync } from "@/lib/settings";
import { getShelfUnitBySlug, getShelfUnits, presentShelfUnitTitle } from "@/lib/shelf-map";
import packageJson from "@/package.json";

// Minimal, stateless MCP server (Streamable HTTP transport, JSON responses only).
// Read-only: it exposes the same data as /api/public/* and never writes inventory.

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string; data?: unknown } };

type ToolContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

type ToolResult = {
  content: ToolContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: unknown) => Promise<ToolResult>;
};

const SERVER_INSTRUCTIONS = [
  "This server knows where things are stored in a workshop (boxes on shelving units, benches and cabinets).",
  "Use search_inventory first to find boxes by content, then get_box for details.",
  "Use list_locations and list_boxes_at_location to browse by place.",
  "Use get_box_photo to look at a photo of a box when the text summary is not enough.",
  "When telling a person where something is, use the human-readable location (system, shelf, slot), never the internal IDs."
].join(" ");

function defaultLanguage() {
  return readAppSettingsSync().appearance.language || "en";
}

function textResult(payload: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload
  };
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

// The public API embeds the API key in photo URLs. Those must never reach an LLM provider,
// so tool output carries photo metadata only and images go through get_box_photo.
function toToolBox(box: NonNullable<Awaited<ReturnType<typeof getPublicBoxById>>>) {
  return {
    boxId: box.boxId,
    label: box.label,
    location: box.location,
    boxNotes: box.boxNotes,
    summary: box.summary,
    sessionNotes: box.sessionNotes,
    itemKeywords: box.itemKeywords,
    updatedAt: box.sessionCreatedAt,
    photos: box.photos.map((photo) => ({ photoId: photo.photoId, role: photo.role, notes: photo.notes })),
    ...(box.score ? { score: box.score } : {})
  };
}

const languageProperty = {
  type: "string",
  description: "Language code for location labels, for example 'sv' or 'en'. Defaults to the app language."
};

const searchArgs = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(25).optional(),
  language: z.string().optional()
});

const boxArgs = z.object({
  box_id: z.string().trim().min(1),
  language: z.string().optional()
});

const locationsArgs = z.object({
  language: z.string().optional()
});

const locationArgs = z.object({
  location: z.string().trim().min(1),
  language: z.string().optional()
});

const photoArgs = z.object({
  box_id: z.string().trim().min(1),
  photo_id: z.string().optional(),
  role: z.enum(["label", "location", "inside", "spread", "detail"]).optional()
});

const tools: ToolDefinition[] = [
  {
    name: "search_inventory",
    title: "Search inventory",
    description:
      "Find boxes whose contents match a free-text query (Swedish or English words work best). Returns the best matches with location, AI summary and keywords.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What you are looking for, for example 'lödtenn' or 'M3 screws'." },
        limit: { type: "integer", minimum: 1, maximum: 25, description: "Maximum number of matches. Default 10." },
        language: languageProperty
      },
      required: ["query"]
    },
    async run(raw) {
      const args = searchArgs.parse(raw);
      const matches = await searchPublicInventory(args.query, args.limit ?? 10, args.language ?? defaultLanguage());
      return textResult({ query: args.query, count: matches.length, matches: matches.map(toToolBox) });
    }
  },
  {
    name: "get_box",
    title: "Get box",
    description: "Get the full details of one box by its boxId: location, notes, AI summary, keywords and photo list.",
    inputSchema: {
      type: "object",
      properties: {
        box_id: { type: "string", description: "The boxId, as returned by search_inventory or list_boxes_at_location." },
        language: languageProperty
      },
      required: ["box_id"]
    },
    async run(raw) {
      const args = boxArgs.parse(raw);
      const box = await getPublicBoxById(args.box_id, args.language ?? defaultLanguage());
      return box ? textResult(toToolBox(box)) : errorResult(`No box with boxId "${args.box_id}".`);
    }
  },
  {
    name: "list_locations",
    title: "List locations",
    description: "List every storage unit (shelving units, benches, cabinets) with how many boxes each holds.",
    inputSchema: { type: "object", properties: { language: languageProperty } },
    async run(raw) {
      const args = locationsArgs.parse(raw ?? {});
      const labels = getPublicLocationLabels(args.language ?? defaultLanguage());
      const units = getShelfUnits(await readInventoryData());
      return textResult({
        count: units.length,
        locations: units.map((unit) => ({
          location: unit.slug,
          title: presentShelfUnitTitle(unit.kind, unit.unitLabel, labels),
          kind: unit.kind,
          boxCount: unit.boxes.length
        }))
      });
    }
  },
  {
    name: "list_boxes_at_location",
    title: "List boxes at location",
    description: "List all boxes in one storage unit, in shelf and slot order. Use the 'location' value from list_locations.",
    inputSchema: {
      type: "object",
      properties: {
        location: { type: "string", description: "Location slug from list_locations, for example 'a', 'bench-1' or 'cabinet-a'." },
        language: languageProperty
      },
      required: ["location"]
    },
    async run(raw) {
      const args = locationArgs.parse(raw);
      const labels = getPublicLocationLabels(args.language ?? defaultLanguage());
      const unit = getShelfUnitBySlug(await readInventoryData(), args.location);
      if (!unit) {
        return errorResult(`Unknown location "${args.location}". Call list_locations for valid values.`);
      }

      return textResult({
        location: unit.slug,
        title: presentShelfUnitTitle(unit.kind, unit.unitLabel, labels),
        count: unit.boxes.length,
        boxes: unit.boxes.map((entry) => ({
          boxId: entry.box.boxId,
          label: entry.box.label,
          location: presentLocation(entry.box.currentLocationId, entry.box.boxId, labels),
          summary: entry.session?.summary,
          itemKeywords: entry.session?.itemKeywords ?? []
        }))
      });
    }
  },
  {
    name: "get_box_photo",
    title: "Get box photo",
    description:
      "Return a thumbnail image of a box. Pick a photo by photo_id, or by role ('inside', 'spread', 'detail', 'label', 'location'). Defaults to the most useful photo of the contents.",
    inputSchema: {
      type: "object",
      properties: {
        box_id: { type: "string" },
        photo_id: { type: "string", description: "A photoId from get_box." },
        role: { type: "string", enum: ["label", "location", "inside", "spread", "detail"] }
      },
      required: ["box_id"]
    },
    async run(raw) {
      const args = photoArgs.parse(raw);
      const box = await getPublicBoxById(args.box_id);
      if (!box) {
        return errorResult(`No box with boxId "${args.box_id}".`);
      }

      const rolePreference = args.role ? [args.role] : ["inside", "spread", "detail", "label", "location"];
      const photo = args.photo_id
        ? box.photos.find((entry) => entry.photoId === args.photo_id)
        : rolePreference.map((role) => box.photos.find((entry) => entry.role === role)).find(Boolean);

      if (!photo) {
        return errorResult(`Box "${args.box_id}" has no matching photo.`);
      }

      const response = await fetchAssetThumbnailResponse(photo.immichAssetId);
      if (!response.ok) {
        return errorResult(`The photo source returned ${response.status} for this photo.`);
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        return errorResult("The photo is too large to return.");
      }

      return {
        content: [
          { type: "image", data: bytes.toString("base64"), mimeType: response.headers.get("content-type") ?? "image/jpeg" },
          { type: "text", text: `Photo ${photo.photoId} (${photo.role}) of box ${box.boxId}, ${box.label}.` }
        ]
      };
    }
  }
];

const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));

function success(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function failure(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function callTool(params: Record<string, unknown> | undefined): Promise<ToolResult> {
  const tool = toolsByName.get(String(params?.name ?? ""));
  if (!tool) {
    throw new RangeError(`Unknown tool: ${String(params?.name)}`);
  }

  try {
    return await tool.run(params?.arguments ?? {});
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResult(`Invalid arguments: ${error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ")}`);
    }

    return errorResult(error instanceof Error ? error.message : "The tool failed.");
  }
}

/** Handles one JSON-RPC message. Returns null for notifications, which get no response. */
export async function handleMcpMessage(message: unknown): Promise<JsonRpcResponse | null> {
  if (!message || typeof message !== "object" || (message as JsonRpcRequest).jsonrpc !== "2.0") {
    return failure(null, -32600, "Invalid JSON-RPC message.");
  }

  const request = message as JsonRpcRequest;
  const isNotification = request.id === undefined;
  // Responses to server-initiated requests and notifications carry no work for a stateless server.
  if (isNotification || typeof request.method !== "string") {
    return null;
  }

  const id = request.id ?? null;

  switch (request.method) {
    case "initialize": {
      const requested = String(request.params?.protocolVersion ?? "");
      return success(id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "storagesystem", title: "Storage system", version: packageJson.version },
        instructions: SERVER_INSTRUCTIONS
      });
    }
    case "ping":
      return success(id, {});
    case "tools/list":
      return success(id, {
        tools: tools.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema }))
      });
    case "tools/call":
      try {
        return success(id, await callTool(request.params));
      } catch (error) {
        return failure(id, -32602, error instanceof Error ? error.message : "Invalid tool call.");
      }
    default:
      return failure(id, -32601, `Method not found: ${request.method}`);
  }
}
