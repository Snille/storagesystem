import { NextResponse } from "next/server";
import { buildExportTimestamp } from "@/lib/export-filenames";
import { exportLabelCatalogWorkbook } from "@/lib/export-label-catalog";

export async function GET() {
  try {
    const workbook = await exportLabelCatalogWorkbook();
    const timestamp = buildExportTimestamp();

    return new NextResponse(workbook, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="lagersystem-katalog-${timestamp}.xlsx"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kunde inte exportera katalogen." },
      { status: 500 }
    );
  }
}
