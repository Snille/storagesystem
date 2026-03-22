import { NextResponse } from "next/server";
import { readDymoPrinterStatus } from "@/lib/dymo-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await readDymoPrinterStatus();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Kunde inte läsa status från DYMO-skrivaren."
      },
      { status: 500 }
    );
  }
}
