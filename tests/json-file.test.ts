import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readInventoryData, updateInventoryData, writeInventoryData } from "@/lib/data-store";
import { withFileLock } from "@/lib/json-file";
import { readAppSettings, readAppSettingsSync, writeAppSettings } from "@/lib/settings";
import { createTestDataDir, fixtureInventory } from "./helpers";

let testDir: ReturnType<typeof createTestDataDir>;

beforeEach(() => {
  testDir = createTestDataDir();
});

afterEach(() => {
  testDir.cleanup();
});

describe("withFileLock", () => {
  it("runs tasks with the same key one at a time, in order", async () => {
    const events: string[] = [];
    const task = (name: string, ms: number) =>
      withFileLock("k", async () => {
        events.push(`start ${name}`);
        await new Promise((resolve) => setTimeout(resolve, ms));
        events.push(`end ${name}`);
      });

    await Promise.all([task("a", 20), task("b", 1), task("c", 1)]);
    expect(events).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"]);
  });

  it("keeps going after a task fails", async () => {
    const failing = withFileLock("k2", async () => {
      throw new Error("boom");
    });
    await expect(failing).rejects.toThrow("boom");
    await expect(withFileLock("k2", async () => "ok")).resolves.toBe("ok");
  });
});

describe("inventory store", () => {
  it("loses no change when many updates run at the same time", async () => {
    await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        updateInventoryData((data) => {
          data.boxes.push({
            boxId: `NEW-${index}`,
            label: `Ny ${index}`,
            currentLocationId: "A-H1-P1-A",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z"
          });
        })
      )
    );

    const data = await readInventoryData();
    expect(data.boxes).toHaveLength(fixtureInventory.boxes.length + 40);
  });

  it("does not write when the change throws", async () => {
    await expect(
      updateInventoryData((data) => {
        data.boxes = [];
        throw new Error("nope");
      })
    ).rejects.toThrow("nope");

    expect((await readInventoryData()).boxes).toHaveLength(fixtureInventory.boxes.length);
  });

  it("gives each reader its own copy", async () => {
    const first = await readInventoryData();
    first.boxes[0].label = "changed in memory";
    const second = await readInventoryData();
    expect(second.boxes[0].label).toBe(fixtureInventory.boxes[0].label);
  });

  it("leaves no temp files and writes valid JSON", async () => {
    await writeInventoryData(fixtureInventory);
    expect(readdirSync(testDir.dir).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    const raw = readFileSync(path.join(testDir.dir, "inventory.json"), "utf8");
    expect(JSON.parse(raw).boxes).toHaveLength(fixtureInventory.boxes.length);
  });

  it("rejects data that does not match the schema", async () => {
    await expect(writeInventoryData({ boxes: [{ boxId: 1 }] } as never)).rejects.toThrow();
    expect((await readInventoryData()).boxes).toHaveLength(fixtureInventory.boxes.length);
  });
});

describe("settings store", () => {
  it("returns copies and sees its own writes", async () => {
    const settings = readAppSettingsSync();
    expect(settings.security.publicApiKey).toBe("test-key-123");
    settings.security.publicApiKey = "mutated";
    expect(readAppSettingsSync().security.publicApiKey).toBe("test-key-123");

    const next = await readAppSettings();
    next.appearance.language = "en";
    await writeAppSettings(next);
    expect(readAppSettingsSync().appearance.language).toBe("en");
  });
});
