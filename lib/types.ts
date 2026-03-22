export type PhotoRole = "label" | "location" | "inside" | "spread" | "detail";
export type ThemePreference = "auto" | "light" | "dark";
export type FontFamilyChoice = "arial" | "georgia" | "verdana" | "trebuchet" | "system";
export type AiProvider = "lmstudio" | "openai" | "anthropic" | "openrouter";
export type ImmichAccessMode = "apiKey" | "shareKey";
export type LabelTextAlign = "left" | "center";
export type LabelPlaceDisplay = "chips" | "singleLine";
export type LabelFontFamily = "arial" | "verdana" | "trebuchet" | "georgia" | "system";
export type LabelFieldKey = "title" | "description" | "place";
export type LabelFieldRotation = -90 | 0 | 90;
export type LabelOrientation = "portrait" | "landscape";

export type LabelFieldLayout = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fontSizePt: number;
  fontFamily: LabelFontFamily;
  fontWeight: 400 | 700;
  textAlign: LabelTextAlign;
  rotationDeg: LabelFieldRotation;
  visible: boolean;
};

export type BoxRecord = {
  boxId: string;
  label: string;
  currentLocationId: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type SessionRecord = {
  sessionId: string;
  boxId: string;
  createdAt: string;
  summary: string;
  itemKeywords: string[];
  notes?: string;
  isCurrent: boolean;
};

export type PhotoRecord = {
  photoId: string;
  sessionId: string;
  immichAssetId: string;
  photoRole: PhotoRole;
  capturedAt?: string;
  notes?: string;
};

export type InventoryData = {
  boxes: BoxRecord[];
  sessions: SessionRecord[];
  photos: PhotoRecord[];
};

export type ImmichAsset = {
  id: string;
  originalFileName: string;
  type: string;
  fileCreatedAt: string;
  localDateTime: string;
  originalMimeType: string;
  width?: number;
  height?: number;
};

export type AnalysisSuggestion = {
  sessionId: string;
  suggestedBoxId: string;
  suggestedLabel: string;
  suggestedLocationId: string;
  suggestedSummary: string;
  suggestedKeywords: string[];
  suggestedNotes?: string;
  suggestedPhotos: Array<{
    immichAssetId: string;
    photoRole: PhotoRole;
    capturedAt?: string;
  }>;
  confidence: "low" | "medium" | "high";
  source: "fallback" | "openai" | "lmstudio" | "anthropic" | "openrouter";
  matchCandidates: Array<{
    boxId: string;
    label: string;
    currentLocationId: string;
    summary: string;
    score: number;
    reasons: string[];
  }>;
};

export type AppearanceSettings = {
  theme: ThemePreference;
  fontFamily: FontFamilyChoice;
  fontSizePt: number;
  reduceMotion: boolean;
};

export type LmStudioSettings = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  contextLength?: number;
};

export type OpenAiSettings = {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export type AnthropicSettings = {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export type OpenRouterSettings = {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export type AiSettings = {
  provider: AiProvider;
  lmstudio: LmStudioSettings;
  openai: OpenAiSettings;
  anthropic: AnthropicSettings;
  openrouter: OpenRouterSettings;
};

export type PromptSettings = {
  boxAnalysisInstructions: string;
  photoRolePrompt: string;
  photoRoleSystemPrompt: string;
  photoSummaryPrompt: string;
  photoSummarySystemPrompt: string;
  anthropicBoxSystemPrompt: string;
};

export type LabelTemplate = {
  id: string;
  name: string;
  mediaKey: string;
  mediaLabel: string;
  orientation: LabelOrientation;
  widthMm: number;
  heightMm: number;
  pageWidthPt: number;
  pageHeightPt: number;
  paddingMm: number;
  placeDisplay: LabelPlaceDisplay;
  snapToGrid: boolean;
  gridMm: number;
  fields: {
    title: LabelFieldLayout;
    description: LabelFieldLayout;
    place: LabelFieldLayout;
  };
};

export type LabelSettings = {
  defaultTemplateId: string;
  templates: LabelTemplate[];
};

export type AppSettings = {
  appearance: AppearanceSettings;
  immich: ImmichSettings;
  ai: AiSettings;
  prompts: PromptSettings;
  labels: LabelSettings;
};

export type AvailableModel = {
  id: string;
  label: string;
};

export type ImmichSettings = {
  baseUrl: string;
  accountLabel: string;
  accessMode: ImmichAccessMode;
  apiKey?: string;
  shareKey?: string;
  albumId: string;
};

export type AvailableAlbum = {
  id: string;
  label: string;
  assetCount: number;
  ownerName?: string;
  shared?: boolean;
};
