import JSZip from "jszip";
import { NextResponse } from "next/server";
import { inventorySchema, readInventoryData, writeInventoryData } from "@/lib/data-store";
import { readAppSettings, writeAppSettings } from "@/lib/settings";
import { z } from "zod";

const backupSchema = z.object({
  exportedAt: z.string().optional(),
  appSettings: z.unknown(),
  inventoryData: z.unknown()
});

type BackupPayload = z.infer<typeof backupSchema>;

function buildBackupPayload(appSettings: Awaited<ReturnType<typeof readAppSettings>>, inventoryData: Awaited<ReturnType<typeof readInventoryData>>): BackupPayload {
  return {
    exportedAt: new Date().toISOString(),
    appSettings,
    inventoryData
  };
}

function normalizeImportedAppSettings(input: unknown) {
  if (!input || typeof input !== "object") {
    return input;
  }

  const record = input as Record<string, unknown>;
  const appearance =
    record.appearance && typeof record.appearance === "object"
      ? { ...(record.appearance as Record<string, unknown>) }
      : undefined;

  if (appearance && typeof appearance.fontSizePt !== "number" && typeof appearance.fontScale === "string") {
    appearance.fontSizePt =
      appearance.fontScale === "small"
        ? 11.25
        : appearance.fontScale === "large"
          ? 13
          : appearance.fontScale === "x-large"
            ? 14
            : 12;
  }

  return {
    ...record,
    ...(appearance ? { appearance } : {})
  };
}

async function parseBackupFromBody(request: Request): Promise<BackupPayload> {
  const buffer = Buffer.from(await request.arrayBuffer());

  if (buffer.length === 0) {
    throw new Error("Backupfilen var tom.");
  }

  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (isZip) {
    const zip = await JSZip.loadAsync(buffer);
    const jsonEntry =
      zip.file("hyllsystem-backup.json") ??
      Object.values(zip.files).find((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".json"));

    if (!jsonEntry) {
      throw new Error("Zip-filen innehöll ingen backup-json.");
    }

    const text = await jsonEntry.async("text");
    return backupSchema.parse(JSON.parse(text));
  }

  return backupSchema.parse(JSON.parse(buffer.toString("utf8")));
}

export async function GET() {
  try {
    const [appSettings, inventoryData] = await Promise.all([readAppSettings(), readInventoryData()]);
    const backup = buildBackupPayload(appSettings, inventoryData);
    const zip = new JSZip();
    zip.file("hyllsystem-backup.json", JSON.stringify(backup, null, 2));
    const archive = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 }
    });

    return new NextResponse(archive, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="hyllsystem-backup-${new Date().toISOString().slice(0, 10)}.zip"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kunde inte skapa backup." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await parseBackupFromBody(request);
    const inventoryData = inventorySchema.parse(payload.inventoryData);
    const appSettings = normalizeImportedAppSettings(payload.appSettings);

    await writeInventoryData(inventoryData);
    await writeAppSettings(appSettings as Awaited<ReturnType<typeof readAppSettings>>);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kunde inte läsa in backupen." },
      { status: 500 }
    );
  }
}
