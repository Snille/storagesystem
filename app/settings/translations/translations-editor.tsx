"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LanguageOption } from "@/lib/i18n";
import type { AiProvider, AiSettings, AvailableModel } from "@/lib/types";

type TranslationsEditorProps = {
  sourceCode: string;
  targetCode: string;
  sourceLabel: string;
  targetLabel: string;
  languageOptions: LanguageOption[];
  sourceEntries: Record<string, string>;
  targetEntries: Record<string, string>;
  coverageByLanguage: Record<string, { translated: number; total: number; percent: number }>;
  initialTranslationAi: AiSettings;
  initialTranslationPrompt: string;
  initialModels: AvailableModel[];
  ui: Record<string, string>;
};

type FilterMode = "all" | "missing" | "changed";

function detectSection(key: string) {
  const prefix = key.split(".")[0] ?? "misc";
  return prefix;
}

function shouldUseTextarea(sourceValue: string, targetValue: string) {
  return sourceValue.includes("\n") || targetValue.includes("\n");
}

const speechLocaleDefaults: Record<string, string> = {
  sv: "sv-SE",
  en: "en-US",
  de: "de-DE",
  fi: "fi-FI",
  fr: "fr-FR",
  da: "da-DK",
  no: "nb-NO",
  nb: "nb-NO",
  nn: "nn-NO",
  is: "is-IS",
  nl: "nl-NL",
  es: "es-ES",
  it: "it-IT",
  pt: "pt-PT",
  pl: "pl-PL",
  cs: "cs-CZ",
  sk: "sk-SK"
};

function toLanguageName(code: string) {
  try {
    return new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function toSpeechLocale(code: string) {
  const normalized = code.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  return speechLocaleDefaults[normalized] ?? `${normalized}-${normalized.toUpperCase()}`;
}

const providerOptions: Array<{ value: AiProvider; label: string }> = [
  { value: "lmstudio", label: "LM Studio" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "openwebui", label: "Open WebUI" }
];

export function TranslationsEditor({
  sourceCode,
  targetCode,
  sourceLabel,
  targetLabel,
  languageOptions,
  sourceEntries,
  targetEntries,
  coverageByLanguage,
  initialTranslationAi,
  initialTranslationPrompt,
  initialModels,
  ui
}: TranslationsEditorProps) {
  const router = useRouter();
  const selectableSourceLanguages = languageOptions;
  const selectableTargetLanguages = languageOptions.filter((language) => language.code !== sourceCode);
  const t = (key: string, fallback: string, values?: Record<string, string | number>) => {
    const template = ui[key] ?? fallback;
    return template.replace(/\{(\w+)\}/g, (_, token: string) => String(values?.[token] ?? `{${token}}`));
  };
  const [entries, setEntries] = useState<Record<string, string>>(targetEntries);
  const [selectedSection, setSelectedSection] = useState("app");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [newLanguageCode, setNewLanguageCode] = useState("");
  const [newLanguageLabel, setNewLanguageLabel] = useState("");
  const [newLanguageHtmlLang, setNewLanguageHtmlLang] = useState("");
  const [newLanguageSpeechLocale, setNewLanguageSpeechLocale] = useState("");
  const [translationAi, setTranslationAi] = useState<AiSettings>(initialTranslationAi);
  const [translationPrompt, setTranslationPrompt] = useState(initialTranslationPrompt);
  const [models, setModels] = useState<AvailableModel[]>(initialModels);
  const [modelsStatus, setModelsStatus] = useState(
    initialModels.length > 0 ? "" : t("translations.aiModelsIdle", "Ingen modellista laddad ännu.")
  );
  const [aiStatus, setAiStatus] = useState("");
  const [isDrafting, startDrafting] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isSavingAi, startSavingAi] = useTransition();
  const [isLoadingModels, startLoadingModels] = useTransition();

  useEffect(() => {
    setEntries(targetEntries);
    setStatus("");
  }, [sourceCode, targetCode, targetEntries]);

  useEffect(() => {
    setTranslationAi(initialTranslationAi);
    setTranslationPrompt(initialTranslationPrompt);
    setModels(initialModels);
    setModelsStatus(initialModels.length > 0 ? "" : t("translations.aiModelsIdle", "Ingen modellista laddad ännu."));
    setAiStatus("");
  }, [initialModels, initialTranslationAi, initialTranslationPrompt, ui]);

  const allSections = useMemo(() => {
    const seen = new Set<string>();
    return Object.keys(sourceEntries)
      .map((key) => detectSection(key))
      .filter((section) => {
        if (seen.has(section)) {
          return false;
        }
        seen.add(section);
        return true;
      })
      .sort((left, right) => left.localeCompare(right, "sv", { sensitivity: "base" }));
  }, [sourceEntries]);

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return Object.keys(sourceEntries)
      .filter((key) => (selectedSection === "all" ? true : detectSection(key) === selectedSection))
      .filter((key) => {
        const sourceValue = sourceEntries[key] ?? "";
        const targetValue = entries[key] ?? "";
        if (filterMode === "missing") {
          return !targetValue.trim();
        }
        if (filterMode === "changed") {
          return targetValue.trim() && targetValue.trim() !== sourceValue.trim();
        }
        return true;
      })
      .filter((key) => {
        if (!needle) {
          return true;
        }

        return (
          key.toLowerCase().includes(needle) ||
          (sourceEntries[key] ?? "").toLowerCase().includes(needle) ||
          (entries[key] ?? "").toLowerCase().includes(needle)
        );
      })
      .sort((left, right) => left.localeCompare(right, "sv", { sensitivity: "base" }));
  }, [entries, filterMode, query, selectedSection, sourceEntries]);

  const missingCount = useMemo(
    () => Object.keys(sourceEntries).filter((key) => !(entries[key] ?? "").trim()).length,
    [entries, sourceEntries]
  );
  const draftableKeys = useMemo(
    () =>
      Object.keys(sourceEntries).filter((key) => {
        if (selectedSection !== "all" && detectSection(key) !== selectedSection) {
          return false;
        }

        return !(entries[key] ?? "").trim();
      }),
    [entries, selectedSection, sourceEntries]
  );
  const targetQuery = useMemo(
    () => `/settings/translations?from=${encodeURIComponent(sourceCode)}&to=${encodeURIComponent(targetCode)}`,
    [sourceCode, targetCode]
  );
  const activeTranslationConnection = useMemo(() => {
    if (translationAi.provider === "openai") return translationAi.openai;
    if (translationAi.provider === "anthropic") return translationAi.anthropic;
    if (translationAi.provider === "openrouter") return translationAi.openrouter;
    if (translationAi.provider === "openwebui") return translationAi.openwebui;
    return translationAi.lmstudio;
  }, [translationAi]);
  const sortedModels = useMemo(
    () => [...models].sort((a, b) => a.label.localeCompare(b.label, "sv", { sensitivity: "base" })),
    [models]
  );

  function goToLanguages(nextSourceCode: string, nextTargetCode: string) {
    const fallbackTargetCode =
      nextTargetCode === nextSourceCode
        ? languageOptions.find((language) => language.code !== nextSourceCode)?.code ?? nextTargetCode
        : nextTargetCode;
    router.push(
      `/settings/translations?from=${encodeURIComponent(nextSourceCode)}&to=${encodeURIComponent(fallbackTargetCode)}`
    );
  }

  function patchTranslationAiSection(
    section: "lmstudio" | "openai" | "anthropic" | "openrouter" | "openwebui",
    updates: Record<string, string | number | undefined>
  ) {
    setTranslationAi((current) => ({
      ...current,
      [section]: {
        ...current[section],
        ...updates
      }
    }));
  }

  function handleNewLanguageCodeChange(nextValue: string) {
    const normalized = nextValue.trim().toLowerCase();
    setNewLanguageCode(nextValue);

    if (!normalized) {
      return;
    }

    setNewLanguageHtmlLang((current) => (current.trim() ? current : normalized));
    setNewLanguageSpeechLocale((current) => (current.trim() ? current : toSpeechLocale(normalized)));
    setNewLanguageLabel((current) => (current.trim() ? current : toLanguageName(normalized)));
  }

  async function saveTranslations() {
    setStatus(t("translations.saving", "Sparar översättningar..."));
    startSaving(async () => {
      try {
        const response = await fetch("/api/settings/translations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: targetCode,
            entries
          })
        });

        const json = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !json.ok) {
          throw new Error(json.error || t("translations.saveFailed", "Kunde inte spara översättningarna."));
        }

        setStatus(t("translations.saved", "Översättningarna sparades."));
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : t("translations.saveFailed", "Kunde inte spara översättningarna."));
      }
    });
  }

  async function createLanguage() {
    const code = newLanguageCode.trim().toLowerCase();
    if (!code) {
      setStatus(t("translations.newLanguageCodeRequired", "Ange en språkkod först."));
      return;
    }

    setStatus(t("translations.creatingLanguage", "Skapar språk..."));
    startSaving(async () => {
      try {
        const response = await fetch("/api/settings/translations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            entries: Object.fromEntries(Object.keys(sourceEntries).map((key) => [key, ""])),
            meta: {
              label: newLanguageLabel.trim() || code,
              htmlLang: newLanguageHtmlLang.trim() || code,
              speechRecognitionLocale: newLanguageSpeechLocale.trim() || code
            }
          })
        });

        const json = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !json.ok) {
          throw new Error(json.error || t("translations.createLanguageFailed", "Kunde inte skapa språket."));
        }

        setStatus(t("translations.createdLanguage", "Språket skapades."));
        router.push(`/settings/translations?from=${encodeURIComponent(sourceCode)}&to=${encodeURIComponent(code)}`);
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : t("translations.createLanguageFailed", "Kunde inte skapa språket."));
      }
    });
  }

  async function createAiDraft() {
    if (sourceCode === targetCode) {
      setStatus(t("translations.aiSameLanguage", "AI-utkast kräver olika källspråk och målspråk."));
      return;
    }

    if (draftableKeys.length === 0) {
      setStatus(t("translations.aiNothingMissing", "Det finns inga saknade strängar att fylla i här."));
      return;
    }

    setStatus(t("translations.aiDrafting", "AI skapar utkast..."));
    startDrafting(async () => {
      try {
        const response = await fetch("/api/settings/translations/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceCode,
            targetCode,
            section: selectedSection
          })
        });

        const json = (await response.json()) as { ok?: boolean; error?: string; entries?: Record<string, string>; count?: number };
        if (!response.ok || !json.ok) {
          throw new Error(json.error || t("translations.aiDraftFailed", "Kunde inte skapa AI-utkast."));
        }

        const nextEntries = json.entries ?? {};
        setEntries((current) => ({
          ...current,
          ...nextEntries
        }));
        setStatus(
          t("translations.aiDraftedCount", "AI fyllde i {count} strängar.", {
            count: json.count ?? Object.keys(nextEntries).length
          })
        );
      } catch (error) {
        setStatus(error instanceof Error ? error.message : t("translations.aiDraftFailed", "Kunde inte skapa AI-utkast."));
      }
    });
  }

  async function refreshModels() {
    setModelsStatus(t("translations.aiModelsLoading", "Hämtar modeller..."));
    startLoadingModels(async () => {
      try {
        const response = await fetch("/api/settings/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: translationAi.provider,
            baseUrl: activeTranslationConnection.baseUrl,
            apiKey: activeTranslationConnection.apiKey ?? ""
          })
        });

        const json = (await response.json()) as { models?: AvailableModel[]; error?: string };
        if (!response.ok) {
          throw new Error(json.error || t("translations.aiModelsFailed", "Kunde inte läsa modellistan."));
        }

        setModels(json.models ?? []);
        setModelsStatus(
          json.models?.length
            ? t("translations.aiModelsFound", "Hittade {count} modeller.", { count: json.models.length })
            : t("translations.aiModelsEmpty", "Inga modeller hittades.")
        );
      } catch (error) {
        setModels([]);
        setModelsStatus(error instanceof Error ? error.message : t("translations.aiModelsFailed", "Kunde inte läsa modellistan."));
      }
    });
  }

  async function saveTranslationAi() {
    setAiStatus(t("translations.aiSettingsSaving", "Sparar översättnings-AI..."));
    startSavingAi(async () => {
      try {
        const response = await fetch("/api/settings/translation-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            translationAi,
            translationPrompt
          })
        });

        const json = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !json.ok) {
          throw new Error(json.error || t("translations.aiSettingsSaveFailed", "Kunde inte spara översättnings-AI."));
        }

        setAiStatus(t("translations.aiSettingsSaved", "Översättnings-AI sparades."));
        router.refresh();
      } catch (error) {
        setAiStatus(
          error instanceof Error ? error.message : t("translations.aiSettingsSaveFailed", "Kunde inte spara översättnings-AI.")
        );
      }
    });
  }

  return (
    <section className="panel shell">
      <div className="section-header">
        <div>
          <h2>{t("translations.editorTitle", "Översättningsverktyg")}</h2>
          <p className="muted">
            {t("translations.editorMeta", "{source} -> {target} · {count} saknas", {
              source: sourceLabel,
              target: targetLabel,
              count: missingCount
            })}
          </p>
        </div>
        <Link className="button secondary" href="/settings">
          {t("translations.backToSettings", "Tillbaka till inställningar")}
        </Link>
      </div>

      <div className="grid two">
        <label>
          {t("translations.sourceLanguage", "Från språk")}
          <select value={sourceCode} onChange={(event) => goToLanguages(event.target.value, targetCode)}>
            {selectableSourceLanguages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("translations.targetLanguage", "Målspråk")}
          <select value={targetCode} onChange={(event) => goToLanguages(sourceCode, event.target.value)}>
            {selectableTargetLanguages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="panel-quiet">
        <strong>{t("translations.aiSetupTitle", "AI för översättning")}</strong>
        <p className="muted">
          {t(
            "translations.aiRecommendation",
            "Välj gärna en modell med bra flerspråkig kvalitet och jämn stil. För UI-översättning är det viktigt att modellen bevarar platshållare som {count} och håller sig kort och konsekvent. OpenRouter passar bra när du vill jämföra flera modeller snabbt."
          )}
        </p>

        <div className="panel-quiet" style={{ marginTop: 12 }}>
          <strong>{t("translations.aiPromptTitle", "Översättningsinstruktion")}</strong>
          <p className="muted">
            {t(
              "translations.aiPromptHelp",
              "Den här instruktionen styr hur modellen ska bete sig när den skapar översättningsutkast. Här kan du förtydliga att placeholders som {count} måste bevaras, att tonen ska vara kort och att tekniska värden inte ska översättas i onödan."
            )}
          </p>
          <textarea
            value={translationPrompt}
            onChange={(event) => setTranslationPrompt(event.target.value)}
            style={{ marginTop: 12 }}
          />
        </div>

        <div className="grid two" style={{ marginTop: 12 }}>
          <label>
            {t("translations.aiProvider", "Provider")}
            <select
              value={translationAi.provider}
              onChange={(event) =>
                setTranslationAi((current) => ({
                  ...current,
                  provider: event.target.value as AiProvider
                }))
              }
            >
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t("translations.aiModelSearch", "Modell (sökbar lista)")}
            <input
              list="translation-available-models"
              value={activeTranslationConnection.model}
              onChange={(event) => patchTranslationAiSection(translationAi.provider, { model: event.target.value })}
              placeholder={t("translations.aiModelSearchPlaceholder", "Börja skriva för att söka modell...")}
            />
            <datalist id="translation-available-models">
              {sortedModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </datalist>
          </label>
        </div>

        <div className="grid two" style={{ marginTop: 12 }}>
          <label>
            {t("translations.aiBaseUrl", "Bas-URL")}
            <input
              value={activeTranslationConnection.baseUrl}
              onChange={(event) => patchTranslationAiSection(translationAi.provider, { baseUrl: event.target.value })}
              placeholder={
                translationAi.provider === "lmstudio"
                  ? "http://localhost:1234/v1"
                  : translationAi.provider === "openai"
                    ? "https://api.openai.com/v1"
                    : translationAi.provider === "openrouter"
                      ? "https://openrouter.ai/api/v1"
                      : translationAi.provider === "openwebui"
                        ? "http://localhost:8080/api"
                        : "https://api.anthropic.com"
              }
            />
          </label>

          <label>
            {t("translations.aiModelId", "Modell-ID")}
            <input
              value={activeTranslationConnection.model}
              onChange={(event) => patchTranslationAiSection(translationAi.provider, { model: event.target.value })}
              placeholder="openai/gpt-5-mini"
            />
          </label>
        </div>

        <div className="grid two" style={{ marginTop: 12 }}>
          <label>
            {t("translations.aiApiKey", "API-nyckel")}
            <input
              type="password"
              value={activeTranslationConnection.apiKey ?? ""}
              onChange={(event) => patchTranslationAiSection(translationAi.provider, { apiKey: event.target.value })}
              placeholder={t(
                "translations.aiApiKeyPlaceholder",
                "Lämna tomt för att återanvända API-nyckeln från vanliga AI-motorn när det passar."
              )}
            />
          </label>

          {translationAi.provider === "lmstudio" ? (
            <label>
              {t("translations.aiContextLength", "Context length")}
              <input
                type="number"
                value={translationAi.lmstudio.contextLength ?? ""}
                onChange={(event) =>
                  patchTranslationAiSection("lmstudio", {
                    contextLength: event.target.value ? Number(event.target.value) : undefined
                  })
                }
                placeholder="150082"
              />
            </label>
          ) : (
            <div className="panel-quiet">
              <strong>{t("translations.aiModelTipsTitle", "Valtips")}</strong>
              <p className="muted">
                {t(
                  "translations.aiModelTipsBody",
                  "Börja gärna med en stark allroundmodell för språk. Testa sedan 5 till 10 riktiga UI-strängar och jämför ton, kostnad, hastighet och hur väl platshållare och radbrytningar bevaras."
                )}
              </p>
            </div>
          )}
        </div>

        <div className="action-row" style={{ marginTop: 12 }}>
          <button type="button" className="button secondary" onClick={refreshModels} disabled={isLoadingModels}>
            {isLoadingModels
              ? t("translations.aiModelsLoading", "Hämtar modeller...")
              : t("translations.aiLoadModels", "Läs in modeller")}
          </button>
          <button type="button" className="button secondary" onClick={saveTranslationAi} disabled={isSavingAi}>
            {isSavingAi
              ? t("translations.aiSettingsSaving", "Sparar översättnings-AI...")
              : t("translations.aiSettingsSave", "Spara översättnings-AI")}
          </button>
          <span className="muted">{aiStatus || modelsStatus}</span>
          <a className="button secondary" href={`/api/settings/translations/export?code=${encodeURIComponent(targetCode)}`}>
            {t("translations.exportJson", "Exportera språkfil")}
          </a>
        </div>
      </div>

      <div className="panel-quiet">
        <strong>{t("translations.coverageTitle", "Språktäckning")}</strong>
        <div className="card-list" style={{ marginTop: 12 }}>
          {languageOptions.map((language) => {
            const coverage = coverageByLanguage[language.code] ?? { translated: 0, total: 0, percent: 0 };
            return (
              <article className="card" key={language.code}>
                <div className="meta card-meta">
                  <span>{language.label}</span>
                  <span>{language.code}</span>
                </div>
                <strong>{t("translations.coveragePercent", "{percent}%", { percent: coverage.percent })}</strong>
                <p className="muted">
                  {t("translations.coverageMeta", "{translated} av {total} ifyllda", {
                    translated: coverage.translated,
                    total: coverage.total
                  })}
                </p>
              </article>
            );
          })}
        </div>
      </div>

      <div className="grid two">
        <label>
          {t("translations.search", "Sök")}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("translations.searchPlaceholder", "Sök efter nyckel eller text...")}
          />
        </label>
      </div>

      <div className="panel-quiet">
        <strong>{t("translations.newLanguageTitle", "Nytt språk")}</strong>
        <p className="muted">{t("translations.newLanguageHint", "Det nya språket skapas med tomma översättningar utifrån svenska nycklar.")}</p>
        <div className="grid two" style={{ marginTop: 12 }}>
          <label>
            {t("translations.newLanguageCode", "Språkkod")}
            <input value={newLanguageCode} onChange={(event) => handleNewLanguageCodeChange(event.target.value)} placeholder="de" />
          </label>
          <label>
            {t("translations.newLanguageLabel", "Språknamn")}
            <input value={newLanguageLabel} onChange={(event) => setNewLanguageLabel(event.target.value)} placeholder="Deutsch" />
          </label>
          <label>
            {t("translations.newLanguageHtmlLang", "HTML lang")}
            <input value={newLanguageHtmlLang} onChange={(event) => setNewLanguageHtmlLang(event.target.value)} placeholder="de" />
          </label>
          <label>
            {t("translations.newLanguageSpeechLocale", "Tal-locale")}
            <input value={newLanguageSpeechLocale} onChange={(event) => setNewLanguageSpeechLocale(event.target.value)} placeholder="de-DE" />
          </label>
        </div>
        <div className="action-row" style={{ marginTop: 12 }}>
          <button type="button" className="button secondary" onClick={createLanguage} disabled={isSaving}>
            {isSaving ? t("translations.creatingLanguage", "Skapar språk...") : t("translations.createLanguage", "Skapa språk")}
          </button>
          <span className="muted">{t("translations.newLanguageOptionalFields", "Bara språkkoden krävs. Resten fylls i automatiskt om du lämnar dem tomma.")}</span>
        </div>
      </div>

      <div className="grid two">
        <label>
          {t("translations.section", "Sektion")}
          <select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)}>
            <option value="all">{t("translations.section.all", "Alla sektioner")}</option>
            {allSections.map((section) => (
              <option key={section} value={section}>
                {t(`translations.section.${section}`, section)}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("translations.filter", "Filter")}
          <select value={filterMode} onChange={(event) => setFilterMode(event.target.value as FilterMode)}>
            <option value="all">{t("translations.filter.all", "Alla")}</option>
            <option value="missing">{t("translations.filter.missing", "Saknas")}</option>
            <option value="changed">{t("translations.filter.changed", "Skiljer sig från svenska")}</option>
          </select>
        </label>
      </div>

      <div className="action-row">
        <button type="button" onClick={saveTranslations} disabled={isSaving}>
          {isSaving ? t("translations.saving", "Sparar översättningar...") : t("translations.save", "Spara översättningar")}
        </button>
        <button type="button" className="button secondary" onClick={createAiDraft} disabled={isSaving || isDrafting}>
          {isDrafting
            ? t("translations.aiDrafting", "AI skapar utkast...")
            : t("translations.aiDraftSection", "AI-utkast för saknade")}
        </button>
        <span className="muted">{status}</span>
        <Link className="button secondary" href={targetQuery}>
          {t("translations.shareView", "Uppdatera vy")}
        </Link>
      </div>

      <div className="card-list">
        {visibleEntries.map((key) => {
          const sourceValue = sourceEntries[key] ?? "";
          const targetValue = entries[key] ?? "";
          const multiline = shouldUseTextarea(sourceValue, targetValue);
          return (
            <article className="card" key={key}>
              <div className="meta card-meta">
                <span>{key}</span>
                <span>{t(`translations.section.${detectSection(key)}`, detectSection(key))}</span>
              </div>
              <div className="grid two" style={{ marginTop: 12 }}>
                <label>
                  {sourceLabel}
                  {multiline ? (
                    <textarea value={sourceValue} readOnly />
                  ) : (
                    <input value={sourceValue} readOnly />
                  )}
                </label>
                <label>
                  {targetLabel}
                  {multiline ? (
                    <textarea
                      value={targetValue}
                      onChange={(event) =>
                        setEntries((current) => ({
                          ...current,
                          [key]: event.target.value
                        }))
                      }
                      placeholder={t("translations.emptyTarget", "Skriv översättning här...")}
                    />
                  ) : (
                    <input
                      value={targetValue}
                      onChange={(event) =>
                        setEntries((current) => ({
                          ...current,
                          [key]: event.target.value
                        }))
                      }
                      placeholder={t("translations.emptyTarget", "Skriv översättning här...")}
                    />
                  )}
                </label>
              </div>
            </article>
          );
        })}
      </div>

      {visibleEntries.length === 0 ? (
        <div className="empty">{t("translations.empty", "Inga strängar matchar den aktuella filtreringen.")}</div>
      ) : null}

      <div className="panel-quiet">
        <strong>{t("translations.aiTitle", "AI-utkast")}</strong>
        <p className="muted">
          {t(
            "translations.aiHint",
            "AI kan nu fylla i saknade strängar i vald sektion. Granska utkastet och spara när du är nöjd."
          )}
        </p>
      </div>
    </section>
  );
}
