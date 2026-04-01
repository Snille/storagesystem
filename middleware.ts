import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { LANGUAGE_COOKIE_NAME, normalizeLanguageCode } from "@/lib/language-cookie";

function getLegacyCookiePaths(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const paths: string[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    paths.push(`/${parts.slice(0, index + 1).join("/")}`);
  }

  return paths;
}

function clearLegacyLanguageCookies(response: NextResponse, pathname: string) {
  for (const path of getLegacyCookiePaths(pathname)) {
    response.cookies.set(LANGUAGE_COOKIE_NAME, "", {
      path,
      sameSite: "lax",
      expires: new Date(0)
    });
  }
}

export function middleware(request: NextRequest) {
  const requestedLanguage = String(request.nextUrl.searchParams.get("lang") ?? "").trim().toLowerCase();
  const languageCode = normalizeLanguageCode(requestedLanguage);

  if (!requestedLanguage) {
    const response = NextResponse.next();
    clearLegacyLanguageCookies(response, request.nextUrl.pathname);
    return response;
  }

  const url = request.nextUrl.clone();
  url.searchParams.delete("lang");

  const response = NextResponse.redirect(url);
  clearLegacyLanguageCookies(response, request.nextUrl.pathname);

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
