import { NextResponse } from "next/server";
import { listAvailablePrinterQueues } from "@/lib/cups-printers";

export async function GET() {
  try {
    const printers = await listAvailablePrinterQueues();
    return NextResponse.json({ printers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kunde inte läsa skrivarköerna." },
      { status: 500 }
    );
  }
}
