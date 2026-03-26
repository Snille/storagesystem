from __future__ import annotations

import json
import re
import sys
from datetime import datetime, UTC
from pathlib import Path
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

from openpyxl import Workbook
from openpyxl.styles import Font


ROOT = Path(__file__).resolve().parent.parent
INVENTORY_PATH = ROOT / "data" / "inventory.json"
DEFAULT_OUTPUT_PATH = ROOT / "data" / "Lagersystem - Katalog-export.xlsx"


def load_inventory() -> dict[str, Any]:
    return json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))


def parse_location_id(location_id: str) -> dict[str, str]:
    trimmed = location_id.strip()

    ivar_match = re.match(r"^([A-Z])-H(\d+)-P(\d+)(?:-([A-Z]))?$", trimmed, re.IGNORECASE)
    if ivar_match:
        unit = ivar_match.group(1).upper()
        shelf = ivar_match.group(2)
        slot = ivar_match.group(3)
        variant = ivar_match.group(4).upper() if ivar_match.group(4) else ""
        display = f"Ivar: {unit}, Hylla: {shelf}, Plats: {slot}{variant}"
        return {
            "kind": "ivar",
            "unit": unit,
            "row": shelf,
            "slot": slot,
            "variant": variant,
            "display": display,
            "sort_key": f"1|{unit}|{int(shelf):04d}|{int(slot):04d}|{variant}",
        }

    bench_match = re.match(r"^BENCH:([A-Z0-9-]+):(TOP|UNDER):P(\d+)(?::([A-Z]))?$", trimmed, re.IGNORECASE)
    if bench_match:
        unit = bench_match.group(1).upper()
        row = bench_match.group(2).upper()
        slot = bench_match.group(3)
        variant = bench_match.group(4).upper() if bench_match.group(4) else ""
        row_label = "Ovanpå" if row == "TOP" else "Under"
        display = f"Bänk: {unit}, Yta: {row_label}, Plats: {slot}{variant}"
        row_sort = "1" if row == "TOP" else "2"
        return {
            "kind": "bench",
            "unit": unit,
            "row": row,
            "slot": slot,
            "variant": variant,
            "display": display,
            "sort_key": f"2|{unit}|{row_sort}|{int(slot):04d}|{variant}",
        }

    cabinet_match = re.match(r"^CABINET:([A-Z0-9-]+):H(\d+):P(\d+)(?::([A-Z]))?$", trimmed, re.IGNORECASE)
    if cabinet_match:
        unit = cabinet_match.group(1).upper()
        shelf = cabinet_match.group(2)
        slot = cabinet_match.group(3)
        variant = cabinet_match.group(4).upper() if cabinet_match.group(4) else ""
        display = f"Skåp: {unit}, Hylla: {shelf}, Plats: {slot}{variant}"
        return {
            "kind": "cabinet",
            "unit": unit,
            "row": shelf,
            "slot": slot,
            "variant": variant,
            "display": display,
            "sort_key": f"3|{unit}|{int(shelf):04d}|{int(slot):04d}|{variant}",
        }

    return {
        "kind": "unknown",
        "unit": "",
        "row": "",
        "slot": "",
        "variant": "",
        "display": trimmed,
        "sort_key": f"9|{trimmed}",
    }


def build_rows(data: dict[str, Any]) -> list[dict[str, str]]:
    current_sessions_by_box: dict[str, dict[str, Any]] = {}
    for session in data.get("sessions", []):
        if session.get("isCurrent"):
            current_sessions_by_box[session["boxId"]] = session

    rows: list[dict[str, str]] = []
    for box in data.get("boxes", []):
        session = current_sessions_by_box.get(box["boxId"], {})
        location = parse_location_id(box.get("currentLocationId", ""))
        rows.append(
            {
                "Namn": str(box.get("label", "") or ""),
                "Beskrivning": str(box.get("notes", "") or ""),
                "Plats": location["display"],
                "Box-ID": str(box.get("boxId", "") or ""),
                "Plats-ID": str(box.get("currentLocationId", "") or ""),
                "Sammanfattning": str(session.get("summary", "") or ""),
                "Nyckelord": ", ".join(session.get("itemKeywords", []) or []),
                "Sessionsanteckningar": str(session.get("notes", "") or ""),
                "Session-ID": str(session.get("sessionId", "") or ""),
                "Skapad": str(box.get("createdAt", "") or ""),
                "Uppdaterad": str(box.get("updatedAt", "") or ""),
                "_sort_key": location["sort_key"],
            }
        )

    rows.sort(key=lambda row: (row["_sort_key"], row["Namn"].lower(), row["Box-ID"]))
    return rows


def autosize_columns(worksheet) -> None:
    for column_cells in worksheet.columns:
        max_length = 0
        column_letter = column_cells[0].column_letter
        for cell in column_cells:
            value = "" if cell.value is None else str(cell.value)
            max_length = max(max_length, len(value))
        worksheet.column_dimensions[column_letter].width = min(max_length + 2, 50)


def normalize_core_properties(output_path: Path) -> None:
    with ZipFile(output_path, "r") as source:
        entries = [(info, source.read(info.filename)) for info in source.infolist()]

    with ZipFile(output_path, "w", compression=ZIP_DEFLATED) as target:
        for info, data in entries:
            if info.filename == "docProps/core.xml":
                data = re.sub(rb"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\+00:00)?Z", rb"\1Z", data)
            target.writestr(info, data)


def write_workbook(rows: list[dict[str, str]], output_path: Path) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Etiketter"
    timestamp = datetime.now(UTC).replace(tzinfo=None, microsecond=0)
    workbook.properties.creator = "Lagersystem"
    workbook.properties.created = timestamp
    workbook.properties.modified = timestamp

    headers = [
        "Namn",
        "Beskrivning",
        "Plats",
        "Box-ID",
        "Plats-ID",
        "Sammanfattning",
        "Nyckelord",
        "Sessionsanteckningar",
        "Session-ID",
        "Skapad",
        "Uppdaterad",
    ]

    sheet.append(headers)
    for cell in sheet[1]:
        cell.font = Font(bold=True)

    for row in rows:
        sheet.append([row[header] for header in headers])

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    autosize_columns(sheet)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    workbook.save(output_path)
    normalize_core_properties(output_path)


def main() -> int:
    output_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUTPUT_PATH
    if not output_path.is_absolute():
        output_path = (ROOT / output_path).resolve()

    data = load_inventory()
    rows = build_rows(data)
    write_workbook(rows, output_path)

    print(
        json.dumps(
            {
                "output": str(output_path),
                "rows": len(rows),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
