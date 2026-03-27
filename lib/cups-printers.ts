import { spawn } from "node:child_process";

export type CupsPrinter = {
  queue: string;
  summary: string;
};

async function runCommand(command: string, args: string[]) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || `${command} avslutades med kod ${code}.`));
    });
  });
}

export async function listAvailablePrinterQueues(): Promise<CupsPrinter[]> {
  if (process.platform !== "linux") {
    return [];
  }

  const output = await runCommand("lpstat", ["-p"]);
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^printer\s+(\S+)\s+(.*)$/i);
      if (!match) {
        return null;
      }

      return {
        queue: match[1],
        summary: match[2].trim()
      } satisfies CupsPrinter;
    })
    .filter((value): value is CupsPrinter => value !== null);
}
