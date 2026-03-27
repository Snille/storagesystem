import { spawn } from "node:child_process";
import { LABEL_MEDIA_PRESETS, findLabelMediaPresetBySku, type LabelMediaPreset } from "@/lib/label-templates";
import { readAppSettingsSync } from "@/lib/settings";

function getConfiguredPrinterQueue() {
  return readAppSettingsSync().labels.printerQueue || process.env.DYMO_PRINTER_QUEUE || "DYMO_5XL";
}

function getRawPrinterEndpoint(deviceUri: string) {
  const fallbackHost = process.env.DYMO_PRINTER_HOST?.trim() || "";
  const fallbackPort = Number(process.env.DYMO_PRINTER_PORT || "9100");

  if (deviceUri.startsWith("socket://")) {
    try {
      const url = new URL(deviceUri);
      return {
        host: url.hostname,
        port: url.port ? Number(url.port) : 9100
      };
    } catch {
      // Fall back to env/default values below.
    }
  }

  return {
    host: fallbackHost,
    port: Number.isFinite(fallbackPort) ? fallbackPort : 9100
  };
}

type DymoPrinterState = "idle" | "processing" | "stopped" | "unknown";

export type DymoPrinterStatus = {
  queue: string;
  state: DymoPrinterState;
  stateReason: string;
  model: string;
  firmwareVersion?: string;
  labelsRemaining?: number;
  deviceUri: string;
  queuedJobs: number;
  media: {
    source: "sku" | "media-default" | "media-col-default" | "none";
    rawKeyword: string;
    dymoSku?: string;
    widthMm?: number;
    heightMm?: number;
    matchedPreset?: LabelMediaPreset;
  };
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

async function queryRawPrinter(host: string, port: number, commandBytes: Buffer, responseBytes: number) {
  return await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(
      "python3",
      [
        "-c",
        [
          "import socket,sys",
          "host,port,cmd_hex,n = sys.argv[1], int(sys.argv[2]), sys.argv[3], int(sys.argv[4])",
          "cmd = bytes.fromhex(cmd_hex)",
          "s = socket.socket()",
          "s.settimeout(2)",
          "s.connect((host, port))",
          "s.sendall(cmd)",
          "data = b''",
          "try:",
          "    while len(data) < n:",
          "        chunk = s.recv(n - len(data))",
          "        if not chunk:",
          "            break",
          "        data += chunk",
          "except Exception:",
          "    pass",
          "s.close()",
          "sys.stdout.buffer.write(data)"
        ].join("\n"),
        host,
        String(port),
        commandBytes.toString("hex"),
        String(responseBytes)
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    const chunks: Buffer[] = [];
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
        return;
      }

      reject(new Error(stderr.trim() || `python3 exited with code ${code}.`));
    });
  });
}

async function exchangeRawPrinter(host: string, port: number, sequence: Array<{ command: Buffer; responseBytes: number }>) {
  return await new Promise<Buffer[]>((resolve, reject) => {
    const child = spawn(
      "python3",
      [
        "-c",
        [
          "import socket,sys,time",
          "host,port = sys.argv[1], int(sys.argv[2])",
          "parts = sys.argv[3:]",
          "seq = []",
          "for i in range(0, len(parts), 2):",
          "    seq.append((bytes.fromhex(parts[i]), int(parts[i+1])))",
          "s = socket.socket()",
          "s.settimeout(2)",
          "s.connect((host, port))",
          "outs = []",
          "for cmd, n in seq:",
          "    s.sendall(cmd)",
          "    time.sleep(0.05)",
          "    data = b''",
          "    try:",
          "        while len(data) < n:",
          "            chunk = s.recv(n - len(data))",
          "            if not chunk:",
          "                break",
          "            data += chunk",
          "    except Exception:",
          "        pass",
          "    outs.append(data.hex())",
          "s.close()",
          "sys.stdout.write('\\n'.join(outs))"
        ].join("\n"),
        host,
        String(port),
        ...sequence.flatMap((entry) => [entry.command.toString("hex"), String(entry.responseBytes)])
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

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
      if (code !== 0) {
        reject(new Error(stderr.trim() || `python3 exited with code ${code}.`));
        return;
      }

      const buffers = stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => Buffer.from(line.trim(), "hex"));
      resolve(buffers);
    });
  });
}

function parsePrinterState(value: string): DymoPrinterState {
  const lowered = value.trim().toLowerCase();
  if (lowered === "idle") return "idle";
  if (lowered === "processing") return "processing";
  if (lowered === "stopped") return "stopped";
  return "unknown";
}

function parseSingleAttribute(output: string, attributeName: string) {
  const pattern = new RegExp(`${attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\([^)]*\\) = (.+)`, "i");
  const match = output.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function parseMediaDimensionsFromKeyword(keyword: string) {
  const match = keyword.match(/custom_(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)mm/i);
  if (!match) {
    return null;
  }

  return {
    widthMm: Number(match[1]),
    heightMm: Number(match[2])
  };
}

function parseMediaDimensionsFromCollection(value: string) {
  const x = value.match(/x-dimension=(\d+)/i);
  const y = value.match(/y-dimension=(\d+)/i);
  if (!x || !y) {
    return null;
  }

  return {
    widthMm: Number(x[1]) / 100,
    heightMm: Number(y[1]) / 100
  };
}

function findMatchedPreset(widthMm?: number, heightMm?: number) {
  if (!widthMm || !heightMm) {
    return undefined;
  }

  const roundedWidth = Math.round(widthMm * 10) / 10;
  const roundedHeight = Math.round(heightMm * 10) / 10;

  return LABEL_MEDIA_PRESETS.find((preset) => {
    const widthDelta = Math.abs(preset.widthMm - roundedWidth);
    const heightDelta = Math.abs(preset.heightMm - roundedHeight);
    return widthDelta <= 1.5 && heightDelta <= 1.5;
  });
}

function parseDymoSku(buffer: Buffer) {
  if (!buffer || buffer.length < 16) {
    return "";
  }

  const ascii = buffer.toString("ascii");
  const match = ascii.match(/S\d{7}/i);
  return match?.[0]?.toUpperCase() ?? "";
}

function isEmptyOrZeroBuffer(buffer: Buffer) {
  return !buffer.length || buffer.every((byte) => byte === 0);
}

function parseFirmwareVersion(buffer: Buffer) {
  if (!buffer || buffer.length === 0) {
    return "";
  }

  const value = buffer.toString("ascii").replace(/\0/g, "").trim();
  return value;
}

function parseLabelsRemaining(buffer: Buffer) {
  if (!buffer || buffer.length < 29) {
    return undefined;
  }

  return buffer.readUInt16LE(27);
}

export async function readDymoPrinterStatus(queue = getConfiguredPrinterQueue()): Promise<DymoPrinterStatus> {
  if (process.platform !== "linux") {
    throw new Error("DYMO printer status is currently supported only on the Linux server.");
  }

  const output = await runCommand("ipptool", [
    "-tv",
    `ipp://localhost/printers/${queue}`,
    "/usr/share/cups/ipptool/get-printer-attributes.test"
  ]);

  const state = parsePrinterState(parseSingleAttribute(output, "printer-state"));
  const stateReason = parseSingleAttribute(output, "printer-state-reasons");
  const model = parseSingleAttribute(output, "printer-make-and-model");
  const deviceUri = parseSingleAttribute(output, "device-uri");
  const rawPrinterEndpoint = getRawPrinterEndpoint(deviceUri);
  const queuedJobs = Number(parseSingleAttribute(output, "queued-job-count") || "0");
  const mediaKeyword = parseSingleAttribute(output, "media-default");
  const mediaCollection = parseSingleAttribute(output, "media-col-default");
  let rawVersion = Buffer.alloc(0);
  let rawSku = Buffer.alloc(0);
  let rawStatus = Buffer.alloc(0);

  if (rawPrinterEndpoint.host) {
    rawVersion = await queryRawPrinter(rawPrinterEndpoint.host, rawPrinterEndpoint.port, Buffer.from([0x1b, 0x56]), 64).catch(() => Buffer.alloc(0));
    rawSku = await queryRawPrinter(rawPrinterEndpoint.host, rawPrinterEndpoint.port, Buffer.from([0x1b, 0x55]), 80).catch(() => Buffer.alloc(0));
    rawStatus = await queryRawPrinter(rawPrinterEndpoint.host, rawPrinterEndpoint.port, Buffer.from([0x1b, 0x41, 0x01]), 32).catch(() => Buffer.alloc(0));
  }

  if (rawPrinterEndpoint.host && (isEmptyOrZeroBuffer(rawSku) || isEmptyOrZeroBuffer(rawStatus))) {
    const sequence = await exchangeRawPrinter(rawPrinterEndpoint.host, rawPrinterEndpoint.port, [
      { command: Buffer.from([0x1b, 0x41, 0x01]), responseBytes: 32 },
      { command: Buffer.from([0x1b, 0x56]), responseBytes: 64 },
      { command: Buffer.from([0x1b, 0x55]), responseBytes: 80 }
    ]).catch(() => []);

    if (sequence[0]?.length) {
      rawStatus = sequence[0];
    }

    if (sequence[1]?.length) {
      rawVersion = sequence[1];
    }

    if (sequence[2]?.length) {
      rawSku = sequence[2];
    }
  }

  const dymoSku = parseDymoSku(rawSku);
  const firmwareVersion = parseFirmwareVersion(rawVersion);
  const labelsRemaining = parseLabelsRemaining(rawStatus);

  const mediaFromKeyword = parseMediaDimensionsFromKeyword(mediaKeyword);
  const mediaFromCollection = parseMediaDimensionsFromCollection(mediaCollection);
  const dimensions = mediaFromKeyword ?? mediaFromCollection ?? undefined;
  const matchedPreset = dymoSku ? findLabelMediaPresetBySku(dymoSku) : findMatchedPreset(dimensions?.widthMm, dimensions?.heightMm);

  return {
    queue,
    state,
    stateReason,
    model,
    firmwareVersion,
    labelsRemaining,
    deviceUri,
    queuedJobs,
    media: {
      source: dymoSku ? "sku" : mediaFromKeyword ? "media-default" : mediaFromCollection ? "media-col-default" : "none",
      rawKeyword: mediaKeyword,
      dymoSku: dymoSku || undefined,
      widthMm: dimensions?.widthMm,
      heightMm: dimensions?.heightMm,
      matchedPreset
    }
  };
}
