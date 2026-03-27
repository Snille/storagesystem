import { existsSync, readFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";

export type LanguageMeta = {
  code: string;
  label: string;
  htmlLang: string;
  speechRecognitionLocale: string;
};

export type LanguageCatalog = {
  _meta: LanguageMeta;
} & Record<string, string | LanguageMeta>;

export type LanguageOption = {
  code: string;
  label: string;
  htmlLang: string;
  speechRecognitionLocale: string;
};

const languagesDirPath = path.join(process.cwd(), "data", "languages");
const defaultLanguageCode = "sv";

function formatTemplate(template: string, values?: Record<string, string | number>) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

function loadCatalogSync(code: string): LanguageCatalog | null {
  const filePath = path.join(languagesDirPath, `${code}.json`);
  if (!existsSync(filePath)) {
    return null;
  }

  return JSON.parse(readFileSync(filePath, "utf8")) as LanguageCatalog;
}

async function loadCatalog(code: string): Promise<LanguageCatalog | null> {
  try {
    const filePath = path.join(languagesDirPath, `${code}.json`);
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as LanguageCatalog;
  } catch {
    return null;
  }
}

export function getDefaultLanguageCode() {
  return defaultLanguageCode;
}

export function createTranslator(catalog: LanguageCatalog) {
  return (key: string, fallback?: string, values?: Record<string, string | number>) => {
    const value = catalog[key];
    if (typeof value === "string") {
      return formatTemplate(value, values);
    }

    return formatTemplate(fallback ?? key, values);
  };
}

export function readLanguageCatalogSync(code?: string): LanguageCatalog {
  const requestedCode = code?.trim() || defaultLanguageCode;
  return loadCatalogSync(requestedCode) ?? loadCatalogSync(defaultLanguageCode) ?? {
    _meta: {
      code: defaultLanguageCode,
      label: "Svenska",
      htmlLang: "sv",
      speechRecognitionLocale: "sv-SE"
    }
  };
}

export async function readLanguageCatalog(code?: string): Promise<LanguageCatalog> {
  const requestedCode = code?.trim() || defaultLanguageCode;
  return (await loadCatalog(requestedCode)) ?? (await loadCatalog(defaultLanguageCode)) ?? readLanguageCatalogSync();
}

export async function listAvailableLanguages(): Promise<LanguageOption[]> {
  try {
    const fileNames = await fs.readdir(languagesDirPath);
    const catalogs = await Promise.all(
      fileNames
        .filter((fileName) => fileName.endsWith(".json"))
        .map(async (fileName) => {
          const code = fileName.replace(/\.json$/i, "");
          const catalog = await loadCatalog(code);
          return catalog?._meta
            ? {
                code: catalog._meta.code,
                label: catalog._meta.label,
                htmlLang: catalog._meta.htmlLang,
                speechRecognitionLocale: catalog._meta.speechRecognitionLocale
              }
            : null;
        })
    );

    return catalogs
      .filter((language): language is LanguageOption => Boolean(language))
      .sort((left, right) => left.label.localeCompare(right.label, "sv", { sensitivity: "base" }));
  } catch {
    const fallback = readLanguageCatalogSync(defaultLanguageCode)._meta;
    return [{
      code: fallback.code,
      label: fallback.label,
      htmlLang: fallback.htmlLang,
      speechRecognitionLocale: fallback.speechRecognitionLocale
    }];
  }
}
