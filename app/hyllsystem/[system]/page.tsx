import Link from "next/link";
import { notFound } from "next/navigation";
import { getAssetThumbnailUrl } from "@/lib/immich";
import { readInventoryData } from "@/lib/data-store";
import { getShelfUnitBySlug } from "@/lib/shelf-map";

type ShelfSystemPageProps = {
  params: Promise<{ system: string }>;
};

function formatSlotWithVariant(slot: string, variant: string) {
  return variant ? `${slot}${variant}` : `${slot}`;
}

export default async function ShelfSystemPage({ params }: ShelfSystemPageProps) {
  const { system } = await params;
  const data = await readInventoryData();
  const unit = getShelfUnitBySlug(data, system);

  if (!unit) {
    notFound();
  }

  const rows = [...unit.rows].sort((a, b) => a.rowSortKey - b.rowSortKey);
  const isBench = unit.kind === "bench";
  const structureClassName = `shelf-structure shelf-structure-${unit.kind}`;

  return (
    <div className="shell">
      <section className="hero">
        <div className="section-header">
          <h1>{unit.title}</h1>
          <Link href="/hyllsystem" className="button secondary">
            Tillbaka till lagerplatser
          </Link>
        </div>
        <p>
          Klicka på en låda för att öppna låd-vyn. {isBench ? "Yta" : "Hylla"} och plats visas enligt aktuell placering i systemet.
        </p>
      </section>

      <section className="panel">
        <h2>Platser i {unit.title}</h2>
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
                          <span className="shelf-slot-label">Plats {position.slot}</span>
                          <span className="shelf-slot-count">
                            {position.boxes.length} {position.boxes.length > 1 ? "lådor" : "låda"}
                          </span>
                        </div>
                        <div className="shelf-stack">
                          {position.boxes.map((entry) => {
                            const insidePhoto =
                              entry.photos.find((photo) => photo.photoRole === "inside") ?? entry.photos[0];
                            return (
                              <Link key={entry.box.boxId} href={`/boxes/${entry.box.boxId}`} className="card shelf-box-link">
                                <div className="meta card-meta">
                                  <span>Plats {formatSlotWithVariant(position.slot, entry.location.variant)}</span>
                                  <span className="meta-count">Bilder {entry.photos.length}</span>
                                </div>
                                <h3>{entry.box.label}</h3>
                                <p>{entry.session?.summary ?? "Ingen aktuell sammanfattning ännu."}</p>
                                {insidePhoto ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    className="shelf-box-thumb"
                                    src={getAssetThumbnailUrl(insidePhoto.immichAssetId)}
                                    alt={entry.box.label}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="empty">Ingen bild ännu</div>
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
                      <span className={`shelf-deck-label${isBench ? " shelf-deck-label-above" : ""}`}>{row.rowLabel}</span>
                      {isBench && nextRowLabel ? (
                        <span className="shelf-deck-label shelf-deck-label-below">{nextRowLabel}</span>
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
