import { NextResponse } from "next/server";
import { printLabelViaDymo } from "@/lib/dymo-print";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await printLabelViaDymo(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kunde inte skriva ut etiketten." },
      { status: 500 }
    );
  }
}
