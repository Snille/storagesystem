import { NextResponse } from "next/server";
import { saveBoxSessionFromFormData } from "@/lib/box-session-save";

export async function POST(request: Request) {
  const formData = await request.formData();
  const result = await saveBoxSessionFromFormData(formData);
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: result.redirectTo
    }
  });
}
