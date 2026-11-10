"""격자로 그린 소품 시트를 한 개씩 잘라 투명 배경 WebP 로 만든다 (이미지 기본 절차의 일부).

  python scripts/cut_sheet.py <시트.png> <저장 폴더> <이름1,이름2,...> [--cols 4 --rows 2 --bg FF00FF --width 256]

- 배경은 한 가지 단색(기본 마젠타 #FF00FF)이어야 한다. 그 색과 먼 픽셀을 물체로 본다.
- 칸(격자)마다 물체 하나: 물체 가운데가 속한 칸으로 나누고, 이름은 왼쪽 위부터 행 순서.
- 가장자리에 배경색이 비치지 않게 색을 되돌린 뒤, 쓰이는 크기로 줄여 WebP 로 저장한다.
"""
import argparse
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("dest")
    ap.add_argument("names")
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--rows", type=int, default=2)
    ap.add_argument("--bg", default="FF00FF")
    ap.add_argument("--width", type=int, default=256)
    ap.add_argument("--quality", type=int, default=82)
    a = ap.parse_args()

    names = [n.strip() for n in a.names.split(",")]
    rgb = np.asarray(Image.open(a.sheet).convert("RGB")).astype(np.float32)
    H, W, _ = rgb.shape
    bg = np.array([int(a.bg[i : i + 2], 16) for i in (0, 2, 4)], np.float32)
    dist = np.sqrt(((rgb - bg) ** 2).sum(-1))

    hard = (dist > 110).astype(np.uint8)
    hard = cv2.morphologyEx(hard, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, stats, cent = cv2.connectedComponentsWithStats(hard)
    min_area = H * W * 0.0015
    cells: dict[int, np.ndarray] = {}
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < min_area:
            continue
        cx, cy = cent[i]
        c = min(a.cols - 1, int(cx / (W / a.cols)))
        r = min(a.rows - 1, int(cy / (H / a.rows)))
        k = r * a.cols + c
        cells[k] = np.maximum(cells.get(k, np.zeros_like(hard)), (lab == i).astype(np.uint8))

    out = Path(a.dest)
    out.mkdir(parents=True, exist_ok=True)
    for k, name in enumerate(names):
        if not name or name == "-":
            continue
        if k not in cells:
            print(f"(!) {name}: 칸 {k} 에서 물체를 못 찾음")
            continue
        m = cells[k]
        # 구멍은 메우지 않는다(도넛 구멍처럼 안쪽 배경은 투명해야 함). 테두리만 살짝 넓혀 가장자리를 포함
        region = cv2.dilate(m, np.ones((5, 5), np.uint8))
        alpha = np.clip((dist - 40) / 90, 0, 1) * region
        alpha = np.maximum(alpha, m.astype(np.float32))
        # 배경색 섞임 되돌리기: c = a*fg + (1-a)*bg  ->  fg = (c - (1-a)*bg) / a
        a3 = np.clip(alpha, 1e-3, 1)[..., None]
        fg = np.clip((rgb - (1 - a3) * bg) / a3, 0, 255)
        ys, xs = np.where(alpha > 0.05)
        pad = 4
        y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + pad)
        x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + pad)
        rgba = np.dstack([fg, alpha * 255])[y0:y1, x0:x1].astype(np.uint8)
        im = Image.fromarray(rgba, "RGBA")
        side = max(im.width, im.height)
        if side > a.width:
            s = a.width / side
            im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        p = out / f"{name}.webp"
        im.save(p, "WEBP", quality=a.quality, method=6)
        print(f"{name}: {im.width}x{im.height} {p.stat().st_size // 1024}KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
