#!/usr/bin/env python3
"""
Rebuild extension/data/wildlink-app-display-names.json from a tab-separated file:
  application_id<TAB>name

Default input: extension/data/wildlink-application-catalog.tsv
Usage:
  python3 extension/scripts/build-wildlink-display-names.py
  python3 extension/scripts/build-wildlink-display-names.py /path/to/catalog.tsv
"""
from __future__ import annotations

import json
import pathlib
import re
import sys


def main() -> None:
    root = pathlib.Path(__file__).resolve().parents[1]
    tsv_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / "data" / "wildlink-application-catalog.tsv"
    out_path = root / "data" / "wildlink-app-display-names.json"

    if not tsv_path.is_file():
        print(f"Missing TSV: {tsv_path}", file=sys.stderr)
        sys.exit(1)

    text = tsv_path.read_text(encoding="utf-8")
    obj: dict[str, str] = {
        "_readme": "Wildlink application_id → display name. Regenerate: python3 extension/scripts/build-wildlink-display-names.py"
    }

    for line in text.splitlines():
        line = line.strip()
        if not line or line.lower().startswith("application_id"):
            continue
        if "\t" in line:
            aid, name = line.split("\t", 1)
        else:
            m = re.match(r"^(\d+)\s+(.+)$", line)
            if not m:
                continue
            aid, name = m.group(1), m.group(2)
        aid = aid.strip()
        name = name.strip().strip('"').strip()
        if aid.isdigit() and name:
            obj[aid] = name

    out_path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(obj) - 1} application(s) to {out_path}")


if __name__ == "__main__":
    main()
