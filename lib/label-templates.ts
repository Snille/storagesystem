import type { LabelFieldLayout, LabelOrientation, LabelSettings, LabelTemplate } from "@/lib/types";

export type LabelMediaPreset = {
  mediaKey: string;
  mediaLabel: string;
  orientation: LabelOrientation;
  widthMm: number;
  heightMm: number;
  pageWidthPt: number;
  pageHeightPt: number;
  dymoSku?: string;
};

export const LABEL_MEDIA_PRESETS: LabelMediaPreset[] = [
  {
    mediaKey: "w54h144",
    mediaLabel: "S0722550 Multi-purpose, 51 x 19 mm",
    orientation: "portrait",
    widthMm: 19,
    heightMm: 51,
    pageWidthPt: 54,
    pageHeightPt: 144,
    dymoSku: "S0722550"
  },
  {
    mediaKey: "w72h154",
    mediaLabel: "S0722520 Large Return Address, 54 x 25 mm",
    orientation: "portrait",
    widthMm: 25,
    heightMm: 54,
    pageWidthPt: 72,
    pageHeightPt: 154,
    dymoSku: "S0722520"
  },
  {
    mediaKey: "w162h90",
    mediaLabel: "S0722540 Multi-purpose, 57 x 32 mm",
    orientation: "landscape",
    widthMm: 57,
    heightMm: 32,
    pageWidthPt: 162,
    pageHeightPt: 90,
    dymoSku: "S0722540"
  },
  {
    mediaKey: "w79h252",
    mediaLabel: "30252 Address, 89 x 28 mm",
    orientation: "landscape",
    widthMm: 89,
    heightMm: 28,
    pageWidthPt: 252,
    pageHeightPt: 79
  },
  {
    mediaKey: "w102h252",
    mediaLabel: "30321 Large Address, 89 x 36 mm",
    orientation: "landscape",
    widthMm: 89,
    heightMm: 36,
    pageWidthPt: 252,
    pageHeightPt: 102
  },
  {
    mediaKey: "w154h286",
    mediaLabel: "S0722430 Shipping / Name Badge, 101 x 54 mm",
    orientation: "portrait",
    widthMm: 54,
    heightMm: 101,
    pageWidthPt: 154,
    pageHeightPt: 286,
    dymoSku: "S0722430"
  }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createFieldLayout(
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  fontSizePt: number,
  options?: Partial<LabelFieldLayout>
): LabelFieldLayout {
  return {
    xMm,
    yMm,
    widthMm,
    heightMm,
    fontSizePt,
    fontFamily: "arial",
    fontWeight: 400,
    textAlign: "left",
    rotationDeg: 0,
    visible: true,
    ...options
  };
}

function buildTemplate(
  id: string,
  name: string,
  preset: LabelMediaPreset,
  fields: LabelTemplate["fields"],
  overrides: Partial<LabelTemplate> = {}
): LabelTemplate {
  return {
    id,
    name,
    mediaKey: preset.mediaKey,
    mediaLabel: preset.mediaLabel,
    orientation: preset.orientation,
    widthMm: preset.widthMm,
    heightMm: preset.heightMm,
    pageWidthPt: preset.pageWidthPt,
    pageHeightPt: preset.pageHeightPt,
    paddingMm: 2.5,
    placeDisplay: "chips",
    snapToGrid: true,
    gridMm: 1,
    fields,
    ...overrides
  };
}

export function getDefaultLabelSettings(): LabelSettings {
  const small = LABEL_MEDIA_PRESETS[0];
  const returnAddress = LABEL_MEDIA_PRESETS[1];
  const standard = LABEL_MEDIA_PRESETS[2];
  const address = LABEL_MEDIA_PRESETS[3];
  const badge = LABEL_MEDIA_PRESETS[5];

  return {
    defaultTemplateId: "standard-11354",
    templates: [
      buildTemplate(
        "standard-11354",
        "Standardlåda",
        standard,
        {
          title: createFieldLayout(3, 3, 51, 7, 16, { fontWeight: 700, textAlign: "center" }),
          description: createFieldLayout(4, 12.5, 49, 11, 8, { textAlign: "center" }),
          place: createFieldLayout(3, 25.5, 51, 4.5, 11, { fontWeight: 700, textAlign: "center" })
        },
        { placeDisplay: "chips" }
      ),
      buildTemplate(
        "smal-19x51",
        "Smal etikett",
        small,
        {
          title: createFieldLayout(2, 2, 15, 7, 10, { fontWeight: 700, textAlign: "center" }),
          description: createFieldLayout(2, 11, 15, 28, 7, { textAlign: "center" }),
          place: createFieldLayout(2, 42, 15, 6, 8, { fontWeight: 700, textAlign: "center", rotationDeg: 90 })
        },
        { placeDisplay: "singleLine" }
      ),
      buildTemplate(
        "retur-54x25",
        "Returadress",
        returnAddress,
        {
          title: createFieldLayout(2.5, 2.5, 20, 7, 12, { fontWeight: 700, textAlign: "center" }),
          description: createFieldLayout(2.5, 11.5, 20, 22, 7, { textAlign: "center" }),
          place: createFieldLayout(2.5, 38, 20, 12, 8, { fontWeight: 700, textAlign: "center" })
        },
        { placeDisplay: "singleLine" }
      ),
      buildTemplate(
        "adress-89x28",
        "Adress / bred låg",
        address,
        {
          title: createFieldLayout(3, 3, 83, 6, 15, { fontWeight: 700, textAlign: "left" }),
          description: createFieldLayout(3, 10, 83, 8.5, 8, { textAlign: "left" }),
          place: createFieldLayout(3, 21.5, 83, 3.5, 10, { fontWeight: 700, textAlign: "left" })
        },
        { placeDisplay: "singleLine" }
      ),
      buildTemplate(
        "badge-101x54",
        "Frakt / Namnbricka",
        badge,
        {
          title: createFieldLayout(4, 6, 46, 12, 18, { fontWeight: 700, textAlign: "center" }),
          description: createFieldLayout(4, 22, 46, 48, 9, { textAlign: "center" }),
          place: createFieldLayout(4, 83, 46, 10, 11, { fontWeight: 700, textAlign: "center" })
        },
        { placeDisplay: "singleLine" }
      )
    ]
  };
}

export function findLabelMediaPreset(mediaKey: string) {
  return LABEL_MEDIA_PRESETS.find((preset) => preset.mediaKey === mediaKey) ?? LABEL_MEDIA_PRESETS[2];
}

export function findLabelMediaPresetBySku(dymoSku: string) {
  return LABEL_MEDIA_PRESETS.find((preset) => preset.dymoSku?.toLowerCase() === dymoSku.trim().toLowerCase());
}

function normalizeField(field: LabelFieldLayout, template: LabelTemplate): LabelFieldLayout {
  return {
    xMm: clamp(field.xMm || 0, 0, template.widthMm),
    yMm: clamp(field.yMm || 0, 0, template.heightMm),
    widthMm: clamp(field.widthMm || template.widthMm - template.paddingMm * 2, 6, template.widthMm),
    heightMm: clamp(field.heightMm || 6, 2.5, template.heightMm),
    fontSizePt: clamp(field.fontSizePt || 10, 6, 28),
    fontFamily:
      field.fontFamily === "georgia" ||
      field.fontFamily === "verdana" ||
      field.fontFamily === "trebuchet" ||
      field.fontFamily === "system"
        ? field.fontFamily
        : "arial",
    fontWeight: field.fontWeight === 700 ? 700 : 400,
    textAlign: field.textAlign === "center" ? "center" : "left",
    rotationDeg: field.rotationDeg === 90 || field.rotationDeg === -90 ? field.rotationDeg : 0,
    visible: Boolean(field.visible)
  };
}

export function normalizeLabelTemplate(template: LabelTemplate): LabelTemplate {
  const preset = findLabelMediaPreset(template.mediaKey);
  const normalizedBase: LabelTemplate = {
    ...template,
    mediaKey: preset.mediaKey,
    mediaLabel: preset.mediaLabel,
    orientation: preset.orientation,
    widthMm: preset.widthMm,
    heightMm: preset.heightMm,
    pageWidthPt: preset.pageWidthPt,
    pageHeightPt: preset.pageHeightPt,
    paddingMm: clamp(template.paddingMm || 2.5, 1, 8),
    placeDisplay: template.placeDisplay === "singleLine" ? "singleLine" : "chips",
    snapToGrid: template.snapToGrid !== false,
    gridMm: clamp(template.gridMm || 1, 0.5, 10),
    fields: template.fields
  };

  return {
    ...normalizedBase,
    fields: {
      title: normalizeField(template.fields.title, normalizedBase),
      description: normalizeField(template.fields.description, normalizedBase),
      place: normalizeField(template.fields.place, normalizedBase)
    }
  };
}

export function normalizeLabelSettings(settings: LabelSettings): LabelSettings {
  const fallback = getDefaultLabelSettings();
  const templates =
    settings.templates.length > 0 ? settings.templates.map(normalizeLabelTemplate) : fallback.templates.map(normalizeLabelTemplate);
  const defaultTemplateId =
    templates.find((template) => template.id === settings.defaultTemplateId)?.id ??
    templates.find((template) => template.id === fallback.defaultTemplateId)?.id ??
    templates[0]?.id ??
    "";

  return {
    defaultTemplateId,
    templates
  };
}
