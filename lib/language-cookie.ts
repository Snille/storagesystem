export const LANGUAGE_COOKIE_NAME = "lagersystem_language";

export function normalizeLanguageCode(value?: string | null) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return /^[a-z]{2,16}(?:-[a-z0-9]{2,16})?$/.test(normalized) ? normalized : "";
}
