"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { LABEL_MEDIA_PRESETS, findLabelMediaPreset, normalizeLabelTemplate } from "@/lib/label-templates";
import { wrapFieldText } from "@/lib/label-layout";
import type { LabelFieldKey, LabelFontFamily, LabelTemplate } from "@/lib/types";

type LabelOption = {
  boxId: string;
  label: string;
  description: string;
  placeText: string;
};

type LabelEditorProps = {
  initialBoxId: string;
  options: LabelOption[];
  initialTemplates: LabelTemplate[];
  initialDefaultTemplateId: string;
  ui: {
    fieldTitle: string;
    fieldDescription: string;
    fieldPlace: string;
    printerReading: string;
    printerReadFailed: string;
    printerReportsMedia: string;
    printerReportsSize: string;
    printerConnectedUnknownSize: string;
    printerSlow: string;
    selectedTemplateFromPrinter: string;
    labelsRemaining: string;
    labelsRemainingInline: string;
    templateCopied: string;
    newTemplateName: string;
    newTemplateCreated: string;
    templateRemoved: string;
    savingTemplates: string;
    saveTemplatesFailed: string;
    templatesSaved: string;
    printFailed: string;
    printSentWithId: string;
    printSent: string;
    emptyTitle: string;
    emptyDescription: string;
    emptyPlace: string;
    appliedPrinterMedia: string;
    generatorTitle: string;
    existingBox: string;
    manualOption: string;
    resetFromSelected: string;
    newLabelManual: string;
    printToDymo: string;
    printingToDymo: string;
    printInBrowser: string;
    printInfo: string;
    printJobId: string;
    unknown: string;
    printQueue: string;
    printMedia: string;
    standard: string;
    clearedJobs: string;
    printerLabel: string;
    templatesTitle: string;
    activeTemplate: string;
    defaultTemplate: string;
    templateName: string;
    labelSize: string;
    orientation: string;
    portrait: string;
    landscape: string;
    area: string;
    printableArea: string;
    snapToGrid: string;
    grid: string;
    hidden: string;
    selectedField: string;
    font: string;
    size: string;
    width: string;
    height: string;
    alignment: string;
    alignLeft: string;
    alignCenter: string;
    fontWeight: string;
    normal: string;
    bold: string;
    rotation: string;
    none: string;
    rotateClockwise: string;
    rotateCounterclockwise: string;
    showField: string;
    placeDisplay: string;
    placeDisplayChips: string;
    placeDisplaySingleLine: string;
    duplicateTemplate: string;
    newTemplate: string;
    deleteTemplate: string;
    saveTemplates: string;
    moveBlocksHint: string;
    activeRoll: string;
    autoTemplateSelected: string;
    queue: string;
    queuedJobs: string;
    sku: string;
    roll: string;
    firmware: string;
    usePrinterLabel: string;
    designer: string;
    printTestLabel: string;
    printingTestLabel: string;
    resizeField: string;
    openLargeImage: string;
    imageHasAnalysisText: string;
    closeImageView: string;
  };
};

type PrinterStatusResponse = {
  ok: boolean;
  status?: {
    queue: string;
    state: "idle" | "processing" | "stopped" | "unknown";
    stateReason: string;
    model: string;
    firmwareVersion?: string;
    labelsRemaining?: number;
    deviceUri: string;
    queuedJobs: number;
    media: {
      source: "sku" | "media-default" | "media-col-default" | "none";
      rawKeyword: string;
      dymoSku?: string;
      widthMm?: number;
      heightMm?: number;
      matchedPreset?: {
        mediaKey: string;
        mediaLabel: string;
        orientation: "portrait" | "landscape";
        widthMm: number;
        heightMm: number;
      };
    };
  };
  error?: string;
};

const FONT_OPTIONS: Array<{ value: LabelFontFamily; label: string }> = [
  { value: "arial", label: "Arial" },
  { value: "system", label: "System UI" },
  { value: "verdana", label: "Verdana" },
  { value: "trebuchet", label: "Trebuchet" },
  { value: "georgia", label: "Georgia" }
];

function formatBoxOption(option: LabelOption) {
  return `${option.label} (${option.placeText})`;
}

function parsePlaceText(placeText: string) {
  const parts = placeText
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    system: parts[0] || "",
    shelf: parts[1] || "",
    slot: parts[2] || ""
  };
}

function buildTemplateId(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 32) || `label-${Date.now()}`
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getFontFamilyCss(fontFamily: LabelFontFamily) {
  switch (fontFamily) {
    case "georgia":
      return 'Georgia, "Times New Roman", serif';
    case "verdana":
      return "Verdana, Geneva, sans-serif";
    case "trebuchet":
      return '"Trebuchet MS", "Lucida Sans Unicode", sans-serif';
    case "system":
      return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    default:
      return "Arial, Helvetica, sans-serif";
  }
}

function getOrientationLabel(orientation: "portrait" | "landscape") {
  return orientation;
}

function ptToPreviewPx(points: number, previewScale: number) {
  return (points * 25.4 * previewScale) / 72;
}

function appendLabelsRemaining(message: string, labelsRemaining: number | undefined, template: string) {
  if (labelsRemaining === undefined) {
    return message;
  }

  return `${message} ${template.replace("{count}", String(labelsRemaining))}`;
}

export function LabelEditor({
  initialBoxId,
  options,
  initialTemplates,
  initialDefaultTemplateId,
  ui
}: LabelEditorProps) {
  const fieldLabels: Record<LabelFieldKey, string> = {
    title: ui.fieldTitle,
    description: ui.fieldDescription,
    place: ui.fieldPlace
  };
  const initialOption = options.find((option) => option.boxId === initialBoxId) ?? options[0] ?? null;
  const [selectedBoxId, setSelectedBoxId] = useState(initialOption?.boxId ?? "");
  const [label, setLabel] = useState(initialOption?.label ?? "");
  const [description, setDescription] = useState(initialOption?.description ?? "");
  const [placeText, setPlaceText] = useState(initialOption?.placeText ?? "");
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialDefaultTemplateId || initialTemplates[0]?.id || "");
  const [defaultTemplateId, setDefaultTemplateId] = useState(initialDefaultTemplateId || initialTemplates[0]?.id || "");
  const [activeField, setActiveField] = useState<LabelFieldKey>("title");
  const [templateStatus, setTemplateStatus] = useState("");
  const [printState, setPrintState] = useState<"idle" | "printing">("idle");
  const [printMessage, setPrintMessage] = useState("");
  const [printDetails, setPrintDetails] = useState<{
    requestId?: string;
    queue?: string;
    media?: string;
    clearedJobs?: string[];
  } | null>(null);
  const [isSavingTemplates, startSavingTemplates] = useTransition();
  const [printerStatus, setPrinterStatus] = useState<PrinterStatusResponse["status"] | null>(null);
  const [printerStatusMessage, setPrinterStatusMessage] = useState(ui.printerReading);
  const designerRef = useRef<HTMLDivElement | null>(null);
  const interactionStateRef = useRef<
    | {
        mode: "move";
        key: LabelFieldKey;
        offsetXmm: number;
        offsetYmm: number;
      }
    | {
        mode: "resize";
        key: LabelFieldKey;
        startPointerXmm: number;
        startPointerYmm: number;
        startWidthMm: number;
        startHeightMm: number;
      }
    | null
  >(null);
  const autoAppliedPrinterMediaRef = useRef(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.boxId === selectedBoxId) ?? null,
    [options, selectedBoxId]
  );
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null,
    [templates, selectedTemplateId]
  );
  const place = parsePlaceText(placeText);
  const placeSegments = [place.system, place.shelf, place.slot].filter(Boolean);
  const previewScale = selectedTemplate ? Math.min(8, Math.max(4.5, 520 / selectedTemplate.widthMm)) : 6;
  const horizontalRulerMarks = selectedTemplate
    ? Array.from({ length: Math.floor(selectedTemplate.widthMm / 5) + 1 }, (_, index) => index * 5).filter(
        (value) => value <= selectedTemplate.widthMm
      )
    : [];
  const verticalRulerMarks = selectedTemplate
    ? Array.from({ length: Math.floor(selectedTemplate.heightMm / 5) + 1 }, (_, index) => index * 5).filter(
        (value) => value <= selectedTemplate.heightMm
      )
    : [];
  const printerDetectedPreset = printerStatus?.media.matchedPreset;
  const printerMatchedTemplate = printerDetectedPreset
    ? templates.find((template) => template.mediaKey === printerDetectedPreset.mediaKey) ?? null
    : null;
  const printerAutoSelected = Boolean(printerMatchedTemplate && selectedTemplate && printerMatchedTemplate.id === selectedTemplate.id);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4500);

    async function loadPrinterStatus() {
      try {
        const response = await fetch("/api/labels/printer-status", { cache: "no-store", signal: controller.signal });
        const result = (await response.json()) as PrinterStatusResponse;

        if (cancelled) {
          return;
        }

        if (!response.ok || !result.ok || !result.status) {
          throw new Error(result.error || ui.printerReadFailed);
        }

        setPrinterStatus(result.status);

        if (result.status.media.matchedPreset) {
          const extraSku = result.status.media.dymoSku ? ` (${result.status.media.dymoSku})` : "";
          setPrinterStatusMessage(
            appendLabelsRemaining(
              ui.printerReportsMedia
                .replace("{media}", result.status.media.matchedPreset.mediaLabel)
                .replace("{sku}", extraSku),
              result.status.labelsRemaining,
              ui.labelsRemainingInline
            )
          );
          return;
        }

        if (result.status.media.widthMm && result.status.media.heightMm) {
          setPrinterStatusMessage(
            appendLabelsRemaining(
              ui.printerReportsSize
                .replace("{width}", result.status.media.widthMm.toFixed(1))
                .replace("{height}", result.status.media.heightMm.toFixed(1)),
              result.status.labelsRemaining,
              ui.labelsRemainingInline
            )
          );
          return;
        }

        setPrinterStatusMessage(
          appendLabelsRemaining(ui.printerConnectedUnknownSize, result.status.labelsRemaining, ui.labelsRemainingInline)
        );
      } catch (error) {
        if (!cancelled) {
          setPrinterStatus(null);
          const message =
            error instanceof Error && error.name === "AbortError"
              ? ui.printerSlow
              : error instanceof Error
                ? error.message
                : ui.printerReadFailed;
          setPrinterStatusMessage(message);
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    void loadPrinterStatus();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (autoAppliedPrinterMediaRef.current || !printerStatus?.media.matchedPreset) {
      return;
    }

    const templateForMedia = templates.find((template) => template.mediaKey === printerStatus.media.matchedPreset?.mediaKey);
    if (!templateForMedia) {
      return;
    }

    setSelectedTemplateId(templateForMedia.id);
    setTemplateStatus(ui.selectedTemplateFromPrinter.replace("{name}", templateForMedia.name));
    autoAppliedPrinterMediaRef.current = true;
  }, [printerStatus, templates]);

  function applyOption(boxId: string) {
    setSelectedBoxId(boxId);
    const option = options.find((entry) => entry.boxId === boxId);
    if (!option) {
      return;
    }

    setLabel(option.label);
    setDescription(option.description);
    setPlaceText(option.placeText);
  }

  function resetFromSelected() {
    if (!selectedOption) {
      return;
    }

    setLabel(selectedOption.label);
    setDescription(selectedOption.description);
    setPlaceText(selectedOption.placeText);
  }

  function clearForManual() {
    setSelectedBoxId("");
    setLabel("");
    setDescription("");
    setPlaceText("");
  }

  function updateSelectedTemplate(updater: (template: LabelTemplate) => LabelTemplate) {
    if (!selectedTemplate) {
      return;
    }

    setTemplates((current) =>
      current.map((template) => (template.id === selectedTemplate.id ? normalizeLabelTemplate(updater(template)) : template))
    );
  }

  function updateField(key: LabelFieldKey, updater: (field: LabelTemplate["fields"][LabelFieldKey]) => LabelTemplate["fields"][LabelFieldKey]) {
    updateSelectedTemplate((template) => ({
      ...template,
      fields: {
        ...template.fields,
        [key]: updater(template.fields[key])
      }
    }));
  }

  function applyMediaPreset(mediaKey: string) {
    const preset = findLabelMediaPreset(mediaKey);
    updateSelectedTemplate((template) => ({
      ...template,
      mediaKey: preset.mediaKey,
      mediaLabel: preset.mediaLabel,
      orientation: preset.orientation,
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
      pageWidthPt: preset.pageWidthPt,
      pageHeightPt: preset.pageHeightPt
    }));
  }

  function duplicateTemplate() {
    if (!selectedTemplate) {
      return;
    }

    const copy = normalizeLabelTemplate({
      ...selectedTemplate,
      id: `${buildTemplateId(`${selectedTemplate.name}-copy`)}-${Date.now().toString(36)}`,
      name: `${selectedTemplate.name} copy`
    });
    setTemplates((current) => [...current, copy]);
    setSelectedTemplateId(copy.id);
    setTemplateStatus(ui.templateCopied);
  }

  function createFreshTemplate() {
    const preset = LABEL_MEDIA_PRESETS[2];
    const fresh = normalizeLabelTemplate({
      id: `${buildTemplateId("new-template")}-${Date.now().toString(36)}`,
      name: ui.newTemplateName.replace("{count}", String(templates.length + 1)),
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
      fields: {
        title: {
          xMm: 3,
          yMm: 3,
          widthMm: preset.widthMm - 6,
          heightMm: 7,
          fontSizePt: 16,
          fontFamily: "arial",
          fontWeight: 700,
          textAlign: "center",
          rotationDeg: 0,
          visible: true
        },
        description: {
          xMm: 3,
          yMm: 12,
          widthMm: preset.widthMm - 6,
          heightMm: 10,
          fontSizePt: 8,
          fontFamily: "arial",
          fontWeight: 400,
          textAlign: "center",
          rotationDeg: 0,
          visible: true
        },
        place: {
          xMm: 3,
          yMm: preset.heightMm - 6,
          widthMm: preset.widthMm - 6,
          heightMm: 4,
          fontSizePt: 11,
          fontFamily: "arial",
          fontWeight: 700,
          textAlign: "center",
          rotationDeg: 0,
          visible: true
        }
      }
    });

    setTemplates((current) => [...current, fresh]);
    setSelectedTemplateId(fresh.id);
    setTemplateStatus(ui.newTemplateCreated);
  }

  function deleteSelectedTemplate() {
    if (!selectedTemplate || templates.length <= 1) {
      return;
    }

    const nextTemplates = templates.filter((template) => template.id !== selectedTemplate.id);
    const nextSelected = nextTemplates[0];
    setTemplates(nextTemplates);
    setSelectedTemplateId(nextSelected.id);
    if (defaultTemplateId === selectedTemplate.id) {
      setDefaultTemplateId(nextSelected.id);
    }
    setTemplateStatus(ui.templateRemoved);
  }

  async function saveTemplates() {
    setTemplateStatus(ui.savingTemplates);
    startSavingTemplates(async () => {
      try {
        const response = await fetch("/api/labels/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defaultTemplateId,
            templates
          })
        });

        const result = (await response.json()) as {
          ok?: boolean;
          error?: string;
          labels?: {
            defaultTemplateId: string;
            templates: LabelTemplate[];
          };
        };

        if (!response.ok || !result.ok || !result.labels) {
          throw new Error(result.error || ui.saveTemplatesFailed);
        }

        const savedLabels = result.labels;
        setTemplates(savedLabels.templates);
        setDefaultTemplateId(savedLabels.defaultTemplateId);
        setSelectedTemplateId((current) =>
          savedLabels.templates.some((template) => template.id === current) ? current : savedLabels.defaultTemplateId
        );
        setTemplateStatus(ui.templatesSaved);
      } catch (error) {
        setTemplateStatus(error instanceof Error ? error.message : ui.saveTemplatesFailed);
      }
    });
  }

  async function printToDymo() {
    if (!selectedTemplate) {
      return;
    }

    setPrintState("printing");
    setPrintMessage("");
    setPrintDetails(null);

    try {
      const response = await fetch("/api/labels/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          description,
          placeText,
          template: selectedTemplate
        })
      });

      const result = (await response.json()) as {
        requestId?: string;
        queue?: string;
        media?: string;
        clearedJobs?: string[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || ui.printFailed);
      }

      setPrintDetails({
        requestId: result.requestId,
        queue: result.queue,
        media: result.media,
        clearedJobs: result.clearedJobs
      });
      setPrintMessage(result.requestId ? ui.printSentWithId.replace("{id}", result.requestId) : ui.printSent);
    } catch (error) {
      setPrintMessage(error instanceof Error ? error.message : ui.printFailed);
    } finally {
      setPrintState("idle");
    }
  }

  function fieldText(key: LabelFieldKey) {
    if (key === "title") return label || ui.emptyTitle;
    if (key === "description") return description || ui.emptyDescription;
    return placeSegments.length
      ? selectedTemplate?.placeDisplay === "singleLine"
        ? placeSegments.join("  ")
        : placeSegments.join("\n")
      : ui.emptyPlace;
  }

  function beginDrag(key: LabelFieldKey, event: ReactPointerEvent<HTMLDivElement>) {
    if (!selectedTemplate) {
      return;
    }

    setActiveField(key);
    const field = selectedTemplate.fields[key];
    const bounds = designerRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    const xMm = (event.clientX - bounds.left) / previewScale;
    const yMm = (event.clientY - bounds.top) / previewScale;
    interactionStateRef.current = {
      mode: "move",
      key,
      offsetXmm: xMm - field.xMm,
      offsetYmm: yMm - field.yMm
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginResize(key: LabelFieldKey, event: ReactPointerEvent<HTMLButtonElement>) {
    if (!selectedTemplate) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setActiveField(key);
    const bounds = designerRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    const field = selectedTemplate.fields[key];
    interactionStateRef.current = {
      mode: "resize",
      key,
      startPointerXmm: (event.clientX - bounds.left) / previewScale,
      startPointerYmm: (event.clientY - bounds.top) / previewScale,
      startWidthMm: field.widthMm,
      startHeightMm: field.heightMm
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function applyDetectedPrinterMedia() {
    const matchedPreset = printerStatus?.media.matchedPreset;
    if (!matchedPreset) {
      return;
    }

    const templateForMedia = templates.find((template) => template.mediaKey === matchedPreset.mediaKey);
    if (templateForMedia) {
      setSelectedTemplateId(templateForMedia.id);
      setTemplateStatus(ui.selectedTemplateFromPrinter.replace("{name}", templateForMedia.name));
      return;
    }

    applyMediaPreset(matchedPreset.mediaKey);
    setTemplateStatus(ui.appliedPrinterMedia.replace("{media}", matchedPreset.mediaLabel));
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!selectedTemplate || !interactionStateRef.current) {
      return;
    }

    const container = event.currentTarget.getBoundingClientRect();
    const interaction = interactionStateRef.current;
    const { key } = interaction;
    const field = selectedTemplate.fields[key];
    const grid = selectedTemplate.snapToGrid ? selectedTemplate.gridMm : 0;

    if (interaction.mode === "move") {
      let xMm = (event.clientX - container.left) / previewScale - interaction.offsetXmm;
      let yMm = (event.clientY - container.top) / previewScale - interaction.offsetYmm;

      if (grid > 0) {
        xMm = Math.round(xMm / grid) * grid;
        yMm = Math.round(yMm / grid) * grid;
      }

      xMm = clamp(xMm, 0, selectedTemplate.widthMm - field.widthMm);
      yMm = clamp(yMm, 0, selectedTemplate.heightMm - field.heightMm);

      updateField(key, (current) => ({
        ...current,
        xMm,
        yMm
      }));
      return;
    }

    let widthMm = interaction.startWidthMm + (event.clientX - container.left) / previewScale - interaction.startPointerXmm;
    let heightMm = interaction.startHeightMm + (event.clientY - container.top) / previewScale - interaction.startPointerYmm;

    if (grid > 0) {
      widthMm = Math.round(widthMm / grid) * grid;
      heightMm = Math.round(heightMm / grid) * grid;
    }

    widthMm = clamp(widthMm, 6, selectedTemplate.widthMm - field.xMm);
    heightMm = clamp(heightMm, 2.5, selectedTemplate.heightMm - field.yMm);

    updateField(key, (current) => ({
      ...current,
      widthMm,
      heightMm
    }));
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (interactionStateRef.current) {
      interactionStateRef.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const previewStyle = selectedTemplate
    ? ({
        width: `${selectedTemplate.widthMm * previewScale}px`,
        height: `${selectedTemplate.heightMm * previewScale}px`
      } satisfies CSSProperties)
    : undefined;

  return (
    <div className="shell">
      <section className="panel shell no-print">
        <div>
          <h2>{ui.generatorTitle}</h2>
        </div>

        <div className="grid two">
          <label>
            {ui.existingBox}
            <select value={selectedBoxId} onChange={(event) => applyOption(event.target.value)}>
              <option value="">{ui.manualOption}</option>
              {options.map((option) => (
                <option key={option.boxId} value={option.boxId}>
                  {formatBoxOption(option)}
                </option>
              ))}
            </select>
          </label>

          <div className="action-row" style={{ alignSelf: "end" }}>
            <button type="button" className="button secondary" onClick={resetFromSelected} disabled={!selectedOption}>
              {ui.resetFromSelected}
            </button>
            <button type="button" className="button secondary" onClick={clearForManual}>
              {ui.newLabelManual}
            </button>
          </div>
        </div>

        <div className="grid two">
          <label>
            {ui.fieldTitle}
            <input value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>

          <label>
            {ui.fieldPlace}
            <input value={placeText} onChange={(event) => setPlaceText(event.target.value)} />
          </label>
        </div>

        <label>
          {ui.fieldDescription}
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>

        <div className="action-row">
          <button type="button" onClick={printToDymo} disabled={printState === "printing" || !label.trim() || !placeText.trim()}>
            {printState === "printing" ? ui.printingToDymo : ui.printToDymo}
          </button>
          <button type="button" onClick={() => window.print()}>
            {ui.printInBrowser}
          </button>
          {printMessage ? <span className="muted">{printMessage}</span> : null}
        </div>

        {printDetails ? (
          <div className="note" style={{ marginTop: "0.75rem" }}>
            <strong>{ui.printInfo}</strong>
            <div>{ui.printJobId} {printDetails.requestId || ui.unknown}</div>
            <div>{ui.printQueue} {printDetails.queue || "DYMO_5XL"}</div>
            <div>{ui.printMedia} {printDetails.media || ui.standard}</div>
            {printDetails.clearedJobs?.length ? <div>{ui.clearedJobs} {printDetails.clearedJobs.join(", ")}</div> : null}
          </div>
        ) : null}

        <div className="note" style={{ marginTop: "0.75rem" }}>
          <div className="label-inline-status">
            <strong>{ui.printerLabel}</strong>
            <span>{printerStatusMessage}</span>
          </div>
        </div>
      </section>

      <section className="panel shell no-print">
        <div>
          <h2>{ui.templatesTitle}</h2>
        </div>

        <div className="grid two">
          <label>
            {ui.activeTemplate}
            <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            {ui.defaultTemplate}
            <select value={defaultTemplateId} onChange={(event) => setDefaultTemplateId(event.target.value)}>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedTemplate ? (
          <>
            <div className="grid two">
              <label>
                {ui.templateName}
                <input
                  value={selectedTemplate.name}
                  onChange={(event) => updateSelectedTemplate((template) => ({ ...template, name: event.target.value || template.name }))}
                />
              </label>

              <label>
                {ui.labelSize}
                <select value={selectedTemplate.mediaKey} onChange={(event) => applyMediaPreset(event.target.value)}>
                  {LABEL_MEDIA_PRESETS.map((preset) => (
                    <option key={preset.mediaKey} value={preset.mediaKey}>
                      {preset.mediaLabel}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="chips" style={{ marginTop: "0.75rem", marginBottom: "0.25rem" }}>
              <span>{ui.orientation}: {getOrientationLabel(selectedTemplate.orientation) === "portrait" ? ui.portrait : ui.landscape}</span>
              <span>
                {ui.area}: {selectedTemplate.widthMm} x {selectedTemplate.heightMm} mm
              </span>
              <span>
                {ui.printableArea}: {selectedTemplate.pageWidthPt} x {selectedTemplate.pageHeightPt} pt
              </span>
            </div>

            <div className="grid two">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedTemplate.snapToGrid}
                  onChange={(event) => updateSelectedTemplate((template) => ({ ...template, snapToGrid: event.target.checked }))}
                />
                <span>{ui.snapToGrid}</span>
              </label>

              <label>
                {ui.grid} (mm)
                <input
                  type="number"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={selectedTemplate.gridMm}
                  onChange={(event) =>
                    updateSelectedTemplate((template) => ({ ...template, gridMm: Number(event.target.value || 1) }))
                  }
                />
              </label>
            </div>

            <div className="grid two">
              <div className="label-field-list">
                {(["title", "description", "place"] as LabelFieldKey[]).map((key) => {
                  const field = selectedTemplate.fields[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`font-choice${activeField === key ? " active" : ""}`}
                      onClick={() => setActiveField(key)}
                    >
                      <strong>{fieldLabels[key]}</strong>
                      <span>
                        {field.visible ? `x ${field.xMm.toFixed(1)} / y ${field.yMm.toFixed(1)} mm` : ui.hidden}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="panel-quiet">
                <strong>{ui.selectedField.replace("{field}", fieldLabels[activeField])}</strong>
                <div className="grid two" style={{ marginTop: "12px" }}>
                  <label>
                    {ui.font}
                    <select
                      value={selectedTemplate.fields[activeField].fontFamily}
                      onChange={(event) =>
                        updateField(activeField, (field) => ({
                          ...field,
                          fontFamily: event.target.value as LabelFontFamily
                        }))
                      }
                    >
                      {FONT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    {ui.size} (pt)
                    <input
                      type="number"
                      min={6}
                      max={28}
                      value={selectedTemplate.fields[activeField].fontSizePt}
                      onChange={(event) =>
                        updateField(activeField, (field) => ({
                          ...field,
                          fontSizePt: Number(event.target.value || field.fontSizePt)
                        }))
                      }
                    />
                  </label>

                  <label>
                    {ui.width} (mm)
                    <input
                      type="number"
                      min={6}
                      max={selectedTemplate.widthMm}
                      step={0.5}
                      value={selectedTemplate.fields[activeField].widthMm}
                      onChange={(event) =>
                        updateField(activeField, (field) => ({
                          ...field,
                          widthMm: clamp(Number(event.target.value || field.widthMm), 6, selectedTemplate.widthMm)
                        }))
                      }
                    />
                  </label>

                  <label>
                    {ui.height} (mm)
                    <input
                      type="number"
                      min={2.5}
                      max={selectedTemplate.heightMm}
                      step={0.5}
                      value={selectedTemplate.fields[activeField].heightMm}
                      onChange={(event) =>
                        updateField(activeField, (field) => ({
                          ...field,
                          heightMm: clamp(Number(event.target.value || field.heightMm), 2.5, selectedTemplate.heightMm)
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="grid two" style={{ marginTop: "12px" }}>
                  <label>
                    {ui.alignment}
                    <select
                      value={selectedTemplate.fields[activeField].textAlign}
                      onChange={(event) =>
                        updateField(activeField, (field) => ({
                          ...field,
                          textAlign: event.target.value === "center" ? "center" : "left"
                        }))
                      }
                    >
                      <option value="left">{ui.alignLeft}</option>
                      <option value="center">{ui.alignCenter}</option>
                    </select>
                  </label>

                  <label>
                    {ui.fontWeight}
                    <select
                      value={selectedTemplate.fields[activeField].fontWeight}
                      onChange={(event) =>
                        updateField(activeField, (field) => ({
                          ...field,
                          fontWeight: event.target.value === "700" ? 700 : 400
                        }))
                      }
                    >
                      <option value="400">{ui.normal}</option>
                      <option value="700">{ui.bold}</option>
                    </select>
                  </label>

                  <label>
                    {ui.rotation}
                    <select
                      value={selectedTemplate.fields[activeField].rotationDeg ?? 0}
                      onChange={(event) =>
                        updateField(activeField, (field) => ({
                          ...field,
                          rotationDeg:
                            event.target.value === "90" ? 90 : event.target.value === "-90" ? -90 : 0
                        }))
                      }
                    >
                      <option value="0">{ui.none}</option>
                      <option value="90">{ui.rotateClockwise}</option>
                      <option value="-90">{ui.rotateCounterclockwise}</option>
                    </select>
                  </label>
                </div>

                <div className="action-row" style={{ marginTop: "12px" }}>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={selectedTemplate.fields[activeField].visible}
                      onChange={(event) =>
                        updateField(activeField, (field) => ({
                          ...field,
                          visible: event.target.checked
                        }))
                      }
                    />
                    <span>{ui.showField}</span>
                  </label>

                  {activeField === "place" ? (
                    <label>
                      {ui.placeDisplay}
                      <select
                        value={selectedTemplate.placeDisplay}
                        onChange={(event) =>
                          updateSelectedTemplate((template) => ({
                            ...template,
                            placeDisplay: event.target.value === "singleLine" ? "singleLine" : "chips"
                          }))
                        }
                      >
                        <option value="chips">{ui.placeDisplayChips}</option>
                        <option value="singleLine">{ui.placeDisplaySingleLine}</option>
                      </select>
                    </label>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="action-row">
              <button type="button" className="button secondary" onClick={duplicateTemplate}>
                {ui.duplicateTemplate}
              </button>
              <button type="button" className="button secondary" onClick={createFreshTemplate}>
                {ui.newTemplate}
              </button>
              <button type="button" className="button secondary" onClick={deleteSelectedTemplate} disabled={templates.length <= 1}>
                {ui.deleteTemplate}
              </button>
              <button type="button" onClick={saveTemplates} disabled={isSavingTemplates}>
                {isSavingTemplates ? ui.savingTemplates : ui.saveTemplates}
              </button>
              <span className="muted">{templateStatus || ui.moveBlocksHint}</span>
            </div>

            <div className="note label-printer-note">
              {printerDetectedPreset ? (
                <div>
                  <strong>{ui.activeRoll}</strong> {printerDetectedPreset.mediaLabel}
                  {printerStatus?.media.dymoSku ? ` (${printerStatus.media.dymoSku})` : ""}
                </div>
              ) : null}
              {printerAutoSelected && selectedTemplate ? (
                <div style={{ marginTop: "0.35rem" }}>
                  <strong>{ui.autoTemplateSelected}</strong> {selectedTemplate.name}
                </div>
              ) : null}

              <div className="label-printer-meta">
                {printerStatus?.queue ? (
                  <span>
                    <strong>{ui.queue}</strong> {printerStatus.queue}
                  </span>
                ) : null}
                {printerStatus?.queuedJobs !== undefined ? (
                  <span>
                    <strong>{ui.queuedJobs}</strong> {printerStatus.queuedJobs}
                  </span>
                ) : null}
                {printerStatus?.labelsRemaining !== undefined ? (
                  <span>
                    <strong>{ui.labelsRemaining}</strong> {printerStatus.labelsRemaining}
                  </span>
                ) : null}
                {printerStatus?.media.dymoSku ? (
                  <span>
                    <strong>{ui.sku}</strong> {printerStatus.media.dymoSku}
                  </span>
                ) : null}
                {printerStatus?.media.matchedPreset?.orientation ? (
                  <span>
                    <strong>{ui.orientation}:</strong> {getOrientationLabel(printerStatus.media.matchedPreset.orientation) === "portrait" ? ui.portrait : ui.landscape}
                  </span>
                ) : null}
                {printerStatus?.media.widthMm && printerStatus?.media.heightMm ? (
                  <span>
                    <strong>{ui.roll}</strong> {printerStatus.media.widthMm.toFixed(1)} x {printerStatus.media.heightMm.toFixed(1)}
                  </span>
                ) : null}
                {printerStatus?.firmwareVersion ? (
                  <span>
                    <strong>{ui.firmware}</strong> {printerStatus.firmwareVersion}
                  </span>
                ) : null}
              </div>

              <div className="action-row" style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={applyDetectedPrinterMedia}
                  disabled={!printerStatus?.media.matchedPreset}
                >
                  {ui.usePrinterLabel}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="panel label-preview-panel">
        <h2 className="no-print">{ui.designer}</h2>
        <div className="label-designer-toolbar no-print">
          <button
            type="button"
            className="label-designer-print-button"
            onClick={printToDymo}
            disabled={printState === "printing" || !selectedTemplate || !label.trim() || !placeText.trim()}
          >
            {printState === "printing" ? ui.printingTestLabel : ui.printTestLabel}
          </button>
        </div>
        {selectedTemplate ? (
          <div className="label-sheet">
            <div className="label-designer-shell">
              <div className="label-ruler label-ruler-top" aria-hidden="true">
                {horizontalRulerMarks.map((mark) => (
                  <div
                    key={`top-${mark}`}
                    className={`label-ruler-mark${mark % 10 === 0 ? " major" : ""}`}
                    style={{ left: `${mark * previewScale}px` }}
                  >
                    {mark % 10 === 0 ? <span>{mark}</span> : null}
                  </div>
                ))}
              </div>

              <div className="label-ruler label-ruler-left" aria-hidden="true">
                {verticalRulerMarks.map((mark) => (
                  <div
                    key={`left-${mark}`}
                    className={`label-ruler-mark${mark % 10 === 0 ? " major" : ""}`}
                    style={{ top: `${mark * previewScale}px` }}
                  >
                    {mark % 10 === 0 ? <span>{mark}</span> : null}
                  </div>
                ))}
              </div>

              <div className="label-ruler-corner" aria-hidden="true">
                mm
              </div>

              <div className="label-designer-wrapper">
              <div
                ref={designerRef}
                className={`label-designer${selectedTemplate.snapToGrid ? " with-grid" : ""}`}
                style={{
                  ...previewStyle,
                  ["--label-grid-size" as string]: `${selectedTemplate.gridMm * previewScale}px`
                }}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <div className="label-designer-guide vertical" style={{ left: "50%" }} />
                <div className="label-designer-guide horizontal" style={{ top: "50%" }} />
                {(["title", "description", "place"] as LabelFieldKey[]).map((key) => {
                  const field = selectedTemplate.fields[key];
                  if (!field.visible) {
                    return null;
                  }

                  const text = fieldText(key);
                  const wrappedLines = wrapFieldText(selectedTemplate, key, text);
                  const rotationDeg = field.rotationDeg ?? 0;
                  const isRotated = rotationDeg !== 0;
                  const previewFontSizePx = ptToPreviewPx(field.fontSizePt, previewScale);
                  const contentWidthPx = `${(isRotated ? field.heightMm : field.widthMm) * previewScale}px`;
                  const contentHeightPx = `${(isRotated ? field.widthMm : field.heightMm) * previewScale}px`;
                  const style: CSSProperties = {
                    left: `${field.xMm * previewScale}px`,
                    top: `${field.yMm * previewScale}px`,
                    width: `${field.widthMm * previewScale}px`,
                    height: `${field.heightMm * previewScale}px`,
                    fontFamily: getFontFamilyCss(field.fontFamily),
                    fontWeight: field.fontWeight,
                    textAlign: field.textAlign
                  };
                  const contentStyle: CSSProperties = {
                    width: isRotated ? contentWidthPx : "100%",
                    height: isRotated ? contentHeightPx : "100%",
                    position: isRotated ? "absolute" : "relative",
                    left: isRotated ? "50%" : undefined,
                    top: isRotated ? "50%" : undefined,
                    transform: isRotated
                      ? `translate(-50%, -50%) rotate(${rotationDeg}deg)`
                      : undefined,
                    transformOrigin: "center center",
                    fontSize: `${previewFontSizePx}px`,
                    lineHeight: 1.15,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: key === "place" && selectedTemplate.placeDisplay === "chips"
                      ? "center"
                      : undefined,
                    alignItems:
                      key === "place" && selectedTemplate.placeDisplay === "chips"
                        ? field.textAlign === "left"
                          ? "flex-start"
                          : "center"
                        : undefined
                  };

                  return (
                    <div
                      key={key}
                      className={`label-designer-field${activeField === key ? " active" : ""}${key === "place" ? " place-field" : ""}`}
                      style={style}
                      onPointerDown={(event) => beginDrag(key, event)}
                      onClick={() => setActiveField(key)}
                    >
                      {key === "place" && selectedTemplate.placeDisplay === "chips" ? (
                        <div className="label-designer-chips" style={contentStyle}>
                          {placeSegments.length ? placeSegments.map((segment) => <span key={segment}>{segment}</span>) : <span>{ui.fieldPlace}</span>}
                        </div>
                      ) : (
                        <span className="label-designer-text" style={contentStyle}>
                          {wrappedLines.join("\n")}
                        </span>
                      )}
                      <button
                        type="button"
                        className="label-designer-handle"
                        aria-label={ui.resizeField.replace("{field}", fieldLabels[key])}
                        onPointerDown={(event) => beginResize(key, event)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
