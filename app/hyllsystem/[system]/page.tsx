import Link from "next/link";
import { notFound } from "next/navigation";
import { getAssetThumbnailUrl } from "@/lib/immich";
import { readInventoryData } from "@/lib/data-store";
import { createTranslator, readLanguageCatalog } from "@/lib/i18n";
import { readAppSettings } from "@/lib/settings";
import { getShelfUnitBySlug, presentShelfUnitTitle } from "@/lib/shelf-map";

type ShelfSystemPageProps = {
  params: Promise<{ system: string }>;
};

function formatSlotWithVariant(slot: string, variant: string) {
  return variant ? `${slot}${variant}` : `${slot}`;
}

function presentRowLabel(
  rowLabel: string,
  t: (key: string, fallback?: string, values?: Record<string, string | number>) => string
) {
  const shelfMatch = rowLabel.match(/^Hylla\s+(\d+)$/i);
  if (shelfMatch) {
    return t("locations.shelfLabel", "Hylla {count}", { count: shelfMatch[1] });
  }

  if (/^Ovanp[åa]$/i.test(rowLabel)) {
    return t("boxForm.benchTop", "Ovanpå");
  }

  if (/^Under$/i.test(rowLabel)) {
    return t("boxForm.benchUnder", "Under");
  }

  return rowLabel;
}

export default async function ShelfSystemPage({ params }: ShelfSystemPageProps) {
  const { system } = await params;
  const [data, settings] = await Promise.all([readInventoryData(), readAppSettings()]);
  const languageCatalog = await readLanguageCatalog(settings.appearance.language);
  const t = createTranslator(languageCatalog);
  const unit = getShelfUnitBySlug(data, system);

  if (!unit) {
    notFound();
  }

  const rows = [...unit.rows].sort((a, b) => a.rowSortKey - b.rowSortKey);
  const isBench = unit.kind === "bench";
  const structureClassName = `shelf-structure shelf-structure-${unit.kind}`;
  const unitTitle = presentShelfUnitTitle(unit.kind, unit.unitLabel, {
    shelvingUnit: t("boxForm.ivar", "Lagerhylla"),
    bench: t("boxForm.bench", "Bänk"),
    cabinet: t("boxForm.cabinet", "Skåp")
  });

  return (
    <div className="shell">
      <section className="hero">
        <div className="section-header">
          <h1>{unitTitle}</h1>
          <Link href="/hyllsystem" className="button secondary">
            {t("locationView.backToLocations", "Tillbaka till lagerplatser")}
          </Link>
        </div>
        <p>
          {t("locationView.intro", "Klicka på en låda för att öppna låd-vyn. {rowType} och plats visas enligt aktuell placering i systemet.", {
            rowType: isBench ? t("locations.surface", "Yta") : t("locations.shelf", "Hylla")
          })}
        </p>
      </section>

      <section className="panel">
        <h2>{t("locationView.title", "Platser i {title}", { title: unitTitle })}</h2>
        <div className={structureClassName}>
          {rows.map((row, rowIndex) => (
            (() => {
              const shelfPositions = unit.positions
                .filter((position) => position.rowId === row.rowId)
                .sort((a, b) => a.slotSortKey - b.slotSortKey);

              if (shelfPositions.length === 0) {
                return null;
              }

              const showDeck = !isBench || rowIndex < rows.length - 1;
              const nextRowLabel = rows[rowIndex + 1]?.rowLabel;

              return (
                <section className="shelf-row" key={row.rowId}>
                  <div className="shelf-row-header">
                    <span className="shelf-row-line" aria-hidden="true" />
                  </div>
                  <div
                    className="shelf-row-grid"
                    style={{ gridTemplateColumns: `repeat(${Math.max(shelfPositions.length, 1)}, minmax(0, 1fr))` }}
                  >
                    {shelfPositions.map((position) => (
                      <article key={`${row.rowId}:${position.slot}`} className="shelf-slot filled">
                        <div className="shelf-slot-head">
                          <span className="shelf-slot-label">{t("locationView.slotLabel", "Plats {slot}", { slot: position.slot })}</span>
                          <span className="shelf-slot-count">
                            {t(position.boxes.length > 1 ? "locationView.boxCountMany" : "locationView.boxCountOne", position.boxes.length > 1 ? "{count} lådor" : "{count} låda", {
                              count: position.boxes.length
                            })}
                          </span>
                        </div>
                        <div className="shelf-stack">
                          {position.boxes.map((entry) => {
                            const insidePhoto =
                              entry.photos.find((photo) => photo.photoRole === "inside") ?? entry.photos[0];
                            return (
                              <Link key={entry.box.boxId} href={`/boxes/${entry.box.boxId}`} className="card shelf-box-link">
                                <div className="meta card-meta">
                                  <span>{t("locationView.slotLabel", "Plats {slot}", { slot: formatSlotWithVariant(position.slot, entry.location.variant) })}</span>
                                  <span className="meta-count">{t("home.photosCount", "Bilder {count}", { count: entry.photos.length })}</span>
                                </div>
                                <h3>{entry.box.label}</h3>
                                <p>{entry.session?.summary ?? t("home.summaryMissing", "Ingen aktuell sammanfattning ännu.")}</p>
                                {insidePhoto ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    className="shelf-box-thumb"
                                    src={getAssetThumbnailUrl(insidePhoto.immichAssetId)}
                                    alt={entry.box.label}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="empty">{t("locationView.noImageYet", "Ingen bild ännu")}</div>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </article>
                    ))}
                  </div>
                  {showDeck ? (
                    <div className="shelf-deck">
                      <span className={`shelf-deck-label${isBench ? " shelf-deck-label-above" : ""}`}>
                        {presentRowLabel(row.rowLabel, t)}
                      </span>
                      {isBench && nextRowLabel ? (
                        <span className="shelf-deck-label shelf-deck-label-below">{presentRowLabel(nextRowLabel, t)}</span>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              );
            })()
          ))}
        </div>
      </section>
    </div>
  );
}
