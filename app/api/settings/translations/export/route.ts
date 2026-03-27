import { NextResponse } from "next/server";
import { readLanguageCatalog } from "@/lib/i18n";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = String(searchParams.get("code") ?? "").trim().toLowerCase();

  if (!code) {
    return NextResponse.json({ error: "Language code is required." }, { status: 400 });
  }

  try {
    const catalog = await readLanguageCatalog(code);
    return new NextResponse(`${JSON.stringify(catalog, null, 2)}\n`, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${code}.json"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not export language file." },
      { status: 500 }
    );
  }
}
