import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

function runCommand(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
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
      if (code === 0) {
        resolve();
        return;
      }

      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
      const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();
      reject(new Error(stderr || stdout || `Kommandot avslutades med kod ${code}.`));
    });
  });
}

export async function exportLabelCatalogWorkbook() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "lagersystem-export-"));
  const outputPath = path.join(tempDir, "lagersystem-katalog.xlsx");

  try {
    try {
      await runCommand("python3", ["scripts/export_label_catalog.py", outputPath], process.cwd());
    } catch {
      await runCommand("python", ["scripts/export_label_catalog.py", outputPath], process.cwd());
    }
    const file = await fs.readFile(outputPath);
    return file;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
