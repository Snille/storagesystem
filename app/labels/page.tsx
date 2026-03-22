import { LabelEditor } from "@/app/labels/label-editor";
import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { buildLabelDescription, buildLabelPlaceText } from "@/lib/label-presentation";
import { readAppSettings } from "@/lib/settings";

type LabelsPageProps = {
  searchParams: Promise<{ boxId?: string }>;
};

export default async function LabelsPage({ searchParams }: LabelsPageProps) {
  const params = await searchParams;
  const data = await readInventoryData();
  const settings = await readAppSettings();
  const sessionsByBox = getCurrentSessionByBox(data);

  const options = data.boxes
    .map((box) => {
      const session = sessionsByBox.get(box.boxId);
      return {
        boxId: box.boxId,
        label: box.label,
        description: buildLabelDescription(box.notes, session?.summary),
        placeText: buildLabelPlaceText(box.currentLocationId, box.boxId)
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "sv"));

  return (
    <div className="shell">
      <section className="hero no-print">
        <h1>Etiketter</h1>
      </section>

      <LabelEditor
        initialBoxId={params.boxId ?? ""}
        options={options}
        initialTemplates={settings.labels.templates}
        initialDefaultTemplateId={settings.labels.defaultTemplateId}
      />
    </div>
  );
}
