import { existsSync, readFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getDefaultLabelSettings, normalizeLabelSettings } from "@/lib/label-templates";
import type { AppSettings } from "@/lib/types";

const settingsFilePath = path.join(process.cwd(), "data", "app-settings.json");
const aiProviderSchema = z.enum(["lmstudio", "openai", "anthropic", "openrouter", "openwebui"]);
const aiSettingsSchema = z.object({
  provider: aiProviderSchema,
  lmstudio: z.object({
    baseUrl: z.string(),
    model: z.string(),
    apiKey: z.string().optional(),
    contextLength: z.number().int().positive().optional()
  }),
  openai: z.object({
    baseUrl: z.string(),
    model: z.string(),
    apiKey: z.string().optional()
  }),
  anthropic: z.object({
    baseUrl: z.string(),
    model: z.string(),
    apiKey: z.string().optional()
  }),
  openrouter: z.object({
    baseUrl: z.string(),
    model: z.string(),
    apiKey: z.string().optional()
  }),
  openwebui: z.object({
    baseUrl: z.string(),
    model: z.string(),
    apiKey: z.string().optional()
  })
});

const settingsSchema = z.object({
  appearance: z.object({
    theme: z.enum(["auto", "light", "dark"]),
    fontFamily: z.enum(["arial", "georgia", "verdana", "trebuchet", "system"]),
    fontSizePt: z.number().min(8).max(28),
    reduceMotion: z.boolean(),
    language: z.string().min(2).max(16)
  }),
  immich: z.object({
    baseUrl: z.string(),
    accountLabel: z.string(),
    accessMode: z.enum(["apiKey", "shareKey"]),
    apiKey: z.string().optional(),
    shareKey: z.string().optional(),
    albumId: z.string()
  }),
  prompts: z.object({
    boxAnalysisInstructions: z.string(),
    photoRolePrompt: z.string(),
    photoRoleSystemPrompt: z.string(),
    photoSummaryPrompt: z.string(),
    photoSummarySystemPrompt: z.string(),
    anthropicBoxSystemPrompt: z.string(),
    translationDraftSystemPrompt: z.string(),
    summaryCleanupPrefixes: z.string(),
    keywordCleanupTerms: z.string(),
    notesCleanupPhrases: z.string(),
    photoSummaryCleanupPhrases: z.string()
  }),
  ai: aiSettingsSchema,
  translationAi: aiSettingsSchema,
  labels: z.object({
    printerQueue: z.string(),
    defaultTemplateId: z.string(),
    templates: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        mediaKey: z.string(),
        mediaLabel: z.string(),
        orientation: z.enum(["portrait", "landscape"]).optional(),
        widthMm: z.number(),
        heightMm: z.number(),
        pageWidthPt: z.number(),
        pageHeightPt: z.number(),
        paddingMm: z.number(),
        placeDisplay: z.enum(["chips", "singleLine"]),
        snapToGrid: z.boolean(),
        gridMm: z.number(),
        fields: z.object({
          title: z.object({
            xMm: z.number(),
            yMm: z.number(),
            widthMm: z.number(),
            heightMm: z.number(),
            fontSizePt: z.number(),
            fontFamily: z.enum(["arial", "verdana", "trebuchet", "georgia", "system"]),
            fontWeight: z.union([z.literal(400), z.literal(700)]),
            textAlign: z.enum(["left", "center"]),
            rotationDeg: z.union([z.literal(-90), z.literal(0), z.literal(90)]).optional(),
            visible: z.boolean()
          }),
          description: z.object({
            xMm: z.number(),
            yMm: z.number(),
            widthMm: z.number(),
            heightMm: z.number(),
            fontSizePt: z.number(),
            fontFamily: z.enum(["arial", "verdana", "trebuchet", "georgia", "system"]),
            fontWeight: z.union([z.literal(400), z.literal(700)]),
            textAlign: z.enum(["left", "center"]),
            rotationDeg: z.union([z.literal(-90), z.literal(0), z.literal(90)]).optional(),
            visible: z.boolean()
          }),
          place: z.object({
            xMm: z.number(),
            yMm: z.number(),
            widthMm: z.number(),
            heightMm: z.number(),
            fontSizePt: z.number(),
            fontFamily: z.enum(["arial", "verdana", "trebuchet", "georgia", "system"]),
            fontWeight: z.union([z.literal(400), z.literal(700)]),
            textAlign: z.enum(["left", "center"]),
            rotationDeg: z.union([z.literal(-90), z.literal(0), z.literal(90)]).optional(),
            visible: z.boolean()
          })
        })
      })
    )
  })
});

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function legacyFontScaleToPt(value: unknown) {
  switch (value) {
    case "small":
      return 11.25;
    case "large":
      return 13;
    case "x-large":
      return 14;
    default:
      return 12;
  }
}

export function getDefaultAppSettings(): AppSettings {
  const defaultAiSettings: AppSettings["ai"] = {
    provider: ((process.env.AI_PROVIDER ?? (process.env.LMSTUDIO_BASE_URL ? "lmstudio" : "openai")).toLowerCase() ===
    "anthropic"
      ? "anthropic"
      : (process.env.AI_PROVIDER ?? (process.env.LMSTUDIO_BASE_URL ? "lmstudio" : "openai")).toLowerCase() ===
          "openrouter"
        ? "openrouter"
      : (process.env.AI_PROVIDER ?? (process.env.LMSTUDIO_BASE_URL ? "lmstudio" : "openai")).toLowerCase() ===
          "openwebui"
        ? "openwebui"
      : (process.env.AI_PROVIDER ?? (process.env.LMSTUDIO_BASE_URL ? "lmstudio" : "openai")).toLowerCase() ===
          "lmstudio"
        ? "lmstudio"
        : "openai") as AppSettings["ai"]["provider"],
    lmstudio: {
      baseUrl: trimTrailingSlash(process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1"),
      model: process.env.LMSTUDIO_MODEL || "",
      apiKey: process.env.LMSTUDIO_API_KEY || "",
      contextLength: process.env.LMSTUDIO_CONTEXT_LENGTH ? Number(process.env.LMSTUDIO_CONTEXT_LENGTH) : undefined
    },
    openai: {
      baseUrl: trimTrailingSlash(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"),
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      apiKey: process.env.OPENAI_API_KEY || ""
    },
    anthropic: {
      baseUrl: trimTrailingSlash(process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"),
      model: process.env.ANTHROPIC_MODEL || "claude-3-7-sonnet-latest",
      apiKey: process.env.ANTHROPIC_API_KEY || ""
    },
    openrouter: {
      baseUrl: trimTrailingSlash(process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"),
      model: process.env.OPENROUTER_MODEL || "",
      apiKey: process.env.OPENROUTER_API_KEY || ""
    },
    openwebui: {
      baseUrl: trimTrailingSlash(process.env.OPENWEBUI_BASE_URL || "http://llm.snille.net:8080/api"),
      model: process.env.OPENWEBUI_MODEL || "",
      apiKey: process.env.OPENWEBUI_API_KEY || ""
    }
  };

  return {
    appearance: {
      theme: "auto",
      fontFamily: "arial",
      fontSizePt: 12,
      reduceMotion: false,
      language: "en"
    },
    immich: {
      baseUrl: trimTrailingSlash(process.env.IMMICH_BASE_URL || ""),
      accountLabel: process.env.IMMICH_ACCOUNT_LABEL || "Standardkonto",
      accessMode: process.env.IMMICH_API_KEY ? "apiKey" : "shareKey",
      apiKey: process.env.IMMICH_API_KEY || "",
      shareKey: process.env.IMMICH_SHARE_KEY || "",
      albumId: process.env.IMMICH_ALBUM_ID || ""
    },
    prompts: {
      boxAnalysisInstructions: [
        "Du analyserar foton av verkstadslådor på svenska.",
        "Målet är att hjälpa till att inventera innehållet i lådor och koppla dem till rätt etikett och plats.",
        "Leta särskilt efter text på etiketter, handskrivna lappar, hyllangivelser och platsangivelser.",
        "Använd OCR-liknande tolkning av all synlig text i bilderna.",
        "Identifiera också synliga objekt, verktyg, kablar, kontakter, adaptrar, förpackningar och material.",
        "Föreslå alltid photoRole för varje bild.",
        "Använd bara role=label när etiketten eller platslappen verkligen är huvudmotivet eller tydligt läsbar i bilden.",
        "Om en bild mest visar innehållet i lådan men råkar innehålla en liten etikett i kanten ska den ändå inte få role=label.",
        "Om en bild visar innehållet i lådan ska den få role=inside eller spread.",
        "Om du tvekar mellan label och inside ska du välja inside, inte label.",
        "Du får också en katalog över redan kända lådor.",
        "Om bilderna sannolikt visar en befintlig låda i katalogen kan du använda dess box_id, etikett och plats.",
        "Men synlig etikett och synlig plats i bilden väger tyngre än katalogen.",
        "Om OCR läser en annan hylla eller plats än katalogmatchen ska du inte återanvända katalogens box_id.",
        "Om etiketttext och kataloginnehåll motsäger varandra ska du hellre lämna suggestedBoxId tomt än att välja fel låda.",
        "Om ingen katalogmatch känns trovärdig kan suggestedBoxId lämnas tom.",
        "Var försiktig med hallucinationer, men lämna inte allt tomt.",
        "Även vid osäkerhet ska du försöka ge en kort svensk suggestedSummary och 3 till 8 konkreta suggestedKeywords baserade på synlig text och synliga objekt.",
        "suggestedSummary ska vara en kort svensk mening om vad lådan verkar innehålla eller vad etiketten säger.",
        "suggestedKeywords ska vara korta svenska ord eller tekniska termer, till exempel adaptrar, usb, rca, nätverkskabel, hålsåg, buntband.",
        "suggestedNotes ska normalt vara tom.",
        "Använd bara suggestedNotes för verkliga osäkerheter, till exempel svårläst etikett eller tveksam identifiering.",
        "Förklara inte hur du resonerade, nämn inte katalogmatchning, OCR-steg eller varför du valde en viss låda.",
        "Svara enbart i JSON enligt schemat."
      ].join(" "),
      photoRolePrompt: [
        "Du ska klassificera exakt en bild av en verkstadslåda.",
        "Välj en photoRole bland: label, location, inside, spread, detail.",
        "Använd bara label när etiketten eller platslappen är huvudmotivet eller tydligt läsbar i bilden.",
        "Om bilden mest visar innehållet i lådan men en liten etikett råkar synas, välj inside eller spread, inte label.",
        "Om du tvekar mellan label och inside ska du välja inside.",
        'Svara bara med JSON som {"photoRole":"inside"}.'
      ].join(" "),
      photoRoleSystemPrompt: "Du klassificerar bilder från verkstadslådor och ska svara strikt i JSON.",
      photoSummaryPrompt: [
        "Analysera exakt en bild från en verkstadslåda.",
        "Beskriv bara vad som syns i just denna bild.",
        "Skriv på svenska.",
        "Nämn inte OCR, katalog, matchning eller hur du resonerade.",
        "Om bilden visar innehållet i lådan, beskriv objekten kort och konkret.",
        "Om bilden visar en etikett, beskriv vilken typ av låda det verkar vara.",
        'Svara med JSON på formen {"summary":"..."}.'
      ].join(" "),
      photoSummarySystemPrompt: "Du beskriver verkstadsbilder kortfattat på svenska och svarar endast med JSON.",
      anthropicBoxSystemPrompt:
        "Du analyserar verkstadslådor på svenska. Följ användarens instruktioner och svara endast med ett JSON-objekt.",
      translationDraftSystemPrompt: [
        "Du översätter UI-strängar för en app.",
        "Behåll alla placeholders exakt som de är, till exempel {count}, {label}, {name} och liknande.",
        "Behåll radbrytningar om de finns i originalet.",
        "Översätt bara själva texten, inte nycklarna.",
        "Håll översättningen kort, naturlig och konsekvent för ett användargränssnitt.",
        "Var konsekvent med återkommande termer i hela appen.",
        "Ändra inte tekniska identifierare, modellnamn, filändelser eller kodlika värden om det inte är uppenbart att de ska översättas.",
        "Om källtexten redan är korrekt på målspråket kan den lämnas oförändrad.",
        "Svara endast i JSON enligt det format som efterfrågas."
      ].join(" "),
      summaryCleanupPrefixes: [
        "placerad på ivar",
        "placerat på ivar",
        "placerade på ivar",
        "placerad i ivar",
        "placerat i ivar",
        "placerade i ivar",
        "på ivar",
        "i ivar",
        "märkt med plats"
      ].join("\n"),
      keywordCleanupTerms: [
        "ivar",
        "hylla",
        "plats",
        "the",
        "user",
        "wants",
        "analyze",
        "analysis",
        "images",
        "workshop",
        "boxes"
      ].join("\n"),
      notesCleanupPhrases: [
        "matchar katalogen",
        "stämmer överens med katalogen",
        "ocr läser",
        "etiketten anger",
        "innehållet i lådan",
        "vilket stödjer",
        "katalogen anger"
      ].join("\n"),
      photoSummaryCleanupPhrases: [
        "ocr läser",
        "matchar katalogen",
        "katalogen"
      ].join("\n")
    },
    ai: defaultAiSettings,
    translationAi: defaultAiSettings,
    labels: getDefaultLabelSettings()
  };
}

function mergeSettings(base: AppSettings, input?: Partial<AppSettings>): AppSettings {
  const inputAppearance = (input?.appearance ?? {}) as Record<string, unknown>;
  const parsed = settingsSchema.parse({
    appearance: {
      ...base.appearance,
      ...inputAppearance,
      fontSizePt:
        typeof inputAppearance.fontSizePt === "number"
          ? inputAppearance.fontSizePt
          : legacyFontScaleToPt(inputAppearance.fontScale),
      language: String(inputAppearance.language ?? base.appearance.language ?? "en").trim() || "en"
    },
    immich: {
      ...base.immich,
      ...(input?.immich ?? {})
    },
    prompts: {
      ...base.prompts,
      ...(input?.prompts ?? {})
    },
    ai: {
      ...base.ai,
      ...(input?.ai ?? {}),
      lmstudio: {
        ...base.ai.lmstudio,
        ...(input?.ai?.lmstudio ?? {})
      },
      openai: {
        ...base.ai.openai,
        ...(input?.ai?.openai ?? {})
      },
      anthropic: {
        ...base.ai.anthropic,
        ...(input?.ai?.anthropic ?? {})
      },
      openrouter: {
        ...base.ai.openrouter,
        ...(input?.ai?.openrouter ?? {})
      },
      openwebui: {
        ...base.ai.openwebui,
        ...(input?.ai?.openwebui ?? {})
      }
    },
    translationAi: {
      ...base.translationAi,
      ...(input?.translationAi ?? {}),
      lmstudio: {
        ...base.translationAi.lmstudio,
        ...(input?.translationAi?.lmstudio ?? {})
      },
      openai: {
        ...base.translationAi.openai,
        ...(input?.translationAi?.openai ?? {})
      },
      anthropic: {
        ...base.translationAi.anthropic,
        ...(input?.translationAi?.anthropic ?? {})
      },
      openrouter: {
        ...base.translationAi.openrouter,
        ...(input?.translationAi?.openrouter ?? {})
      },
      openwebui: {
        ...base.translationAi.openwebui,
        ...(input?.translationAi?.openwebui ?? {})
      }
    },
    labels: normalizeLabelSettings({
      ...base.labels,
      ...(input?.labels ?? {}),
      printerQueue: String(input?.labels?.printerQueue ?? base.labels.printerQueue ?? "").trim(),
      templates: input?.labels?.templates ?? base.labels.templates
    })
  });

  return {
    ...parsed,
    labels: normalizeLabelSettings(parsed.labels as AppSettings["labels"])
  };
}

export function readAppSettingsSync(): AppSettings {
  const defaults = getDefaultAppSettings();

  if (!existsSync(settingsFilePath)) {
    return defaults;
  }

  try {
    const raw = readFileSync(settingsFilePath, "utf8");
    return mergeSettings(defaults, JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    return defaults;
  }
}

export async function readAppSettings(): Promise<AppSettings> {
  const defaults = getDefaultAppSettings();

  try {
    const raw = await fs.readFile(settingsFilePath, "utf8");
    return mergeSettings(defaults, JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    return defaults;
  }
}

export async function writeAppSettings(input: AppSettings) {
  const data = settingsSchema.parse(input);
  await fs.mkdir(path.dirname(settingsFilePath), { recursive: true });
  await fs.writeFile(settingsFilePath, JSON.stringify(data, null, 2), "utf8");
}
