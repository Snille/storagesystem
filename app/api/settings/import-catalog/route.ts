import { NextResponse } from "next/server";
import { importLabelCatalogWorkbook } from "@/lib/import-label-catalog";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new Error("Välj en Excel-fil att importera.");
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      throw new Error("Importen stöder bara .xlsx-filer från appens export.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      throw new Error("Den valda Excel-filen var tom.");
    }

    const summary = await importLabelCatalogWorkbook(file.name, buffer);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kunde inte importera katalogen." },
      { status: 500 }
    );
  }
}
