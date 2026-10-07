import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { InventoryData } from "@/lib/types";

export const TEST_API_KEY = "test-key-123";

export const fixtureInventory: InventoryData = {
  boxes: [
    {
      boxId: "IVAR-G-H6-P1-A",
      label: "Lödutrustning",
      currentLocationId: "G-H6-P1-A",
      notes: "Röd låda",
      createdAt: "2026-03-20T10:00:00Z",
      updatedAt: "2026-03-20T10:00:00Z"
    },
    {
      boxId: "BENCH-2-UNDER-P1-A",
      label: "Träskruvar",
      currentLocationId: "BENCH:2:UNDER:P1:A",
      createdAt: "2026-03-20T10:00:00Z",
      updatedAt: "2026-03-20T10:00:00Z"
    }
  ],
  sessions: [
    {
      sessionId: "S-1",
      boxId: "IVAR-G-H6-P1-A",
      createdAt: "2026-03-21T10:00:00Z",
      summary: "Lödtenn, lödfett och lödsug.",
      itemKeywords: ["lödtenn", "lödfett", "lödsug"],
      isCurrent: true
    },
    {
      sessionId: "S-2",
      boxId: "BENCH-2-UNDER-P1-A",
      createdAt: "2026-03-21T10:00:00Z",
      summary: "Träskruvar i olika längder.",
      itemKeywords: ["skruv", "träskruv"],
      isCurrent: true
    }
  ],
  photos: [
    { photoId: "S-1:1", sessionId: "S-1", immichAssetId: "asset-label", photoRole: "label" },
    { photoId: "S-1:2", sessionId: "S-1", immichAssetId: "asset-inside", photoRole: "inside" }
  ]
};

/** Points the app at a fresh data directory with fixture inventory, settings and the real language files. */
export function createTestDataDir(settings: Record<string, unknown> = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "lagersystem-test-"));
  writeFileSync(path.join(dir, "inventory.json"), JSON.stringify(fixtureInventory, null, 2));
  writeFileSync(
    path.join(dir, "app-settings.json"),
    JSON.stringify({ appearance: { language: "sv" }, security: { publicApiKey: TEST_API_KEY }, ...settings }, null, 2)
  );
  cpSync(path.join(process.cwd(), "data", "languages"), path.join(dir, "languages"), { recursive: true });
  process.env.LAGERSYSTEM_DATA_DIR = dir;

  return {
    dir,
    cleanup() {
      delete process.env.LAGERSYSTEM_DATA_DIR;
      rmSync(dir, { recursive: true, force: true });
    }
  };
}
