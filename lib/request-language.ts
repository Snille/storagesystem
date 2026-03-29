import { cookies } from "next/headers";
import { readLanguageCatalog } from "@/lib/i18n";
import { LANGUAGE_COOKIE_NAME, normalizeLanguageCode } from "@/lib/language-cookie";

export async function readResolvedLanguageCode(fallbackCode: string) {
  const cookieStore = await cookies();
  return normalizeLanguageCode(cookieStore.get(LANGUAGE_COOKIE_NAME)?.value) || fallbackCode;
}

export async function readResolvedLanguageCatalog(fallbackCode: string) {
  return readLanguageCatalog(await readResolvedLanguageCode(fallbackCode));
}
