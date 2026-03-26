"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AiProvider,
  AppSettings,
  AvailableAlbum,
  AvailableModel,
  FontFamilyChoice,
  ThemePreference
} from "@/lib/types";

type SettingsFormProps = {
  initialSettings: AppSettings;
  initialModels: AvailableModel[];
  initialAlbums: AvailableAlbum[];
};

const themeOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: "auto", label: "Auto (systemet)" },
  { value: "light", label: "Ljust" },
  { value: "dark", label: "Mörkt" }
];

const fontOptions: Array<{ value: FontFamilyChoice; label: string; preview: string }> = [
  { value: "arial", label: "Arial", preview: "Ren och lättläst" },
  { value: "system", label: "System UI", preview: "Neutral och modern" },
  { value: "verdana", label: "Verdana", preview: "Tydlig på små skärmar" },
  { value: "trebuchet", label: "Trebuchet", preview: "Mjuk och luftig" },
  { value: "georgia", label: "Georgia", preview: "Mer klassisk känsla" }
];

const providerOptions: Array<{ value: AiProvider; label: string }> = [
  { value: "lmstudio", label: "LM Studio" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "openwebui", label: "Open WebUI" }
];

export function SettingsForm({ initialSettings, initialModels, initialAlbums }: SettingsFormProps) {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [models, setModels] = useState<AvailableModel[]>(initialModels);
  const [albums, setAlbums] = useState<AvailableAlbum[]>(initialAlbums);
  const [status, setStatus] = useState("");
  const [modelsStatus, setModelsStatus] = useState(initialModels.length > 0 ? "" : "Ingen modellista laddad ännu.");
  const [albumsStatus, setAlbumsStatus] = useState(initialAlbums.length > 0 ? "" : "Ingen albumlista laddad ännu.");
  const [backupStatus, setBackupStatus] = useState("");
  const [catalogImportStatus, setCatalogImportStatus] = useState("");
  const [isSaving, startSaving] = useTransition();
  const [isLoadingModels, startLoadingModels] = useTransition();
  const [isLoadingAlbums, startLoadingAlbums] = useTransition();
  const [isImportingBackup, startImportingBackup] = useTransition();
  const [isImportingCatalog, startImportingCatalog] = useTransition();
  const backupFileRef = useRef<HTMLInputElement | null>(null);
  const catalogFileRef = useRef<HTMLInputElement | null>(null);

  const activeConnection = useMemo(() => {
    if (settings.ai.provider === "openai") return settings.ai.openai;
    if (settings.ai.provider === "anthropic") return settings.ai.anthropic;
    if (settings.ai.provider === "openrouter") return settings.ai.openrouter;
    if (settings.ai.provider === "openwebui") return settings.ai.openwebui;
    return settings.ai.lmstudio;
  }, [settings]);

  const sortedModels = useMemo(
    () => [...models].sort((a, b) => a.label.localeCompare(b.label, "sv", { sensitivity: "base" })),
    [models]
  );

  function patchAppearance<K extends keyof AppSettings["appearance"]>(key: K, value: AppSettings["appearance"][K]) {
    setSettings((current) => ({
      ...current,
      appearance: {
        ...current.appearance,
        [key]: value
      }
    }));
  }

  function patchAiSection(
    section: "lmstudio" | "openai" | "anthropic" | "openrouter" | "openwebui",
    updates: Record<string, string | number | undefined>
  ) {
    setSettings((current) => ({
      ...current,
      ai: {
        ...current.ai,
        [section]: {
          ...current.ai[section],
          ...updates
        }
      }
    }));
  }

  function patchImmich(updates: Partial<AppSettings["immich"]>) {
    setSettings((current) => ({
      ...current,
      immich: {
        ...current.immich,
        ...updates
      }
    }));
  }

  async function refreshModels() {
    setModelsStatus("Hämtar modeller...");
    startLoadingModels(async () => {
      try {
        const response = await fetch("/api/settings/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: settings.ai.provider,
            baseUrl: activeConnection.baseUrl,
            apiKey: activeConnection.apiKey ?? ""
          })
        });

        const json = (await response.json()) as { models?: AvailableModel[]; error?: string };
        if (!response.ok) {
          throw new Error(json.error || "Kunde inte läsa modellistan.");
        }

        setModels(json.models ?? []);
        setModelsStatus(json.models?.length ? `Hittade ${json.models.length} modeller.` : "Inga modeller hittades.");
      } catch (error) {
        setModels([]);
        setModelsStatus(error instanceof Error ? error.message : "Kunde inte läsa modellistan.");
      }
    });
  }

  async function refreshAlbums() {
    setAlbumsStatus("Hämtar album...");
    startLoadingAlbums(async () => {
      try {
        const response = await fetch("/api/settings/albums", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: settings.immich.baseUrl,
            accessMode: settings.immich.accessMode,
            apiKey: settings.immich.apiKey ?? "",
            shareKey: settings.immich.shareKey ?? "",
            currentAlbumId: settings.immich.albumId
          })
        });

        const json = (await response.json()) as { albums?: AvailableAlbum[]; error?: string };
        if (!response.ok) {
          throw new Error(json.error || "Kunde inte läsa albumlistan.");
        }

        setAlbums(json.albums ?? []);
        setAlbumsStatus(json.albums?.length ? `Hittade ${json.albums.length} album.` : "Inga album hittades.");
      } catch (error) {
        setAlbums([]);
        setAlbumsStatus(error instanceof Error ? error.message : "Kunde inte läsa albumlistan.");
      }
    });
  }

  async function saveSettings() {
    setStatus("Sparar inställningar...");
    startSaving(async () => {
      try {
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings)
        });

        const json = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !json.ok) {
          throw new Error(json.error || "Kunde inte spara inställningarna.");
        }

        setStatus("Inställningarna sparades.");
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Kunde inte spara inställningarna.");
      }
    });
  }

  async function importBackup(file: File) {
    setBackupStatus(`Läser in ${file.name}...`);

    startImportingBackup(async () => {
      try {
        const response = await fetch("/api/settings/backup", {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file
        });

        const json = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !json.ok) {
          throw new Error(json.error || "Kunde inte läsa in backupen.");
        }

        setBackupStatus("Backupen lästes in.");
        backupFileRef.current && (backupFileRef.current.value = "");
        router.refresh();
      } catch (error) {
        setBackupStatus(error instanceof Error ? error.message : "Kunde inte läsa in backupen.");
      }
    });
  }

  async function importCatalog(file: File) {
    setCatalogImportStatus(`Importerar ${file.name}...`);

    startImportingCatalog(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/settings/import-catalog", {
          method: "POST",
          body: formData
        });

        const json = (await response.json()) as {
          ok?: boolean;
          error?: string;
          summary?: {
            catalog_rows: number;
            created_boxes: number;
            updated_boxes: number;
            created_sessions: number;
            updated_sessions: number;
          };
        };
        if (!response.ok || !json.ok || !json.summary) {
          throw new Error(json.error || "Kunde inte importera katalogen.");
        }

        setCatalogImportStatus(
          `Import klar: ${json.summary.catalog_rows} rader, ${json.summary.created_boxes} nya lådor, ${json.summary.updated_boxes} uppdaterade lådor, ${json.summary.created_sessions} nya sessioner och ${json.summary.updated_sessions} uppdaterade sessioner.`
        );
        if (catalogFileRef.current) {
          catalogFileRef.current.value = "";
        }
        router.refresh();
      } catch (error) {
        setCatalogImportStatus(error instanceof Error ? error.message : "Kunde inte importera katalogen.");
      }
    });
  }

  function renderSaveRow(label = "Spara inställningar") {
    return (
      <div className="action-row">
        <button type="button" onClick={saveSettings} disabled={isSaving}>
          {isSaving ? "Sparar..." : label}
        </button>
        <span className="muted">{status}</span>
      </div>
    );
  }

  return (
    <div className="shell">
      <section className="panel shell">
        <div>
          <h2>Utseende</h2>
          <p>Välj tema, font och läsbarhet för hela appen.</p>
        </div>

        <div className="grid two">
          <label>
            Tema
            <select
              value={settings.appearance.theme}
              onChange={(event) => patchAppearance("theme", event.target.value as ThemePreference)}
            >
              {themeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Fontstorlek
            <input
              type="number"
              min={8}
              max={28}
              step={0.5}
              value={settings.appearance.fontSizePt}
              onChange={(event) => patchAppearance("fontSizePt", Number(event.target.value || 12))}
              placeholder="12"
            />
          </label>
        </div>

        <div className="grid two">
          {fontOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`font-choice${settings.appearance.fontFamily === option.value ? " active" : ""}`}
              onClick={() => patchAppearance("fontFamily", option.value)}
            >
              <strong>{option.label}</strong>
              <span>{option.preview}</span>
            </button>
          ))}
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.appearance.reduceMotion}
            onChange={(event) => patchAppearance("reduceMotion", event.target.checked)}
          />
          <span>Minska animationer och övergångar</span>
        </label>

        {renderSaveRow("Spara utseende")}
      </section>

      <section className="panel shell">
        <div>
          <h2>Immich</h2>
          <p>Byt konto, åtkomstmetod och vilket album som appen ska inventera från.</p>
        </div>

        <div className="grid two">
          <label>
            Kontoetikett
            <input
              value={settings.immich.accountLabel}
              onChange={(event) => patchImmich({ accountLabel: event.target.value })}
              placeholder="Till exempel Mimer eller Lager"
            />
          </label>

          <label>
            Bas-URL
            <input
              value={settings.immich.baseUrl}
              onChange={(event) => patchImmich({ baseUrl: event.target.value })}
              placeholder="https://photos.snille.net"
            />
          </label>
        </div>

        <div className="grid two">
          <label>
            Åtkomstmetod
            <select
              value={settings.immich.accessMode}
              onChange={(event) =>
                patchImmich({
                  accessMode: event.target.value === "shareKey" ? "shareKey" : "apiKey"
                })
              }
            >
              <option value="apiKey">API-nyckel</option>
              <option value="shareKey">Delningsnyckel</option>
            </select>
          </label>

          {settings.immich.accessMode === "apiKey" ? (
            <label>
              Immich API-nyckel
              <input
                type="password"
                value={settings.immich.apiKey ?? ""}
                onChange={(event) => patchImmich({ apiKey: event.target.value })}
                placeholder="Användarnyckel för att läsa och senare skriva metadata"
              />
            </label>
          ) : (
            <label>
              Delningsnyckel
              <input
                value={settings.immich.shareKey ?? ""}
                onChange={(event) => patchImmich({ shareKey: event.target.value })}
                placeholder="Nyckel från delad Immich-länk"
              />
            </label>
          )}
        </div>

        <div className="grid two">
          <label>
            Album
            <select
              value={settings.immich.albumId}
              onChange={(event) => patchImmich({ albumId: event.target.value })}
            >
              <option value="">Välj album eller läs in listan</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.label} ({album.assetCount} bilder)
                </option>
              ))}
            </select>
          </label>

          <label>
            Album-ID
            <input
              value={settings.immich.albumId}
              onChange={(event) => patchImmich({ albumId: event.target.value })}
              placeholder="Klistra in album-ID om du vill"
            />
          </label>
        </div>

        <div className="action-row">
          <button type="button" onClick={refreshAlbums} disabled={isLoadingAlbums}>
            {isLoadingAlbums ? "Hämtar album..." : "Läs in album"}
          </button>
          <span className="muted">{albumsStatus}</span>
        </div>

        {albums.length > 0 ? (
          <div className="grid two">
            {albums.slice(0, 8).map((album) => (
              <button
                key={album.id}
                type="button"
                className={`font-choice${settings.immich.albumId === album.id ? " active" : ""}`}
                onClick={() => patchImmich({ albumId: album.id })}
              >
                <strong>{album.label}</strong>
                <span>{album.assetCount} bilder</span>
                <span>{album.ownerName ? `Ägare: ${album.ownerName}` : album.id}</span>
              </button>
            ))}
          </div>
        ) : null}

        {renderSaveRow("Spara Immich")}
      </section>

      <section className="panel shell">
        <div>
          <h2>AI-motor</h2>
          <p>Här väljer du provider, endpoint och modell för bildanalys.</p>
        </div>

        <div className="grid two">
          <label>
            Provider
            <select
              value={settings.ai.provider}
              onChange={(event) => setSettings((current) => ({
                ...current,
                ai: {
                  ...current.ai,
                  provider: event.target.value as AiProvider
                }
              }))}
            >
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Modell (sökbar lista)
            <input
              list="available-models"
              value={activeConnection.model}
              onChange={(event) => patchAiSection(settings.ai.provider, { model: event.target.value })}
              placeholder="Börja skriva för att söka modell..."
            />
            <datalist id="available-models">
              {sortedModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </datalist>
          </label>
        </div>

        <div className="grid two">
          <label>
            Bas-URL
            <input
              value={activeConnection.baseUrl}
              onChange={(event) => patchAiSection(settings.ai.provider, { baseUrl: event.target.value })}
              placeholder={
                settings.ai.provider === "lmstudio"
                  ? "http://mgc.snille.net:1234/v1"
                  : settings.ai.provider === "openai"
                    ? "https://api.openai.com/v1"
                    : settings.ai.provider === "openrouter"
                      ? "https://openrouter.ai/api/v1"
                      : settings.ai.provider === "openwebui"
                        ? "http://llm.snille.net:8080/api"
                        : "https://api.anthropic.com"
              }
            />
          </label>

          <label>
            Modell-ID
            <input
              value={activeConnection.model}
              onChange={(event) => patchAiSection(settings.ai.provider, { model: event.target.value })}
              placeholder="Till exempel qwen/qwen3.5-35b-a3b"
            />
          </label>
        </div>

        <div className="grid two">
          <label>
            API-nyckel
            <input
              type="password"
              value={activeConnection.apiKey ?? ""}
              onChange={(event) => patchAiSection(settings.ai.provider, { apiKey: event.target.value })}
              placeholder="Valfritt för LM Studio, krävs för moln-API"
            />
          </label>

          {settings.ai.provider === "lmstudio" ? (
            <label>
              Context length
              <input
                type="number"
                value={settings.ai.lmstudio.contextLength ?? ""}
                onChange={(event) =>
                  patchAiSection("lmstudio", {
                    contextLength: event.target.value ? Number(event.target.value) : undefined
                  })
                }
                placeholder="150082"
              />
            </label>
          ) : (
            <div className="panel-quiet">
              <strong>Tips</strong>
              <p className="muted">
                OpenAI, Anthropic, OpenRouter och Open WebUI använder sina egna modellistor. LM Studio hämtar modeller från din lokala server.
              </p>
            </div>
          )}
        </div>

        <div className="action-row">
          <button type="button" onClick={refreshModels} disabled={isLoadingModels}>
            {isLoadingModels ? "Hämtar modeller..." : "Läs in modeller"}
          </button>
          <span className="muted">{modelsStatus}</span>
        </div>

        {renderSaveRow("Spara AI-motor")}
      </section>

      <section className="panel shell">
        <div>
          <h2>Backup</h2>
          <p>Ladda ner backup eller exportera katalogen till Excel från samma ställe.</p>
        </div>

        <div className="action-row">
          <a className="button" href="/api/settings/backup">
            Ladda ner backup
          </a>
          <a className="button" href="/api/settings/export-catalog">
            Exportera Excel
          </a>
        </div>

        <div className="grid two">
          <label>
            Läs in backupfil
            <input
              ref={backupFileRef}
              type="file"
              accept="application/json,.json,application/zip,.zip"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importBackup(file);
                }
              }}
            />
          </label>
          <label>
            Importera katalog
            <input
              ref={catalogFileRef}
              type="file"
              accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importCatalog(file);
                }
              }}
            />
          </label>
        </div>

        <div className="grid two">
          <div className="panel-quiet">
            <strong>Backup och export</strong>
            <p className="muted" style={{ marginTop: 8 }}>
              Backupen innehåller inventariet, sessionshistorik, analystexter, etikettmallar och övriga appinställningar i en zip-fil. Excel-exporten ger en läsbar katalog med lådor, platser, sammanfattningar och nyckelord.
            </p>
          </div>
          <div className="panel-quiet">
            <strong>Excel-import</strong>
            <p className="muted" style={{ marginTop: 8 }}>
              Importen utgår från appens nuvarande exportformat. Den uppdaterar lådor och aktuella sessioner från filen, men låter kopplade bilder ligga kvar i inventariet.
            </p>
          </div>
        </div>

        <div className="action-row">
          <span className="muted">{isImportingBackup ? "Läser in backup..." : backupStatus}</span>
        </div>
        <div className="action-row">
          <span className="muted">{isImportingCatalog ? "Importerar Excel..." : catalogImportStatus}</span>
        </div>
      </section>

      <section className="panel shell">
        <div>
          <h2>Promptar</h2>
          <p>Här kan du finjustera hur modellen instrueras. Det är särskilt användbart när du testar nya modeller.</p>
        </div>

        <label>
          Lådanalys: huvudinstruktion
          <textarea
            value={settings.prompts.boxAnalysisInstructions}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                prompts: {
                  ...current.prompts,
                  boxAnalysisInstructions: event.target.value
                }
              }))
            }
          />
        </label>

        <div className="grid two">
          <label>
            Bildroll: systemprompt
            <textarea
              value={settings.prompts.photoRoleSystemPrompt}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  prompts: {
                    ...current.prompts,
                    photoRoleSystemPrompt: event.target.value
                  }
                }))
              }
            />
          </label>

          <label>
            Bildroll: användarprompt
            <textarea
              value={settings.prompts.photoRolePrompt}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  prompts: {
                    ...current.prompts,
                    photoRolePrompt: event.target.value
                  }
                }))
              }
            />
          </label>
        </div>

        <div className="grid two">
          <label>
            Bildspecifik analys: systemprompt
            <textarea
              value={settings.prompts.photoSummarySystemPrompt}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  prompts: {
                    ...current.prompts,
                    photoSummarySystemPrompt: event.target.value
                  }
                }))
              }
            />
          </label>

          <label>
            Bildspecifik analys: användarprompt
            <textarea
              value={settings.prompts.photoSummaryPrompt}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  prompts: {
                    ...current.prompts,
                    photoSummaryPrompt: event.target.value
                  }
                }))
              }
            />
          </label>
        </div>

        <label>
          Anthropic: systemprompt för lådanalys
          <textarea
            value={settings.prompts.anthropicBoxSystemPrompt}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                prompts: {
                  ...current.prompts,
                  anthropicBoxSystemPrompt: event.target.value
                }
              }))
            }
          />
        </label>

        <div className="grid two">
          <label>
            Rensningsfraser: sammanfattning (en per rad)
            <textarea
              value={settings.prompts.summaryCleanupPrefixes}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  prompts: {
                    ...current.prompts,
                    summaryCleanupPrefixes: event.target.value
                  }
                }))
              }
            />
          </label>

          <label>
            Rensningsord: sökord (en per rad)
            <textarea
              value={settings.prompts.keywordCleanupTerms}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  prompts: {
                    ...current.prompts,
                    keywordCleanupTerms: event.target.value
                  }
                }))
              }
            />
          </label>
        </div>

        <div className="grid two">
          <label>
            Rensningsfraser: noteringar (en per rad)
            <textarea
              value={settings.prompts.notesCleanupPhrases}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  prompts: {
                    ...current.prompts,
                    notesCleanupPhrases: event.target.value
                  }
                }))
              }
            />
          </label>

          <label>
            Rensningsfraser: bildtext (en per rad)
            <textarea
              value={settings.prompts.photoSummaryCleanupPhrases}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  prompts: {
                    ...current.prompts,
                    photoSummaryCleanupPhrases: event.target.value
                  }
                }))
              }
            />
          </label>
        </div>

        {renderSaveRow("Spara promptar")}
      </section>

      {renderSaveRow("Spara alla inställningar")}
    </div>
  );
}
