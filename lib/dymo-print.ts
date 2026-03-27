import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { z } from "zod";
import { findLabelMediaPreset, normalizeLabelTemplate } from "@/lib/label-templates";
import { wrapFieldText } from "@/lib/label-layout";
import { readAppSettingsSync } from "@/lib/settings";
import type { LabelFieldKey, LabelTemplate } from "@/lib/types";

const DEFAULT_DYMO_MEDIA = process.env.DYMO_PRINTER_MEDIA || "w162h90";

function getConfiguredPrinterQueue() {
  return readAppSettingsSync().labels.printerQueue || process.env.DYMO_PRINTER_QUEUE || "DYMO_5XL";
}

const labelPrintSchema = z.object({
  label: z.string().trim().min(1),
  description: z.string().trim().optional().default(""),
  placeText: z.string().trim().min(1),
  template: z
    .object({
      id: z.string(),
      name: z.string(),
      mediaKey: z.string(),
      mediaLabel: z.string(),
      orientation: z.enum(["portrait", "landscape"]),
      widthMm: z.number(),
      heightMm: z.number(),
      pageWidthPt: z.number(),
      pageHeightPt: z.number(),
      paddingMm: z.number(),
      placeDisplay: z.enum(["chips", "singleLine"]),
      snapToGrid: z.boolean(),
      gridMm: z.number(),
      fields: z.object({
        title: z.object({
          xMm: z.number(),
          yMm: z.number(),
          widthMm: z.number(),
          heightMm: z.number(),
          fontSizePt: z.number(),
          fontFamily: z.enum(["arial", "verdana", "trebuchet", "georgia", "system"]),
          fontWeight: z.union([z.literal(400), z.literal(700)]),
          textAlign: z.enum(["left", "center"]),
          rotationDeg: z.union([z.literal(-90), z.literal(0), z.literal(90)]),
          visible: z.boolean()
        }),
        description: z.object({
          xMm: z.number(),
          yMm: z.number(),
          widthMm: z.number(),
          heightMm: z.number(),
          fontSizePt: z.number(),
          fontFamily: z.enum(["arial", "verdana", "trebuchet", "georgia", "system"]),
          fontWeight: z.union([z.literal(400), z.literal(700)]),
          textAlign: z.enum(["left", "center"]),
          rotationDeg: z.union([z.literal(-90), z.literal(0), z.literal(90)]),
          visible: z.boolean()
        }),
        place: z.object({
          xMm: z.number(),
          yMm: z.number(),
          widthMm: z.number(),
          heightMm: z.number(),
          fontSizePt: z.number(),
          fontFamily: z.enum(["arial", "verdana", "trebuchet", "georgia", "system"]),
          fontWeight: z.union([z.literal(400), z.literal(700)]),
          textAlign: z.enum(["left", "center"]),
          rotationDeg: z.union([z.literal(-90), z.literal(0), z.literal(90)]),
          visible: z.boolean()
        })
      })
    })
    .optional()
});

export type LabelPrintPayload = z.infer<typeof labelPrintSchema>;

function escapePostScript(value: string) {
  const bytes = Buffer.from(value, "latin1");
  let output = "";

  for (const byte of bytes) {
    if (byte === 40 || byte === 41 || byte === 92) {
      output += `\\${String.fromCharCode(byte)}`;
      continue;
    }

    if (byte < 32 || byte > 126) {
      output += `\\${byte.toString(8).padStart(3, "0")}`;
      continue;
    }

    output += String.fromCharCode(byte);
  }

  return output;
}

function mmToPt(mm: number) {
  return (mm / 25.4) * 72;
}

function splitPlaceText(input: string) {
  return input
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function getFontName(field: LabelTemplate["fields"][LabelFieldKey]) {
  if (field.fontWeight === 700) {
    return field.fontFamily === "georgia" ? "Times-Bold-Latin1" : "Helvetica-Bold-Latin1";
  }

  return field.fontFamily === "georgia" ? "Times-Roman-Latin1" : "Helvetica-Latin1";
}

function addFieldText(commands: string[], template: LabelTemplate, fieldKey: LabelFieldKey, text: string) {
  const field = template.fields[fieldKey];
  if (!field.visible || !text.trim()) {
    return;
  }

  const x = mmToPt(field.xMm);
  const yTop = template.pageHeightPt - mmToPt(field.yMm);
  const width = mmToPt(field.widthMm);
  const height = mmToPt(field.heightMm);
  const lineHeight = field.fontSizePt * 1.2;
  const logicalWidth = field.rotationDeg === 0 ? width : height;
  const logicalHeight = field.rotationDeg === 0 ? height : width;
  const lines = wrapFieldText(template, fieldKey, text).slice(0, Math.max(1, Math.floor(logicalHeight / lineHeight)));
  const fontName = getFontName(field);

  if (field.rotationDeg === 0) {
    commands.push(`${x.toFixed(2)} ${yTop.toFixed(2)} ${logicalWidth.toFixed(2)} /${fontName} ${field.fontSizePt} /${field.textAlign} [`);
    for (const line of lines) {
      commands.push(`(${escapePostScript(line)})`);
    }
    commands.push("] drawBlockText");
    return;
  }

  const centerX = x + width / 2;
  const centerY = yTop - height / 2;
  const localX = -logicalWidth / 2;
  const localTopY = logicalHeight / 2;

  commands.push("gsave");
  commands.push(`${centerX.toFixed(2)} ${centerY.toFixed(2)} translate`);
  commands.push(`${field.rotationDeg} rotate`);
  commands.push(`${localX.toFixed(2)} ${localTopY.toFixed(2)} ${logicalWidth.toFixed(2)} /${fontName} ${field.fontSizePt} /${field.textAlign} [`);
  for (const line of lines) {
    commands.push(`(${escapePostScript(line)})`);
  }
  commands.push("] drawBlockText");
  commands.push("grestore");
}

function buildLabelPostScript(payload: LabelPrintPayload) {
  const data = labelPrintSchema.parse(payload);
  const template = normalizeLabelTemplate(
    data.template ?? {
      id: "runtime-default",
      name: "Runtime default",
      ...findLabelMediaPreset(DEFAULT_DYMO_MEDIA),
      paddingMm: 2.5,
      placeDisplay: "chips",
      snapToGrid: true,
      gridMm: 1,
      fields: {
        title: {
          xMm: 3,
          yMm: 3,
          widthMm: 51,
          heightMm: 7,
          fontSizePt: 16,
          fontFamily: "arial",
          fontWeight: 700,
          textAlign: "center",
          rotationDeg: 0,
          visible: true
        },
        description: {
          xMm: 3,
          yMm: 12.5,
          widthMm: 51,
          heightMm: 11,
          fontSizePt: 8,
          fontFamily: "arial",
          fontWeight: 400,
          textAlign: "center",
          rotationDeg: 0,
          visible: true
        },
        place: {
          xMm: 3,
          yMm: 25.5,
          widthMm: 51,
          heightMm: 4.5,
          fontSizePt: 11,
          fontFamily: "arial",
          fontWeight: 700,
          textAlign: "center",
          rotationDeg: 0,
          visible: true
        }
      }
    }
  );
  const placeSegments = splitPlaceText(data.placeText);
  const placeText = template.placeDisplay === "singleLine" ? placeSegments.join("  ") : placeSegments.join("\n");

  const ps = [
    "%!PS-Adobe-3.0",
    `%%BoundingBox: 0 0 ${template.pageWidthPt} ${template.pageHeightPt}`,
    "/Helvetica-Latin1 /Helvetica findfont dup length dict begin",
    "  {1 index /FID ne {def} {pop pop} ifelse} forall",
    "  /Encoding ISOLatin1Encoding def",
    "  currentdict",
    "end definefont pop",
    "/Helvetica-Bold-Latin1 /Helvetica-Bold findfont dup length dict begin",
    "  {1 index /FID ne {def} {pop pop} ifelse} forall",
    "  /Encoding ISOLatin1Encoding def",
    "  currentdict",
    "end definefont pop",
    "/Times-Roman-Latin1 /Times-Roman findfont dup length dict begin",
    "  {1 index /FID ne {def} {pop pop} ifelse} forall",
    "  /Encoding ISOLatin1Encoding def",
    "  currentdict",
    "end definefont pop",
    "/Times-Bold-Latin1 /Times-Bold findfont dup length dict begin",
    "  {1 index /FID ne {def} {pop pop} ifelse} forall",
    "  /Encoding ISOLatin1Encoding def",
    "  currentdict",
    "end definefont pop",
    "/drawBlockText {",
    "  /lines exch def",
    "  /align exch def",
    "  /fontSize exch def",
    "  /fontName exch def",
    "  /width exch def",
    "  /topY exch def",
    "  /x exch def",
    "  fontName findfont fontSize scalefont setfont",
    "  /leading fontSize 1.2 mul def",
    "  /y topY fontSize sub def",
    "  0 1 lines length 1 sub {",
    "    /idx exch def",
    "    /line lines idx get def",
    "    x y moveto",
    "    align /center eq {",
    "      width line stringwidth pop sub 2 div 0 rmoveto",
    "    } if",
    "    line show",
    "    /y y leading sub def",
    "  } for",
    "} def",
    "gsave"
  ];

  addFieldText(ps, template, "title", data.label);
  addFieldText(ps, template, "description", data.description);
  addFieldText(ps, template, "place", placeText);

  ps.push("grestore");
  ps.push("showpage");

  return ps.join("\n") + "\n";
}

async function runCommand(command: string, args: string[], input?: Buffer) {
  return await new Promise<{ stdout: Buffer; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout: Buffer.concat(stdoutChunks), stderr });
        return;
      }

      reject(
        new Error(stderr.trim() || Buffer.concat(stdoutChunks).toString("utf8").trim() || `${command} avslutades med kod ${code}.`)
      );
    });
  });
}

async function cleanupPendingDymoJobs(queue: string) {
  const jobs = await runCommand("lpstat", ["-W", "not-completed", "-o", queue]).catch(() => ({
    stdout: Buffer.from(""),
    stderr: ""
  }));

  const jobIds = jobs.stdout
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((value) => Boolean(value));

  for (const jobId of jobIds) {
    await runCommand("cancel", [jobId]).catch(() => undefined);
  }

  return jobIds;
}

function scheduleFileCleanup(filePath: string) {
  const escapedPath = filePath.replace(/'/g, "'\"'\"'");
  const child = spawn("sh", ["-lc", `sleep 300; rm -f '${escapedPath}' >/dev/null 2>&1 || true`], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}

export async function printLabelViaDymo(payload: LabelPrintPayload) {
  if (process.platform !== "linux") {
    throw new Error("Direktutskrift till DYMO stöds just nu bara på Linux-servern.");
  }

  const printerQueue = getConfiguredPrinterQueue();
  const data = labelPrintSchema.parse(payload);
  const tempFilePath = path.join(os.tmpdir(), `lagersystem-label-${Date.now()}.ps`);
  const queueCheck = await runCommand("lpstat", ["-p", printerQueue]);

  if (!queueCheck.stdout.toString("utf8").includes(printerQueue)) {
    throw new Error(`DYMO-kön ${printerQueue} finns inte i CUPS.`);
  }

  const clearedJobs = await cleanupPendingDymoJobs(printerQueue);
  await fs.writeFile(tempFilePath, buildLabelPostScript(data), { encoding: "utf8", mode: 0o644 });
  const mediaKey = data.template?.mediaKey || DEFAULT_DYMO_MEDIA;
  const result = await runCommand("lp", ["-d", printerQueue, "-o", `media=${mediaKey}`, tempFilePath]);

  const requestIdMatch = result.stdout.toString("utf8").match(/request id is ([^\s]+)/i);
  const requestId = requestIdMatch?.[1] ?? "";

  scheduleFileCleanup(tempFilePath);

  return {
    ok: true as const,
    queue: printerQueue,
    media: mediaKey,
    requestId,
    clearedJobs
  };
}

