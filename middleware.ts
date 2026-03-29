import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { LANGUAGE_COOKIE_NAME, normalizeLanguageCode } from "@/lib/language-cookie";

export function middleware(request: NextRequest) {
  const requestedLanguage = String(request.nextUrl.searchParams.get("lang") ?? "").trim().toLowerCase();
  const languageCode = normalizeLanguageCode(requestedLanguage);

  if (!requestedLanguage) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.searchParams.delete("lang");

  const response = NextResponse.redirect(url);

  if (requestedLanguage === "default") {
    response.cookies.delete(LANGUAGE_COOKIE_NAME);
    return response;
  }

  if (!languageCode) {
    return response;
  }

  response.cookies.set(LANGUAGE_COOKIE_NAME, languageCode, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365
  });

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
