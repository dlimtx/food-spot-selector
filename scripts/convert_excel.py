"""Convert food_spots.xlsx into data/food_spots.json for the web app."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "food_spots.xlsx"
OUT = ROOT / "data" / "food_spots.json"


def split_csv(value: object) -> list[str]:
    text = str(value).strip()
    if not text or text.upper() == "NIL":
        return []
    return [part.strip() for part in text.split(",") if part.strip()]


def parse_closing_days(value: object) -> list[str]:
    text = str(value).strip()
    if not text or text.upper() == "NIL":
        return []
    return [part.strip() for part in re.split(r"[,/]", text) if part.strip()]


def main() -> None:
    df = pd.read_excel(SOURCE).fillna("")
    spots = []
    for _, row in df.iterrows():
        spots.append(
            {
                "place": str(row["Place"]).strip(),
                "cuisine": str(row["Cuisine"]).strip(),
                "dishes": split_csv(row["Dish"]),
                "open": int(row["Opening hours"]),
                "close": int(row["Closing hours"]),
                "closingDays": parse_closing_days(row["Closing days"]),
                "locations": split_csv(row["Location"]),
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(spots, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(spots)} spots to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
