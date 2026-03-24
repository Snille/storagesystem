import Link from "next/link";
import { readInventoryData } from "@/lib/data-store";
import { getShelfUnits } from "@/lib/shelf-map";

export default async function ShelfSystemsPage() {
  const data = await readInventoryData();
  const shelfUnits = getShelfUnits(data);

  return (
    <div className="shell">
      <section className="hero">
        <h1>Hyllsystem</h1>
        <p>Välj en platsenhet för att se platserna och öppna rätt låda direkt.</p>
      </section>

      <section className="panel">
        <h2>Platsöversikt</h2>
        {shelfUnits.length > 0 ? (
          <div className="shelf-unit-grid">
            {shelfUnits.map((unit) => (
              <Link key={`${unit.kind}:${unit.unitId}`} href={`/hyllsystem/${unit.slug}`} className="card shelf-unit-card">
                <div className="shelf-unit-head">
                  <div className="shelf-unit-letter" aria-hidden="true">
                    {unit.kind === "ivar" ? unit.unitLabel : unit.kind === "bench" ? "B" : "S"}
                  </div>
                  <div>
                    <h3>{unit.title}</h3>
                    <p>
                      {unit.boxes.length} lådor • {unit.rows.length} rader • {unit.positions.length} platser
                    </p>
                  </div>
                </div>
                <div className="meta">
                  <span>{unit.kind === "bench" ? "Ytor" : "Hyllor"} {unit.rows.map((row) => row.rowLabel.replace(/^Hylla\s+/i, "")).join(", ")}</span>
                  <span>Platser {unit.slots.join(", ")}</span>
                </div>
                <p className="shelf-unit-open">Öppna hyllvy</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">Ingen platsenhet hittades ännu i datan.</div>
        )}
      </section>
    </div>
  );
}
