"""새 이미지를 사이트에 쓰기 전에 항상 거치는 변환 도구 (기본 절차).

  python scripts/optimize_images.py <원본 폴더 또는 파일> <저장 폴더> [--kind character|item|background] [--width N]

- 투명 배경(PNG)은 그대로 살려서 WebP 로 저장한다.
- 쓰이는 크기에 맞게 줄인다: character 640px, item 256px, background 1200px (그 이상은 줄이고, 작은 건 키우지 않는다).
- 원본은 건드리지 않는다. 결과가 원본보다 크면 경고한다.
"""
import argparse
import sys
from pathlib import Path

from PIL import Image

WIDTHS = {"character": 640, "item": 256, "background": 1200}
EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def convert(src: Path, dest_dir: Path, width: int, quality: int) -> None:
    im = Image.open(src)
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if has_alpha else "RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    dest_dir.mkdir(parents=True, exist_ok=True)
    out = dest_dir / (src.stem + ".webp")
    im.save(out, "WEBP", quality=quality, method=6)
    before, after = src.stat().st_size, out.stat().st_size
    flag = "  (!) 원본보다 큼" if after > before else ""
    print(f"{src.name} {before // 1024}KB -> {out.name} {after // 1024}KB ({im.width}x{im.height}){flag}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dest")
    ap.add_argument("--kind", choices=WIDTHS, default="item")
    ap.add_argument("--width", type=int)
    ap.add_argument("--quality", type=int, default=80)
    a = ap.parse_args()
    width = a.width or WIDTHS[a.kind]
    src = Path(a.src)
    files = [src] if src.is_file() else sorted(p for p in src.iterdir() if p.suffix.lower() in EXTS)
    if not files:
        print("변환할 이미지가 없습니다.")
        return 1
    for f in files:
        convert(f, Path(a.dest), width, a.quality)
    return 0


if __name__ == "__main__":
    sys.exit(main())
