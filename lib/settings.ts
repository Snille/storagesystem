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

const photoRolePromptPairSchema = z.object({
  prompt: z.string(),
  systemPrompt: z.string()
});

const photoRoleSpecificPromptsSchema = z.object({
  label: photoRolePromptPairSchema,
  location: photoRolePromptPairSchema,
  inside: photoRolePromptPairSchema,
  spread: photoRolePromptPairSchema,
  detail: photoRolePromptPairSchema
});

const modelPromptOverrideSchema = z.object({
  boxAnalysisInstructions: z.string().optional(),
  publicAskSystemPrompt: z.string().optional(),
  voiceAskSystemPrompt: z.string().optional(),
  photoRolePrompt: z.string().optional(),
  photoRoleSystemPrompt: z.string().optional(),
  photoSummaryPrompt: z.string().optional(),
  photoSummarySystemPrompt: z.string().optional(),
  anthropicBoxSystemPrompt: z.string().optional(),
  translationDraftSystemPrompt: z.string().optional(),
  summaryCleanupPrefixes: z.string().optional(),
  keywordCleanupTerms: z.string().optional(),
  notesCleanupPhrases: z.string().optional(),
  photoSummaryCleanupPhrases: z.string().optional(),
  photoRoleSpecificPrompts: z.object({
    label: photoRolePromptPairSchema.partial().optional(),
    location: photoRolePromptPairSchema.partial().optional(),
    inside: photoRolePromptPairSchema.partial().optional(),
    spread: photoRolePromptPairSchema.partial().optional(),
    detail: photoRolePromptPairSchema.partial().optional()
  }).optional()
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
    provider: z.enum(["immich", "photoprism", "nextcloud"]).default("immich"),
    baseUrl: z.string(),
    accountLabel: z.string(),
    accessMode: z.enum(["apiKey", "shareKey"]),
    apiKey: z.string().optional(),
    shareKey: z.string().optional(),
    albumId: z.string()
  }),
  prompts: z.object({
    boxAnalysisInstructions: z.string(),
    publicAskSystemPrompt: z.string(),
    voiceAskSystemPrompt: z.string(),
    photoRolePrompt: z.string(),
    photoRoleSystemPrompt: z.string(),
    photoSummaryPrompt: z.string(),
    photoSummarySystemPrompt: z.string(),
    anthropicBoxSystemPrompt: z.string(),
    translationDraftSystemPrompt: z.string(),
    summaryCleanupPrefixes: z.string(),
    keywordCleanupTerms: z.string(),
    notesCleanupPhrases: z.string(),
    photoSummaryCleanupPhrases: z.string(),
    photoRoleSpecificPrompts: photoRoleSpecificPromptsSchema
  }),
  modelPrompts: z.record(z.string(), modelPromptOverrideSchema).default({}),
  security: z.object({
    publicApiKey: z.string(),
    appBaseUrl: z.string()
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
      baseUrl: trimTrailingSlash(process.env.OPENWEBUI_BASE_URL || "http://llm.yourdomain.com:8080/api"),
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
      provider: "immich",
      baseUrl: trimTrailingSlash(process.env.IMMICH_BASE_URL || ""),
      accountLabel: process.env.IMMICH_ACCOUNT_LABEL || "Default account",
      accessMode: process.env.IMMICH_API_KEY ? "apiKey" : "shareKey",
      apiKey: process.env.IMMICH_API_KEY || "",
      shareKey: process.env.IMMICH_SHARE_KEY || "",
      albumId: process.env.IMMICH_ALBUM_ID || ""
    },
    prompts: {
      boxAnalysisInstructions: [
        "You analyze photos of storage boxes and workshop boxes.",
        "The goal is to help inventory the contents of boxes and connect them to the correct label and location.",
        "Look especially for text on labels, handwritten notes, shelf markers, and location markers.",
        "Use OCR-like interpretation of all visible text in the images.",
        "Also identify visible objects, tools, cables, connectors, adapters, packages, and materials.",
        "Always suggest a photoRole for each image.",
        "Use role=label only when the front label or location tag is the main subject or clearly readable in the image.",
        "If an image mostly shows the box contents but happens to include a small edge label, it should still not get role=label.",
        "If an image shows the contents of the box, use role=inside or spread.",
        "If you are unsure between label and inside, choose inside, not label.",
        "You also receive a catalog of already known boxes.",
        "If the images likely show an existing box from the catalog, you may reuse its box_id, label, and location.",
        "But visible label text and visible location information in the image outweigh the catalog.",
        "If OCR reads a different shelf or slot than the catalog match, do not reuse the catalog box_id.",
        "If label text and catalog contents contradict each other, prefer leaving suggestedBoxId empty rather than choosing the wrong box.",
        "If no catalog match feels credible, suggestedBoxId may be left empty.",
        "Be careful about hallucinations, but do not leave everything empty.",
        "Even when uncertain, try to provide a short suggestedSummary and 3 to 8 concrete suggestedKeywords based on visible text and visible objects.",
        "suggestedSummary should be a short sentence about what the box appears to contain or what the label says.",
        "suggestedKeywords should be short words or technical terms, for example adapters, usb, rca, network cable, hole saw, zip ties.",
        "suggestedNotes should normally be empty.",
        "Use suggestedNotes only for real uncertainty, such as a hard-to-read label or doubtful identification.",
        "Do not explain your reasoning, mention catalog matching, OCR steps, or why you selected a specific box.",
        "Reply only with JSON that follows the schema."
      ].join(" "),
      publicAskSystemPrompt: [
        "You answer briefly about where items are stored in a workshop or storage system.",
        "Use only the provided context.",
        "If matches are uncertain, say so clearly.",
        "Do not invent boxes, locations, or contents not found in the context.",
        "If several candidates seem plausible, briefly mention the most likely ones.",
        "Keep your answer short and natural.",
        'Reply only as JSON on the form {"answer":"..."}.'
      ].join(" "),
      voiceAskSystemPrompt: [
        "You answer questions about where items are stored in a workshop or storage system.",
        "Use only the provided context.",
        "If matches are uncertain, say so clearly.",
        "Do not invent boxes, locations, or contents not found in the context.",
        "Use a friendly, natural tone suited for being read aloud.",
        "Answer in 1 to 2 short sentences, not just a location string.",
        "If several candidates seem plausible, briefly mention the most likely one and note that there are more.",
        'Reply only as JSON on the form {"answer":"..."}.'
      ].join(" "),
      photoRolePrompt: [
        "Classify exactly one image of a storage box or workshop box.",
        "Choose one photoRole from: label, location, inside, spread, detail.",
        "Use label only when the label or location tag is the main subject or clearly readable in the image.",
        "If the image mostly shows the box contents but a small label happens to be visible, choose inside or spread, not label.",
        "If you are unsure between label and inside, choose inside.",
        'Reply only with JSON like {"photoRole":"inside"}.'
      ].join(" "),
      photoRoleSystemPrompt: "You classify storage-box images and must reply strictly in JSON.",
      photoSummaryPrompt: [
        "Analyze exactly one image from a storage box or workshop box.",
        "Describe only what is visible in this specific image.",
        "Do not mention OCR, catalog matching, or your reasoning.",
        "If the image shows the inside of the box, describe the visible objects briefly and concretely.",
        "If the image shows a label, describe what kind of box it appears to be.",
        'Reply with JSON in the form {"summary":"..."}.'
      ].join(" "),
      photoSummarySystemPrompt: "You describe workshop and storage images briefly and reply only with JSON.",
      anthropicBoxSystemPrompt:
        "You analyze storage and workshop boxes. Follow the user's instructions and reply only with a JSON object.",
      translationDraftSystemPrompt: [
        "You translate UI strings for an app.",
        "Keep all placeholders exactly as they are, for example {count}, {label}, {name}, and similar tokens.",
        "Preserve line breaks when they exist in the source.",
        "Translate only the text itself, not the keys.",
        "Keep translations short, natural, and consistent for a user interface.",
        "Use consistent terminology across the app.",
        "Do not change technical identifiers, model names, file extensions, or code-like values unless it is clearly appropriate to translate them.",
        "If the source text is already correct in the target language, it may remain unchanged.",
        "Reply only in JSON using the requested format."
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
      ].join("\n"),
      photoRoleSpecificPrompts: {
        label: {
          systemPrompt: "You describe workshop and storage images briefly and reply only with JSON.",
          prompt: [
            "Analyze exactly one image showing the label or front of a storage box.",
            "Focus on reading all visible text: label name, shelf marker, location codes, handwritten notes.",
            "Use OCR-like interpretation of all text in the image.",
            "Describe what the label says and what kind of box this appears to be.",
            "Write your response in the language specified in the system prompt.",
            "Do not mention OCR, catalog matching, or your reasoning.",
            'Reply with JSON in the form {"summary":"..."}.'
          ].join(" ")
        },
        location: {
          systemPrompt: "You describe workshop and storage images briefly and reply only with JSON.",
          prompt: [
            "Analyze exactly one image showing the storage location of a box.",
            "Read all visible shelf labels, row numbers, slot markers, and position codes.",
            "Describe where this box is located as precisely as the image allows.",
            "Write your response in the language specified in the system prompt.",
            "Do not mention OCR, catalog matching, or your reasoning.",
            'Reply with JSON in the form {"summary":"..."}.'
          ].join(" ")
        },
        inside: {
          systemPrompt: "You describe workshop and storage images briefly and reply only with JSON.",
          prompt: [
            "Analyze exactly one image showing the inside contents of a storage box.",
            "List the visible objects, tools, components, cables, or materials concretely and briefly.",
            "Focus on what you can identify, not on what might be there.",
            "Write your response in the language specified in the system prompt.",
            "Do not mention OCR, catalog matching, or your reasoning.",
            'Reply with JSON in the form {"summary":"..."}.'
          ].join(" ")
        },
        spread: {
          systemPrompt: "You describe workshop and storage images briefly and reply only with JSON.",
          prompt: [
            "Analyze exactly one image showing the contents of a storage box spread out or laid flat.",
            "List the visible objects, tools, components, and materials as concretely as possible.",
            "Write your response in the language specified in the system prompt.",
            "Do not mention OCR, catalog matching, or your reasoning.",
            'Reply with JSON in the form {"summary":"..."}.'
          ].join(" ")
        },
        detail: {
          systemPrompt: "You describe workshop and storage images briefly and reply only with JSON.",
          prompt: [
            "Analyze exactly one detail image of a storage box item.",
            "Describe what is shown in this specific detail shot: type, markings, model numbers, connectors, or condition.",
            "Write your response in the language specified in the system prompt.",
            "Do not mention OCR, catalog matching, or your reasoning.",
            'Reply with JSON in the form {"summary":"..."}.'
          ].join(" ")
        }
      }
    },
    security: {
      publicApiKey: process.env.LAGERSYSTEM_API_KEY || "",
      appBaseUrl: process.env.APP_BASE_URL || ""
    },
    ai: defaultAiSettings,
    translationAi: defaultAiSettings,
    modelPrompts: {
      "openrouter:google/gemma-4-26b-a4b": {
        boxAnalysisInstructions: [
          "You analyze photos of storage boxes. Reply ONLY with a JSON object matching the given schema. No text, explanation, or markdown outside the JSON.",
          "Inspect all images carefully. Look for: text on labels, handwritten notes, shelf markers, location codes.",
          "Also identify visible objects, tools, cables, connectors, and materials.",
          "Assign a photoRole to each image. Use \"label\" only when a label or location tag is clearly the main subject.",
          "Use \"inside\" or \"spread\" when contents are shown, even if a small edge label is incidentally visible.",
          "Use \"location\" when the image primarily shows the storage position.",
          "If unsure between \"label\" and \"inside\", choose \"inside\".",
          "A catalog of known boxes is provided. Reuse box_id, label, and location only when visible text in the images confirms the match.",
          "If OCR text contradicts the catalog location, do not reuse the box_id. If no match is credible, leave suggestedBoxId empty.",
          "Always provide suggestedSummary (one sentence), 3–8 specific suggestedKeywords, and leave suggestedNotes empty unless genuinely uncertain.",
          "Reply ONLY with the JSON object."
        ].join(" "),
        photoRoleSystemPrompt: "You classify storage images. Reply ONLY with JSON. No text outside the JSON object.",
        photoRolePrompt: [
          "Classify this image. Choose one photoRole: label, location, inside, spread, detail.",
          "Use \"label\" only when a label or location tag is the clear main subject.",
          "Use \"inside\" or \"spread\" for content images even if a small label is visible.",
          "If unsure between \"label\" and \"inside\", choose \"inside\".",
          'Reply ONLY with JSON: {"photoRole":"inside"}'
        ].join(" "),
        publicAskSystemPrompt: [
          "You answer questions about where items are stored in a workshop or storage system.",
          "Use only the provided context. If matches are uncertain, say so.",
          "Do not invent boxes, locations, or contents.",
          "Keep answers short and natural.",
          "Answer in the same language as the question (Swedish, English, or German).",
          'Reply ONLY as JSON: {"answer":"..."}'
        ].join(" "),
        voiceAskSystemPrompt: [
          "You answer questions about where items are stored in a workshop or storage system.",
          "Use only the provided context. If uncertain, say so.",
          "Do not invent anything not in the context.",
          "Answer in 1–2 natural sentences suited for being read aloud.",
          "Answer in the same language as the question (Swedish, English, or German).",
          'Reply ONLY as JSON: {"answer":"..."}'
        ].join(" "),
        photoSummarySystemPrompt: "You analyze storage images. Reply ONLY with JSON. No text outside the JSON object.",
        photoSummaryPrompt: [
          "Describe what is visible in this image of a storage box. Be concrete and brief.",
          "Write your response in the language specified in the system prompt.",
          'Reply ONLY with JSON: {"summary":"..."}. No text outside the JSON.'
        ].join(" "),
        anthropicBoxSystemPrompt: "You analyze storage and workshop boxes. Reply ONLY with a JSON object. No text outside the JSON.",
        photoRoleSpecificPrompts: {
          label: {
            systemPrompt: "You analyze storage images. Reply ONLY with JSON. No text outside the JSON object.",
            prompt: [
              "Read all visible text in this image of a storage box label: label name, shelf code, location marker, handwritten notes.",
              "Describe what the label says and what kind of box this appears to be.",
              "Write your response in the language specified in the system prompt.",
              'Reply ONLY with JSON: {"summary":"..."}. No text outside the JSON.'
            ].join(" ")
          },
          location: {
            systemPrompt: "You analyze storage images. Reply ONLY with JSON. No text outside the JSON object.",
            prompt: [
              "Read all location identifiers in this image: shelf labels, row numbers, slot markers, rack codes.",
              "Describe where this box is located as precisely as possible.",
              "Write your response in the language specified in the system prompt.",
              'Reply ONLY with JSON: {"summary":"..."}. No text outside the JSON.'
            ].join(" ")
          },
          inside: {
            systemPrompt: "You analyze storage images. Reply ONLY with JSON. No text outside the JSON object.",
            prompt: [
              "List the visible objects inside this storage box: tools, components, cables, packages, materials. Be specific and concrete.",
              "Write your response in the language specified in the system prompt.",
              'Reply ONLY with JSON: {"summary":"..."}. No text outside the JSON.'
            ].join(" ")
          },
          spread: {
            systemPrompt: "You analyze storage images. Reply ONLY with JSON. No text outside the JSON object.",
            prompt: [
              "List all visible objects spread out in this image. Name each item specifically.",
              "Write your response in the language specified in the system prompt.",
              'Reply ONLY with JSON: {"summary":"..."}. No text outside the JSON.'
            ].join(" ")
          },
          detail: {
            systemPrompt: "You analyze storage images. Reply ONLY with JSON. No text outside the JSON object.",
            prompt: [
              "Describe what is shown in this detail image: item type, markings, model numbers, connectors, or condition. Be specific.",
              "Write your response in the language specified in the system prompt.",
              'Reply ONLY with JSON: {"summary":"..."}. No text outside the JSON.'
            ].join(" ")
          }
        }
      },
      "openrouter:qwen/qwen3-vl-32b-instruct": {
        boxAnalysisInstructions: [
          "/no_think You analyze photos of storage boxes and workshop boxes. Reply ONLY with a JSON object matching the given schema.",
          "Apply precise OCR to all visible text in every image: label text, handwritten notes, shelf codes, slot numbers, stickers, barcodes, and any text on objects inside the box.",
          "Also identify visible objects, tools, electronic components, cables (note connector types when readable), and materials — be as specific as possible.",
          "Assign a photoRole to each image: use \"label\" only when a label or location tag is clearly the main subject and its text is readable.",
          "Use \"inside\" or \"spread\" for content images even when a small edge label is incidentally visible.",
          "Use \"location\" when the image primarily shows the shelf or storage position.",
          "If unsure between \"label\" and \"inside\", choose \"inside\".",
          "A catalog of known boxes is provided. Reuse box_id, label, and location only when OCR-read text and visible markers confirm the catalog entry.",
          "If OCR reads a different shelf or slot than the catalog, do not reuse the box_id. If no catalog match is credible, leave suggestedBoxId empty.",
          "Always output: suggestedSummary (one precise sentence), 3–8 specific suggestedKeywords (prefer technical terms), suggestedNotes only when genuinely uncertain.",
          "Reply ONLY with the JSON object."
        ].join(" "),
        photoRoleSystemPrompt: "You classify storage images and reply ONLY with valid JSON. Do not include thinking, explanation, or any text outside the JSON object.",
        photoRolePrompt: [
          "/no_think Classify this image. Choose exactly one photoRole: label, location, inside, spread, or detail.",
          "Use \"label\" only when a label or location tag is clearly the main subject with readable text.",
          "Use \"inside\" or \"spread\" for content images even if a small label is visible.",
          "Use \"location\" when the image primarily shows the storage position.",
          "If unsure between \"label\" and \"inside\", choose \"inside\".",
          'Reply ONLY with JSON: {"photoRole":"inside"}'
        ].join(" "),
        publicAskSystemPrompt: [
          "/no_think You answer questions about where items are stored in a workshop or storage system.",
          "Use only the provided context. If matches are uncertain, say so clearly.",
          "Do not invent boxes, locations, or contents not in the context.",
          "Answer concisely in the same language as the question (Swedish, English, or German).",
          'Reply ONLY as JSON: {"answer":"..."}'
        ].join(" "),
        voiceAskSystemPrompt: [
          "/no_think You answer questions about where items are stored in a workshop or storage system.",
          "Use only the provided context. If uncertain, say so.",
          "Do not invent anything not in the context.",
          "Answer in 1–2 natural sentences suited for text-to-speech.",
          "Answer in the same language as the question (Swedish, English, or German).",
          'Reply ONLY as JSON: {"answer":"..."}'
        ].join(" "),
        photoSummarySystemPrompt: "You are a precise image analysis assistant with strong OCR capabilities. Reply ONLY with valid JSON. Do not include thinking, explanation, or any text outside the JSON object.",
        photoSummaryPrompt: [
          "/no_think Analyze this storage image. Describe what is visible concretely. Read any visible text using OCR.",
          "Write your response in the language specified in the system prompt.",
          'Reply ONLY with JSON: {"summary":"..."}'
        ].join(" "),
        anthropicBoxSystemPrompt: "You are a precise image analysis assistant with strong OCR capabilities. Reply ONLY with a JSON object. Do not include thinking, explanation, or any text outside the JSON.",
        photoRoleSpecificPrompts: {
          label: {
            systemPrompt: "You are a precise OCR and image analysis assistant. Reply ONLY with valid JSON. No thinking, explanation, or text outside the JSON.",
            prompt: [
              "/no_think Apply precise OCR to this storage box label image.",
              "Transcribe all readable text: label name, shelf code, location marker, handwritten notes, sticker text, any alphanumeric codes.",
              "Then describe what kind of box this appears to be based on what you read.",
              "Write your response in the language specified in the system prompt.",
              'Reply ONLY with JSON: {"summary":"..."}'
            ].join(" ")
          },
          location: {
            systemPrompt: "You are a precise OCR and image analysis assistant. Reply ONLY with valid JSON. No thinking, explanation, or text outside the JSON.",
            prompt: [
              "/no_think Read all location identifiers in this image using OCR: shelf labels, row numbers, slot markers, rack codes, position tags.",
              "Describe the storage location as precisely as the image allows.",
              "Write your response in the language specified in the system prompt.",
              'Reply ONLY with JSON: {"summary":"..."}'
            ].join(" ")
          },
          inside: {
            systemPrompt: "You are a precise image analysis assistant. Reply ONLY with valid JSON. No thinking, explanation, or text outside the JSON.",
            prompt: [
              "/no_think Identify all visible objects inside this storage box.",
              "Name each item specifically: tools (with type), electronic components (with type/connector), cables (with connector types if readable), packages, and materials.",
              "Also read any visible text on items using OCR.",
              "Write your response in the language specified in the system prompt.",
              'Reply ONLY with JSON: {"summary":"..."}'
            ].join(" ")
          },
          spread: {
            systemPrompt: "You are a precise image analysis assistant. Reply ONLY with valid JSON. No thinking, explanation, or text outside the JSON.",
            prompt: [
              "/no_think Identify all visible objects spread out in this image.",
              "Name each item with as much specificity as possible: type, subtype, connector types, visible markings. Read any text using OCR.",
              "Write your response in the language specified in the system prompt.",
              'Reply ONLY with JSON: {"summary":"..."}'
            ].join(" ")
          },
          detail: {
            systemPrompt: "You are a precise OCR and image analysis assistant. Reply ONLY with valid JSON. No thinking, explanation, or text outside the JSON.",
            prompt: [
              "/no_think Examine this detail image closely.",
              "Apply OCR to read any markings, model numbers, serial numbers, specifications, or codes.",
              "Describe the item type, its identifiable characteristics, and condition.",
              "Write your response in the language specified in the system prompt.",
              'Reply ONLY with JSON: {"summary":"..."}'
            ].join(" ")
          }
        }
      }
    },
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
      ...(input?.prompts ?? {}),
      photoRoleSpecificPrompts: {
        ...base.prompts.photoRoleSpecificPrompts,
        ...(input?.prompts?.photoRoleSpecificPrompts ?? {}),
        label: {
          ...base.prompts.photoRoleSpecificPrompts.label,
          ...(input?.prompts?.photoRoleSpecificPrompts?.label ?? {})
        },
        location: {
          ...base.prompts.photoRoleSpecificPrompts.location,
          ...(input?.prompts?.photoRoleSpecificPrompts?.location ?? {})
        },
        inside: {
          ...base.prompts.photoRoleSpecificPrompts.inside,
          ...(input?.prompts?.photoRoleSpecificPrompts?.inside ?? {})
        },
        spread: {
          ...base.prompts.photoRoleSpecificPrompts.spread,
          ...(input?.prompts?.photoRoleSpecificPrompts?.spread ?? {})
        },
        detail: {
          ...base.prompts.photoRoleSpecificPrompts.detail,
          ...(input?.prompts?.photoRoleSpecificPrompts?.detail ?? {})
        }
      }
    },
    modelPrompts: {
      ...base.modelPrompts,
      ...(input?.modelPrompts ?? {})
    },
    security: {
      ...base.security,
      ...(input?.security ?? {})
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
