import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

function runCommand(command: string, args: string[], cwd: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();
      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();

      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr || stdout || `Kommandot avslutades med kod ${code}.`));
    });
  });
}

export type LabelCatalogImportSummary = {
  catalog_rows: number;
  created_boxes: number;
  updated_boxes: number;
  created_sessions: number;
  updated_sessions: number;
  total_boxes: number;
  total_sessions: number;
  total_photos: number;
};

export async function importLabelCatalogWorkbook(fileName: string, fileBuffer: Buffer) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hyllsystem-import-"));
  const inputPath = path.join(tempDir, fileName.replace(/[^a-zA-Z0-9._-]+/g, "_") || "label-catalog.xlsx");

  try {
    await fs.writeFile(inputPath, fileBuffer);

    let stdout = "";
    try {
      stdout = await runCommand("python3", ["scripts/import_label_catalog.py", inputPath], process.cwd());
    } catch {
      stdout = await runCommand("python", ["scripts/import_label_catalog.py", inputPath], process.cwd());
    }

    return JSON.parse(stdout) as LabelCatalogImportSummary;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
