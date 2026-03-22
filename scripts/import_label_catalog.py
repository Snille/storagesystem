from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parent.parent
XLSX_PATH = ROOT / "data" / "Hyllsystem - Namnetiketter.xlsx"
INVENTORY_PATH = ROOT / "data" / "inventory.json"


@dataclass
class LabelRow:
    name: str
    description: str
    raw_location: str
    location_id: str
    suffix: str
    box_id: str


LOCATION_RE = re.compile(r"Ivar:\s*([A-ZÅÄÖ])\s*,\s*Hylla:\s*(\d+)\s*,\s*Plats:\s*(\d+)", re.IGNORECASE)
BOX_ID_RE = re.compile(r"^IVAR-([A-ZÅÄÖ]-H\d+-P\d+)-([A-Z])$")


def load_catalog_rows() -> list[LabelRow]:
    workbook = load_workbook(XLSX_PATH, data_only=True)
    sheet = workbook.active
    by_location: dict[str, list[tuple[str, str, str]]] = defaultdict(list)

    for row in sheet.iter_rows(min_row=2, values_only=True):
      name, description, raw_location = row[:3]
      if not name or not raw_location:
          continue
      match = LOCATION_RE.search(str(raw_location))
      if not match:
          continue
      ivar = match.group(1).upper()
      shelf = int(match.group(2))
      slot = int(match.group(3))
      location_id = f"{ivar}-H{shelf}-P{slot}"
      by_location[location_id].append((str(name).strip(), str(description or "").strip(), str(raw_location).strip()))

    result: list[LabelRow] = []
    for location_id, items in by_location.items():
      for index, (name, description, raw_location) in enumerate(items):
        suffix = chr(ord("A") + index)
        result.append(
          LabelRow(
            name=name,
            description=description,
            raw_location=raw_location,
            location_id=location_id,
            suffix=suffix,
            box_id=f"IVAR-{location_id}-{suffix}",
          )
        )

    return result


def load_inventory() -> dict[str, Any]:
    return json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))


def save_inventory(data: dict[str, Any]) -> None:
    INVENTORY_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify_keywords(*values: str) -> list[str]:
    text = " ".join(values).lower()
    tokens = re.findall(r"[a-zåäö0-9]{3,}", text)
    seen: list[str] = []
    for token in tokens:
      if token not in seen:
        seen.append(token)
    return seen[:12]


def merge_catalog() -> dict[str, int]:
    rows = load_catalog_rows()
    inventory = load_inventory()
    timestamp = now_iso()

    boxes: list[dict[str, Any]] = inventory["boxes"]
    sessions: list[dict[str, Any]] = inventory["sessions"]
    photos: list[dict[str, Any]] = inventory["photos"]

    rows_by_location: dict[str, list[LabelRow]] = defaultdict(list)
    for row in rows:
        rows_by_location[row.location_id].append(row)

    boxes_by_location: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for box in boxes:
        boxes_by_location[box["currentLocationId"]].append(box)

    sessions_by_box = defaultdict(list)
    for session in sessions:
        sessions_by_box[session["boxId"]].append(session)

    created_boxes = 0
    updated_boxes = 0
    created_sessions = 0
    reassigned_boxes = 0
    box_id_changes: dict[str, str] = {}
    rebuilt_boxes: list[dict[str, Any]] = []
    seen_box_object_ids: set[int] = set()

    for location_id, location_rows in rows_by_location.items():
        location_boxes = boxes_by_location.get(location_id, [])
        exact_matches: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
        for box in location_boxes:
            exact_matches[(box["label"].strip().lower(), location_id)].append(box)

        used_objects: set[int] = set()
        used_box_ids: set[str] = set()
        preserved_box_ids_by_row: dict[str, str] = {}

        # Preserve already-established box IDs when they are valid and unique for this location.
        for row in location_rows:
            key = (row.name.strip().lower(), location_id)
            candidates = [box for box in exact_matches.get(key, []) if id(box) not in used_objects]
            if not candidates:
                continue
            existing_box = candidates[0]
            match = BOX_ID_RE.match(existing_box["boxId"])
            if match and match.group(1) == location_id and existing_box["boxId"] not in used_box_ids:
                preserved_box_ids_by_row[row.name] = existing_box["boxId"]
                used_objects.add(id(existing_box))
                used_box_ids.add(existing_box["boxId"])

        used_objects.clear()
        used_box_ids.clear()

        for row in location_rows:
            key = (row.name.strip().lower(), location_id)
            candidates = [box for box in exact_matches.get(key, []) if id(box) not in used_objects]
            existing_box = candidates[0] if candidates else None
            desired_box_id = preserved_box_ids_by_row.get(row.name, row.box_id)
            if desired_box_id in used_box_ids:
                next_suffix_ord = ord("A")
                while True:
                    candidate = f"IVAR-{location_id}-{chr(next_suffix_ord)}"
                    next_suffix_ord += 1
                    if candidate not in used_box_ids:
                        desired_box_id = candidate
                        break

            if existing_box:
                old_box_id = existing_box["boxId"]
                existing_box["boxId"] = desired_box_id
                existing_box["label"] = row.name
                existing_box["currentLocationId"] = row.location_id
                existing_box["notes"] = row.description or existing_box.get("notes")
                existing_box["updatedAt"] = timestamp
                if old_box_id != desired_box_id:
                    box_id_changes[old_box_id] = desired_box_id
                    reassigned_boxes += 1
                box = existing_box
                updated_boxes += 1
            else:
                box = {
                    "boxId": desired_box_id,
                    "label": row.name,
                    "currentLocationId": row.location_id,
                    "notes": row.description or None,
                    "createdAt": timestamp,
                    "updatedAt": timestamp,
                }
                created_boxes += 1

            rebuilt_boxes.append(box)
            seen_box_object_ids.add(id(box))
            used_objects.add(id(box))
            used_box_ids.add(desired_box_id)

            if not sessions_by_box.get(desired_box_id):
                session_id = f"CATALOG-{row.location_id}-{row.suffix}"
                sessions.append(
                    {
                        "sessionId": session_id,
                        "boxId": desired_box_id,
                        "createdAt": timestamp,
                        "summary": row.description or f"Importerad från etikettkatalog: {row.name}",
                        "itemKeywords": slugify_keywords(row.name, row.description),
                        "notes": f"Importerad från Excel-katalog. Ursprunglig platssträng: {row.raw_location}",
                        "isCurrent": True,
                    }
                )
                created_sessions += 1

        # Preserve boxes that exist locally but were not present in the Excel file.
        next_suffix_ord = ord("A") + len(location_rows)
        for box in location_boxes:
            if id(box) in used_objects:
                continue
            if box["boxId"] in used_box_ids:
                old_box_id = box["boxId"]
                while True:
                    candidate = f"IVAR-{location_id}-{chr(next_suffix_ord)}"
                    next_suffix_ord += 1
                    if candidate not in used_box_ids:
                        break
                box["boxId"] = candidate
                box["updatedAt"] = timestamp
                box_id_changes[old_box_id] = candidate
                reassigned_boxes += 1
                used_box_ids.add(candidate)
            rebuilt_boxes.append(box)
            seen_box_object_ids.add(id(box))

    for box in boxes:
        if id(box) not in seen_box_object_ids:
            rebuilt_boxes.append(box)

    if box_id_changes:
        for session in sessions:
            session["boxId"] = box_id_changes.get(session["boxId"], session["boxId"])

    duplicate_counts = Counter(box["boxId"] for box in rebuilt_boxes)
    duplicates = [box_id for box_id, count in duplicate_counts.items() if count > 1]
    if duplicates:
        raise RuntimeError(f"Duplicerade boxId efter import: {duplicates}")

    inventory["boxes"] = sorted(rebuilt_boxes, key=lambda item: item["boxId"])
    inventory["sessions"] = sorted(sessions, key=lambda item: item["sessionId"])
    inventory["photos"] = photos

    save_inventory(inventory)

    return {
      "catalog_rows": len(rows),
      "created_boxes": created_boxes,
      "updated_boxes": updated_boxes,
      "reassigned_boxes": reassigned_boxes,
      "created_sessions": created_sessions,
      "total_boxes": len(inventory["boxes"]),
      "total_sessions": len(inventory["sessions"]),
    }


if __name__ == "__main__":
    summary = merge_catalog()
    print(json.dumps(summary, indent=2, ensure_ascii=False))
