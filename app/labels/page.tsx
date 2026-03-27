import { LabelEditor } from "@/app/labels/label-editor";
import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { createTranslator, readLanguageCatalog } from "@/lib/i18n";
import { buildLabelDescription } from "@/lib/label-presentation";
import { presentLocation } from "@/lib/location-presentation";
import { readAppSettings } from "@/lib/settings";

type LabelsPageProps = {
  searchParams: Promise<{ boxId?: string }>;
};

export default async function LabelsPage({ searchParams }: LabelsPageProps) {
  const params = await searchParams;
  const [data, settings] = await Promise.all([readInventoryData(), readAppSettings()]);
  const languageCatalog = await readLanguageCatalog(settings.appearance.language);
  const t = createTranslator(languageCatalog);
  const sessionsByBox = getCurrentSessionByBox(data);

  const options = data.boxes
    .map((box) => {
      const session = sessionsByBox.get(box.boxId);
      return {
        boxId: box.boxId,
        label: box.label,
        description: buildLabelDescription(box.notes, session?.summary),
        placeText: (() => {
          const location = presentLocation(box.currentLocationId, box.boxId, {
            shelvingUnit: t("boxForm.ivar", "Lagerhylla"),
            bench: t("boxForm.bench", "Bänk"),
            cabinet: t("boxForm.cabinet", "Skåp"),
            surface: t("boxForm.surface", "Yta"),
            slot: t("boxForm.place", "Plats")
          });
          return [location.system, location.shelf, location.slot].filter(Boolean).join(", ");
        })()
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "sv"));

  return (
    <div className="shell">
      <section className="hero no-print">
        <h1>{t("labels.pageTitle", "Etiketter")}</h1>
      </section>

      <LabelEditor
        initialBoxId={params.boxId ?? ""}
        options={options}
        initialTemplates={settings.labels.templates}
        initialDefaultTemplateId={settings.labels.defaultTemplateId}
        ui={{
          fieldTitle: t("labels.field.title", "Namn"),
          fieldDescription: t("labels.field.description", "Beskrivning"),
          fieldPlace: t("labels.field.place", "Plats"),
          printerReading: t("labels.printer.reading", "Läser skrivaren..."),
          printerReadFailed: t("labels.printer.readFailed", "Kunde inte läsa skrivaren."),
          printerReportsMedia: t("labels.printer.reportsMedia", "DYMO rapporterar {media}{sku}."),
          printerReportsSize: t("labels.printer.reportsSize", "DYMO rapporterar ungefär {width} x {height} mm."),
          printerConnectedUnknownSize: t("labels.printer.connectedUnknownSize", "DYMO är ansluten, men rapporterar ingen tydlig rullstorlek just nu."),
          printerSlow: t("labels.printer.slow", "Skrivaren svarade för långsamt just nu. Sidan fungerar ändå, och du kan prova igen strax."),
          selectedTemplateFromPrinter: t("labels.printer.selectedTemplate", "Valde mall efter skrivarrullen: {name}."),
          labelsRemaining: t("labels.printer.labelsRemaining", "Etiketter kvar:"),
          labelsRemainingInline: t("labels.printer.labelsRemainingInline", "({count} etiketter kvar)"),
          templateCopied: t("labels.template.copied", "Mallen kopierades."),
          newTemplateName: t("labels.template.newTemplateName", "Ny mall {count}"),
          newTemplateCreated: t("labels.template.created", "Ny etikettmall skapad."),
          templateRemoved: t("labels.template.removed", "Mallen togs bort."),
          savingTemplates: t("labels.template.saving", "Sparar etikettmallar..."),
          saveTemplatesFailed: t("labels.template.saveFailed", "Kunde inte spara etikettmallarna."),
          templatesSaved: t("labels.template.saved", "Etikettmallarna sparades."),
          printFailed: t("labels.print.failed", "Kunde inte skriva ut etiketten."),
          printSentWithId: t("labels.print.sentWithId", "Etiketten skickades till DYMO ({id})."),
          printSent: t("labels.print.sent", "Etiketten skickades till DYMO."),
          emptyTitle: t("labels.preview.emptyTitle", "Etikettnamn"),
          emptyDescription: t("labels.preview.emptyDescription", "Kort beskrivning av innehållet i lådan."),
          emptyPlace: t("labels.preview.emptyPlace", "Ivar: X\nHylla: X\nPlats: XA"),
          appliedPrinterMedia: t("labels.printer.appliedMedia", "Använder skrivarrullen {media} i den valda mallen."),
          generatorTitle: t("labels.generatorTitle", "Etikettgenerator"),
          existingBox: t("labels.existingBox", "Befintlig låda"),
          manualOption: t("labels.manualOption", "Ingen vald, skriv manuellt"),
          resetFromSelected: t("labels.resetFromSelected", "Återställ från vald låda"),
          newLabelManual: t("labels.newLabelManual", "Ny etikett manuellt"),
          printToDymo: t("labels.print.toDymo", "Skriv ut på DYMO"),
          printingToDymo: t("labels.print.printingToDymo", "Skickar till DYMO..."),
          printInBrowser: t("labels.print.browser", "Skriv ut via webbläsaren"),
          printInfo: t("labels.print.infoTitle", "Utskriftsinfo"),
          printJobId: t("labels.print.jobId", "Jobb-ID:"),
          unknown: t("shared.unknown", "okänt"),
          printQueue: t("labels.print.queue", "Skrivarkö:"),
          printMedia: t("labels.print.media", "Media:"),
          standard: t("shared.standard", "standard"),
          clearedJobs: t("labels.print.clearedJobs", "Rensade hängande jobb:"),
          printerLabel: t("labels.printer.label", "DYMO-skrivare:"),
          templatesTitle: t("labels.templatesTitle", "Etikettmallar"),
          activeTemplate: t("labels.activeTemplate", "Aktiv mall"),
          defaultTemplate: t("labels.defaultTemplate", "Standardmall"),
          templateName: t("labels.template.name", "Mallnamn"),
          labelSize: t("labels.template.size", "Etikettstorlek"),
          orientation: t("labels.template.orientation", "Riktning"),
          portrait: t("labels.orientation.portrait", "Stående"),
          landscape: t("labels.orientation.landscape", "Liggande"),
          area: t("labels.template.area", "Yta"),
          printableArea: t("labels.template.printableArea", "Utskriftsyta"),
          snapToGrid: t("labels.template.snapToGrid", "Snap-to-grid"),
          grid: t("labels.template.grid", "Rutnät"),
          hidden: t("shared.hidden", "Dolt"),
          selectedField: t("labels.template.selectedField", "Markerat fält: {field}"),
          font: t("labels.template.font", "Font"),
          size: t("labels.template.sizeShort", "Storlek"),
          width: t("labels.template.width", "Bredd"),
          height: t("labels.template.height", "Höjd"),
          alignment: t("labels.template.alignment", "Justering"),
          alignLeft: t("labels.template.alignLeft", "Vänster"),
          alignCenter: t("labels.template.alignCenter", "Centrerad"),
          fontWeight: t("labels.template.fontWeight", "Fontvikt"),
          normal: t("labels.template.normal", "Normal"),
          bold: t("labels.template.bold", "Fet"),
          rotation: t("labels.template.rotation", "Rotation"),
          none: t("shared.none", "Ingen"),
          rotateClockwise: t("labels.template.rotateClockwise", "90° medurs"),
          rotateCounterclockwise: t("labels.template.rotateCounterclockwise", "90° moturs"),
          showField: t("labels.template.showField", "Visa fält"),
          placeDisplay: t("labels.template.placeDisplay", "Platsvisning"),
          placeDisplayChips: t("labels.template.placeDisplayChips", "Separata delar"),
          placeDisplaySingleLine: t("labels.template.placeDisplaySingleLine", "En rad"),
          duplicateTemplate: t("labels.template.duplicate", "Kopiera mall"),
          newTemplate: t("labels.template.new", "Ny mall"),
          deleteTemplate: t("labels.template.delete", "Ta bort mall"),
          saveTemplates: t("labels.template.save", "Spara etikettmallar"),
          moveBlocksHint: t("labels.template.moveHint", "Flytta blocken på etiketten och spara när du är nöjd."),
          activeRoll: t("labels.printer.activeRoll", "Aktiv rulle i skrivaren:"),
          autoTemplateSelected: t("labels.printer.autoTemplateSelected", "Mall vald automatiskt:"),
          queue: t("labels.printer.queueShort", "Kö:"),
          queuedJobs: t("labels.printer.queuedJobs", "Jobb i kö:"),
          sku: t("labels.printer.sku", "SKU:"),
          roll: t("labels.printer.roll", "Rulle:"),
          firmware: t("labels.printer.firmware", "Firmware:"),
          usePrinterLabel: t("labels.printer.usePrinterLabel", "Använd skrivarens etikett"),
          designer: t("labels.designerTitle", "Designer"),
          printTestLabel: t("labels.print.testLabel", "Skriv ut testetikett"),
          printingTestLabel: t("labels.print.printingTestLabel", "Skickar testetikett..."),
          resizeField: t("labels.template.resizeField", "Ändra storlek på {field}"),
          openLargeImage: t("shared.openLargeImage", "Visa större bild: {name}"),
          imageHasAnalysisText: t("shared.imageHasAnalysisText", "Bilden har analystext"),
          closeImageView: t("shared.closeImageView", "Stäng bildvisning")
        }}
      />
    </div>
  );
}
