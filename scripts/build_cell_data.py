"""domine-ref/cells-real.json(실제 동네 조사)과 public/pet/cell/*.webp로 lib/domine/pet-cell-data.ts를 만든다.

  python scripts/build_cell_data.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
cells = json.loads((ROOT.parent / "domine-ref" / "cells-real.json").read_text(encoding="utf-8"))
approved = ROOT.parent / "domine-ref" / "approved.txt"  # 검수 통과한 칸만 그림을 쓴다(한 줄에 칸 하나)
allow = set(approved.read_text(encoding="utf-8").split()) if approved.exists() else set()
images = {p.stem for p in (ROOT / "public" / "pet" / "cell").glob("*.webp")} & allow
out = {}
for c in cells:
    shops = sorted(c.get("shops") or [], key=lambda s: -(s.get("reviews") or 0))
    out[c["cell"]] = {"landmark": c.get("landmark") or "", "shops": [s["name"] for s in shops[:2]], "image": c["cell"] in images}
body = json.dumps(out, ensure_ascii=False, indent=1)
(ROOT / "lib" / "domine" / "pet-cell-data.ts").write_text(
    "// scripts/build_cell_data.py가 만든 파일. 실제 동네 조사(카카오맵, 2026-11-11) 기준 랜드마크와 리뷰 많은 가게.\n"
    "export const CELL_DATA: Record<string, { landmark: string; shops: string[]; image: boolean }> = " + body + ";\n", encoding="utf-8")
print(len(out), sum(v["image"] for v in out.values()))
