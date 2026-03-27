"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AiProvider,
  AppSettings,
  AvailableAlbum,
  AvailableModel,
  AvailablePrinter,
  FontFamilyChoice,
  LanguageOption,
  ThemePreference
} from "@/lib/types";

type SettingsFormProps = {
  initialSettings: AppSettings;
  initialModels: AvailableModel[];
  initialAlbums: AvailableAlbum[];
  initialPrinters: AvailablePrinter[];
  languageOptions: LanguageOption[];
  ui: Record<string, string>;
};

const providerOptions: Array<{ value: AiProvider; label: string }> = [
  { value: "lmstudio", label: "LM Studio" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "openwebui", label: "Open WebUI" }
];

export function SettingsForm({
  initialSettings,
  initialModels,
  initialAlbums,
  initialPrinters,
  languageOptions,
  ui
}: SettingsFormProps) {
  const router = useRouter();
  const t = (key: string, fallback: string, values?: Record<string, string | number>) => {
    const template = ui[key] ?? fallback;
    return template.replace(/\{(\w+)\}/g, (_, token: string) => String(values?.[token] ?? `{${token}}`));
  };
  const themeOptions: Array<{ value: ThemePreference; label: string }> = [
    { value: "auto", label: t("settings.theme.auto", "Auto (systemet)") },
    { value: "light", label: t("settings.theme.light", "Ljust") },
    { value: "dark", label: t("settings.theme.dark", "Mörkt") }
  ];
  const fontOptions: Array<{ value: FontFamilyChoice; label: string; preview: string }> = [
    { value: "arial", label: t("font.arial.label", "Arial"), preview: t("font.arial.preview", "Ren och lättläst") },
    { value: "system", label: t("font.system.label", "System UI"), preview: t("font.system.preview", "Neutral och modern") },
    { value: "verdana", label: t("font.verdana.label", "Verdana"), preview: t("font.verdana.preview", "Tydlig på små skärmar") },
    { value: "trebuchet", label: t("font.trebuchet.label", "Trebuchet"), preview: t("font.trebuchet.preview", "Mjuk och luftig") },
    { value: "georgia", label: t("font.georgia.label", "Georgia"), preview: t("font.georgia.preview", "Mer klassisk känsla") }
  ];
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [models, setModels] = useState<AvailableModel[]>(initialModels);
  const [albums, setAlbums] = useState<AvailableAlbum[]>(initialAlbums);
  const [printers, setPrinters] = useState<AvailablePrinter[]>(initialPrinters);
  const [status, setStatus] = useState("");
  const [modelsStatus, setModelsStatus] = useState(initialModels.length > 0 ? "" : t("settings.status.noModels", "Ingen modellista laddad ännu."));
  const [albumsStatus, setAlbumsStatus] = useState(initialAlbums.length > 0 ? "" : t("settings.status.noAlbums", "Ingen albumlista laddad ännu."));
  const [printersStatus, setPrintersStatus] = useState(
    initialPrinters.length > 0 ? "" : t("settings.status.noPrinters", "Ingen skrivarkö lästes in ännu.")
  );
  const [backupStatus, setBackupStatus] = useState("");
  const [catalogImportStatus, setCatalogImportStatus] = useState("");
  const [selectedBackupFileName, setSelectedBackupFileName] = useState("");
  const [selectedCatalogFileName, setSelectedCatalogFileName] = useState("");
  const [isSaving, startSaving] = useTransition();
  const [isLoadingModels, startLoadingModels] = useTransition();
  const [isLoadingAlbums, startLoadingAlbums] = useTransition();
  const [isLoadingPrinters, startLoadingPrinters] = useTransition();
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
  const sortedPrinters = useMemo(
    () =>
      [...printers].sort((a, b) => {
        const aIsDymo = a.queue.toLowerCase().includes("dymo") ? 0 : 1;
        const bIsDymo = b.queue.toLowerCase().includes("dymo") ? 0 : 1;
        if (aIsDymo !== bIsDymo) {
          return aIsDymo - bIsDymo;
        }

        return a.queue.localeCompare(b.queue, "sv", { sensitivity: "base" });
      }),
    [printers]
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

  function patchLabels(updates: Partial<AppSettings["labels"]>) {
    setSettings((current) => ({
      ...current,
      labels: {
        ...current.labels,
        ...updates
      }
    }));
  }

  async function refreshModels() {
    setModelsStatus(t("settings.status.loadingModels", "Hämtar modeller..."));
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
          throw new Error(json.error || t("settings.status.readModelsError", "Kunde inte läsa modellistan."));
        }

        setModels(json.models ?? []);
        setModelsStatus(
          json.models?.length
            ? t("settings.status.foundModels", "Hittade {count} modeller.", { count: json.models.length })
            : t("settings.status.noModelsFound", "Inga modeller hittades.")
        );
      } catch (error) {
        setModels([]);
        setModelsStatus(error instanceof Error ? error.message : t("settings.status.readModelsError", "Kunde inte läsa modellistan."));
      }
    });
  }

  async function refreshAlbums() {
    setAlbumsStatus(t("settings.status.loadingAlbums", "Hämtar album..."));
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
          throw new Error(json.error || t("settings.status.readAlbumsError", "Kunde inte läsa albumlistan."));
        }

        setAlbums(json.albums ?? []);
        setAlbumsStatus(
          json.albums?.length
            ? t("settings.status.foundAlbums", "Hittade {count} album.", { count: json.albums.length })
            : t("settings.status.noAlbumsFound", "Inga album hittades.")
        );
      } catch (error) {
        setAlbums([]);
        setAlbumsStatus(error instanceof Error ? error.message : t("settings.status.readAlbumsError", "Kunde inte läsa albumlistan."));
      }
    });
  }

  async function refreshPrinters() {
    setPrintersStatus(t("settings.status.loadingPrinters", "Hämtar skrivarköer..."));
    startLoadingPrinters(async () => {
      try {
        const response = await fetch("/api/settings/printers", { cache: "no-store" });
        const json = (await response.json()) as { printers?: AvailablePrinter[]; error?: string };
        if (!response.ok) {
          throw new Error(json.error || t("settings.status.readPrintersError", "Kunde inte läsa skrivarköerna."));
        }

        const nextPrinters = json.printers ?? [];
        setPrinters(nextPrinters);
        setPrintersStatus(
          nextPrinters.length
            ? t("settings.status.foundPrinters", "Hittade {count} skrivarköer.", { count: nextPrinters.length })
            : t("settings.status.noPrintersFound", "Inga skrivarköer hittades.")
        );
      } catch (error) {
        setPrinters([]);
        setPrintersStatus(
          error instanceof Error ? error.message : t("settings.status.readPrintersError", "Kunde inte läsa skrivarköerna.")
        );
      }
    });
  }

  async function saveSettings() {
    setStatus(t("settings.status.saving", "Sparar inställningar..."));
    startSaving(async () => {
      try {
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings)
        });

        const json = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !json.ok) {
          throw new Error(json.error || t("settings.status.saveError", "Kunde inte spara inställningarna."));
        }

        setStatus(t("settings.status.saved", "Inställningarna sparades."));
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : t("settings.status.saveError", "Kunde inte spara inställningarna."));
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
        if (backupFileRef.current) {
          backupFileRef.current.value = "";
        }
        setSelectedBackupFileName("");
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
        setSelectedCatalogFileName("");
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
          {isSaving ? t("settings.button.saving", "Sparar...") : label}
        </button>
        <span className="muted">{status}</span>
      </div>
    );
  }

  return (
    <div className="shell">
      <section className="panel shell">
        <div>
          <h2>{t("settings.appearance.title", "Utseende")}</h2>
          <p>{t("settings.appearance.intro", "Välj tema, font, språk och läsbarhet för hela appen.")}</p>
        </div>

        <div className="grid two">
          <label>
            {t("settings.appearance.theme", "Tema")}
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
            {t("settings.appearance.fontSize", "Fontstorlek")}
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
          <label>
            {t("settings.appearance.language", "Språk")}
            <select
              value={settings.appearance.language}
              onChange={(event) => patchAppearance("language", event.target.value)}
            >
              {languageOptions.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          <div className="action-row" style={{ alignSelf: "end" }}>
            <Link
              className="button secondary"
              href={`/settings/translations?lang=${encodeURIComponent(settings.appearance.language === "sv" ? "en" : settings.appearance.language)}`}
            >
              {t("settings.appearance.translations", "Översättningar")}
            </Link>
          </div>
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
          <span>{t("settings.appearance.reduceMotion", "Minska animationer och övergångar")}</span>
        </label>

        {renderSaveRow(t("settings.appearance.save", "Spara utseende"))}
      </section>

      <section className="panel shell">
        <div>
          <h2>{t("settings.immich.title", "Immich")}</h2>
          <p>{t("settings.immich.intro", "Byt konto, åtkomstmetod och vilket album som appen ska inventera från.")}</p>
        </div>

        <div className="grid two">
          <label>
            {t("settings.immich.accountLabel", "Kontoetikett")}
            <input
              value={settings.immich.accountLabel}
              onChange={(event) => patchImmich({ accountLabel: event.target.value })}
              placeholder={t("settings.immich.accountPlaceholder", "Till exempel Mimer eller Lager")}
            />
          </label>

          <label>
            {t("settings.immich.baseUrl", "Bas-URL")}
            <input
              value={settings.immich.baseUrl}
              onChange={(event) => patchImmich({ baseUrl: event.target.value })}
              placeholder="https://photos.snille.net"
            />
          </label>
        </div>

        <div className="grid two">
          <label>
            {t("settings.immich.accessMode", "Åtkomstmetod")}
            <select
              value={settings.immich.accessMode}
              onChange={(event) =>
                patchImmich({
                  accessMode: event.target.value === "shareKey" ? "shareKey" : "apiKey"
                })
              }
            >
              <option value="apiKey">{t("settings.immich.access.apiKey", "API-nyckel")}</option>
              <option value="shareKey">{t("settings.immich.access.shareKey", "Delningsnyckel")}</option>
            </select>
          </label>

          {settings.immich.accessMode === "apiKey" ? (
            <label>
              {t("settings.immich.apiKey", "Immich API-nyckel")}
              <input
                type="password"
                value={settings.immich.apiKey ?? ""}
                onChange={(event) => patchImmich({ apiKey: event.target.value })}
                placeholder={t("settings.immich.apiKeyPlaceholder", "Användarnyckel för att läsa och senare skriva metadata")}
              />
            </label>
          ) : (
            <label>
              {t("settings.immich.shareKey", "Delningsnyckel")}
              <input
                value={settings.immich.shareKey ?? ""}
                onChange={(event) => patchImmich({ shareKey: event.target.value })}
                placeholder={t("settings.immich.shareKeyPlaceholder", "Nyckel från delad Immich-länk")}
              />
            </label>
          )}
        </div>

        <div className="grid two">
          <label>
            {t("settings.immich.album", "Album")}
            <select
              value={settings.immich.albumId}
              onChange={(event) => patchImmich({ albumId: event.target.value })}
            >
              <option value="">{t("settings.immich.albumPlaceholder", "Välj album eller läs in listan")}</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.label} ({t("settings.immich.picturesCount", "{count} bilder", { count: album.assetCount })})
                </option>
              ))}
            </select>
          </label>

          <label>
            {t("settings.immich.albumId", "Album-ID")}
            <input
              value={settings.immich.albumId}
              onChange={(event) => patchImmich({ albumId: event.target.value })}
              placeholder={t("settings.immich.albumIdPlaceholder", "Klistra in album-ID om du vill")}
            />
          </label>
        </div>

        <div className="action-row">
          <button type="button" onClick={refreshAlbums} disabled={isLoadingAlbums}>
            {isLoadingAlbums ? t("settings.button.loadingAlbums", "Hämtar album...") : t("settings.button.loadAlbums", "Läs in album")}
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
                <span>{t("settings.immich.picturesCount", "{count} bilder", { count: album.assetCount })}</span>
                <span>{album.ownerName ? t("settings.immich.ownerName", "Ägare: {name}", { name: album.ownerName }) : album.id}</span>
              </button>
            ))}
          </div>
        ) : null}

        {renderSaveRow(t("settings.immich.save", "Spara Immich"))}
      </section>

      <section className="panel shell">
        <div>
          <h2>{t("settings.ai.title", "AI-motor")}</h2>
          <p>{t("settings.ai.intro", "Här väljer du provider, endpoint och modell för bildanalys.")}</p>
        </div>

        <div className="grid two">
          <label>
            {t("settings.ai.provider", "Provider")}
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
            {t("settings.ai.modelSearch", "Modell (sökbar lista)")}
            <input
              list="available-models"
              value={activeConnection.model}
              onChange={(event) => patchAiSection(settings.ai.provider, { model: event.target.value })}
              placeholder={t("settings.ai.modelSearchPlaceholder", "Börja skriva för att söka modell...")}
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
            {t("settings.ai.baseUrl", "Bas-URL")}
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
            {t("settings.ai.modelId", "Modell-ID")}
            <input
              value={activeConnection.model}
              onChange={(event) => patchAiSection(settings.ai.provider, { model: event.target.value })}
              placeholder={t("settings.ai.modelIdPlaceholder", "Till exempel qwen/qwen3.5-35b-a3b")}
            />
          </label>
        </div>

        <div className="grid two">
          <label>
            {t("settings.ai.apiKey", "API-nyckel")}
            <input
              type="password"
              value={activeConnection.apiKey ?? ""}
              onChange={(event) => patchAiSection(settings.ai.provider, { apiKey: event.target.value })}
              placeholder={t("settings.ai.apiKeyPlaceholder", "Valfritt för LM Studio, krävs för moln-API")}
            />
          </label>

          {settings.ai.provider === "lmstudio" ? (
            <label>
              {t("settings.ai.contextLength", "Context length")}
              <input
                type="number"
                value={settings.ai.lmstudio.contextLength ?? ""}
                onChange={(event) =>
                  patchAiSection("lmstudio", {
                    contextLength: event.target.value ? Number(event.target.value) : undefined
                  })
                }
                placeholder={t("settings.ai.contextLengthPlaceholder", "150082")}
              />
            </label>
          ) : (
            <div className="panel-quiet">
              <strong>{t("settings.ai.tipTitle", "Tips")}</strong>
              <p className="muted">
                {t("settings.ai.tipBody", "OpenAI, Anthropic, OpenRouter och Open WebUI använder sina egna modellistor. LM Studio hämtar modeller från din lokala server.")}
              </p>
            </div>
          )}
        </div>

        <div className="action-row">
          <button type="button" onClick={refreshModels} disabled={isLoadingModels}>
            {isLoadingModels ? t("settings.button.loadingModels", "Hämtar modeller...") : t("settings.button.loadModels", "Läs in modeller")}
          </button>
          <span className="muted">{modelsStatus}</span>
        </div>

        {renderSaveRow(t("settings.ai.save", "Spara AI-motor"))}
      </section>

      <section className="panel shell">
        <div>
          <h2>{t("settings.printer.title", "Skrivare")}</h2>
          <p>{t("settings.printer.intro", "Välj vilken redan installerad CUPS-kö appen ska använda för etikettstatus och utskrift.")}</p>
          <p className="muted">{t("settings.printer.recommendation", "Rekommendation: välj helst en DYMO-kö här tills vi har fullt stöd för A4-etikettark på vanliga laserskrivare.")}</p>
        </div>

        <div className="grid two">
          <label>
            {t("settings.printer.queue", "Skrivarkö")}
            <select
              value={settings.labels.printerQueue}
              onChange={(event) => patchLabels({ printerQueue: event.target.value })}
            >
              <option value="">{t("settings.printer.queuePlaceholder", "Välj skrivarkö eller läs in listan")}</option>
              {sortedPrinters.map((printer) => (
                <option key={printer.queue} value={printer.queue}>
                  {printer.queue}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t("settings.printer.queueManual", "Skrivarkö manuellt")}
            <input
              value={settings.labels.printerQueue}
              onChange={(event) => patchLabels({ printerQueue: event.target.value })}
              placeholder={t("settings.printer.queueManualPlaceholder", "Till exempel DYMO_5XL")}
            />
          </label>
        </div>

        <div className="action-row">
          <button type="button" onClick={refreshPrinters} disabled={isLoadingPrinters}>
            {isLoadingPrinters
              ? t("settings.button.loadingPrinters", "Hämtar skrivarköer...")
              : t("settings.button.loadPrinters", "Läs in skrivarköer")}
          </button>
          <span className="muted">{printersStatus}</span>
        </div>

        {sortedPrinters.length > 0 ? (
          <div className="grid two">
            {sortedPrinters.map((printer) => (
              <button
                key={printer.queue}
                type="button"
                className={`font-choice${settings.labels.printerQueue === printer.queue ? " active" : ""}`}
                onClick={() => patchLabels({ printerQueue: printer.queue })}
              >
                <strong>{printer.queue}</strong>
                <span>{printer.summary}</span>
              </button>
            ))}
          </div>
        ) : null}

        {renderSaveRow(t("settings.printer.save", "Spara skrivare"))}
      </section>

      <section className="panel shell">
        <div>
          <h2>{t("settings.backup.title", "Backup")}</h2>
          <p>{t("settings.backup.intro", "Ladda ner backup eller exportera katalogen till Excel från samma ställe.")}</p>
        </div>

        <div className="action-row">
          <a className="button" href="/api/settings/backup">
            {t("settings.button.downloadBackup", "Ladda ner backup")}
          </a>
          <a className="button" href="/api/settings/export-catalog">
            {t("settings.button.exportExcel", "Exportera Excel")}
          </a>
        </div>

        <div className="grid two">
          <label>
            {t("settings.backup.importFile", "Läs in backupfil")}
            <input
              ref={backupFileRef}
              type="file"
              accept="application/json,.json,application/zip,.zip"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                setSelectedBackupFileName(file?.name ?? "");
                if (file) {
                  void importBackup(file);
                }
              }}
            />
            <div className="action-row" style={{ marginTop: 8 }}>
              <button type="button" className="button secondary" onClick={() => backupFileRef.current?.click()}>
                {t("settings.backup.chooseFile", "Välj fil")}
              </button>
              <span className="muted">
                {selectedBackupFileName || t("settings.backup.noFileSelected", "Ingen fil vald")}
              </span>
            </div>
          </label>
          <label>
            {t("settings.backup.importCatalog", "Importera katalog")}
            <input
              ref={catalogFileRef}
              type="file"
              accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                setSelectedCatalogFileName(file?.name ?? "");
                if (file) {
                  void importCatalog(file);
                }
              }}
            />
            <div className="action-row" style={{ marginTop: 8 }}>
              <button type="button" className="button secondary" onClick={() => catalogFileRef.current?.click()}>
                {t("settings.backup.chooseFile", "Välj fil")}
              </button>
              <span className="muted">
                {selectedCatalogFileName || t("settings.backup.noFileSelected", "Ingen fil vald")}
              </span>
            </div>
          </label>
        </div>

        <div className="grid two">
          <div className="panel-quiet">
            <strong>{t("settings.backup.infoTitle", "Backup och export")}</strong>
            <p className="muted" style={{ marginTop: 8 }}>
              {t("settings.backup.infoBody", "Backupen innehåller inventariet, sessionshistorik, analystexter, etikettmallar och övriga appinställningar i en zip-fil. Excel-exporten ger en läsbar katalog med lådor, platser, sammanfattningar och nyckelord.")}
            </p>
          </div>
          <div className="panel-quiet">
            <strong>{t("settings.backup.importInfoTitle", "Excel-import")}</strong>
            <p className="muted" style={{ marginTop: 8 }}>
              {t("settings.backup.importInfoBody", "Importen utgår från appens nuvarande exportformat. Den uppdaterar lådor och aktuella sessioner från filen, men låter kopplade bilder ligga kvar i inventariet.")}
            </p>
          </div>
        </div>

        <div className="action-row">
          <span className="muted">{isImportingBackup ? t("settings.backup.importingBackup", "Läser in backup...") : backupStatus}</span>
        </div>
        <div className="action-row">
          <span className="muted">{isImportingCatalog ? t("settings.backup.importingCatalog", "Importerar Excel...") : catalogImportStatus}</span>
        </div>
      </section>

      <section className="panel shell">
        <div>
          <h2>{t("settings.prompts.title", "Promptar")}</h2>
          <p>{t("settings.prompts.intro", "Här kan du finjustera hur modellen instrueras. Det är särskilt användbart när du testar nya modeller.")}</p>
        </div>

        <label>
          {t("settings.prompts.boxAnalysis", "Lådanalys: huvudinstruktion")}
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
            {t("settings.prompts.roleSystem", "Bildroll: systemprompt")}
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
            {t("settings.prompts.roleUser", "Bildroll: användarprompt")}
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
            {t("settings.prompts.summarySystem", "Bildspecifik analys: systemprompt")}
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
            {t("settings.prompts.summaryUser", "Bildspecifik analys: användarprompt")}
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
          {t("settings.prompts.anthropicSystem", "Anthropic: systemprompt för lådanalys")}
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
            {t("settings.prompts.summaryCleanup", "Rensningsfraser: sammanfattning (en per rad)")}
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
            {t("settings.prompts.keywordCleanup", "Rensningsord: sökord (en per rad)")}
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
            {t("settings.prompts.notesCleanup", "Rensningsfraser: noteringar (en per rad)")}
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
            {t("settings.prompts.photoCleanup", "Rensningsfraser: bildtext (en per rad)")}
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

        {renderSaveRow(t("settings.prompts.save", "Spara promptar"))}
      </section>

      {renderSaveRow(t("settings.all.save", "Spara alla inställningar"))}
    </div>
  );
}
