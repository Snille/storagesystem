import Link from "next/link";
import { readInventoryData } from "@/lib/data-store";
import { createTranslator, readLanguageCatalog } from "@/lib/i18n";
import { getShelfUnits, presentShelfUnitTitle } from "@/lib/shelf-map";
import { readAppSettings } from "@/lib/settings";

export default async function ShelfSystemsPage() {
  const [data, settings] = await Promise.all([readInventoryData(), readAppSettings()]);
  const languageCatalog = await readLanguageCatalog(settings.appearance.language);
  const t = createTranslator(languageCatalog);
  const shelfUnits = getShelfUnits(data);

  return (
    <div className="shell">
      <section className="hero">
        <h1>{t("locations.pageTitle", "Lagerplats")}</h1>
        <p>{t("locations.pageIntro", "Välj en platsenhet för att se platserna och öppna rätt låda direkt.")}</p>
      </section>

      <section className="panel">
        <h2>{t("locations.overviewTitle", "Platsöversikt")}</h2>
        {shelfUnits.length > 0 ? (
          <div className="shelf-unit-grid">
            {shelfUnits.map((unit) => (
              <Link key={`${unit.kind}:${unit.unitId}`} href={`/hyllsystem/${unit.slug}`} className="card shelf-unit-card">
                <div className="shelf-unit-head">
                  <div className="shelf-unit-letter" aria-hidden="true">
                    {unit.kind === "ivar" ? unit.unitLabel : unit.kind === "bench" ? "B" : "S"}
                  </div>
                  <div>
                    <h3>{presentShelfUnitTitle(unit.kind, unit.unitLabel, {
                      shelvingUnit: t("boxForm.ivar", "Lagerhylla"),
                      bench: t("boxForm.bench", "Bänk"),
                      cabinet: t("boxForm.cabinet", "Skåp")
                    })}</h3>
                    <p>
                      {t("locations.unitStats", "{boxes} lådor • {rows} rader • {positions} platser", {
                        boxes: unit.boxes.length,
                        rows: unit.rows.length,
                        positions: unit.positions.length
                      })}
                    </p>
                  </div>
                </div>
                <div className="meta">
                  <span>
                    {(unit.kind === "bench" ? t("locations.surfaces", "Ytor") : t("locations.shelves", "Hyllor"))}{" "}
                    {unit.rows.map((row) => row.rowLabel.replace(/^Hylla\s+/i, "")).join(", ")}
                  </span>
                  <span>{t("locations.slots", "Platser {slots}", { slots: unit.slots.join(", ") })}</span>
                </div>
                <p className="shelf-unit-open">{t("locations.openUnit", "Öppna hyllvy")}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">{t("locations.empty", "Ingen platsenhet hittades ännu i datan.")}</div>
        )}
      </section>
    </div>
  );
}
