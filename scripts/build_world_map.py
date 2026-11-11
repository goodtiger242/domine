"""동네 지도 시트용 실제 지도 한 장을 만든다 (OpenStreetMap 타일, © OpenStreetMap contributors, ODbL).

  python scripts/build_world_map.py <저장할.png>

용호성당(37.34720, 126.94102)이 E5 칸 가운데에 오도록 2km x 2km(한 칸 200m, 10x10)를 잘라 낸다.
한 번만 돌려 결과를 scripts/optimize_images.py 로 줄여 public/pet/world.webp 에 둔다(타일 서버를 반복 호출하지 않는다).
"""
import io
import math
import sys
import time
import urllib.request

from PIL import Image

LAT, LON, CELL_M, ZOOM = 37.34720, 126.94102, 200, 16
M_LAT = 111320.0
M_LON = M_LAT * math.cos(math.radians(LAT))
NORTH, SOUTH = LAT + 4.5 * CELL_M / M_LAT, LAT - 5.5 * CELL_M / M_LAT
WEST, EAST = LON - 4.5 * CELL_M / M_LON, LON + 5.5 * CELL_M / M_LON


def px(lat: float, lon: float) -> tuple[float, float]:
    n = 256 * 2 ** ZOOM
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2
    return (lon + 180) / 360 * n, y * n


def main() -> int:
    x0, y0 = px(NORTH, WEST)
    x1, y1 = px(SOUTH, EAST)
    tx0, ty0, tx1, ty1 = int(x0 // 256), int(y0 // 256), int(x1 // 256), int(y1 // 256)
    sheet = Image.new("RGB", ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            req = urllib.request.Request(f"https://tile.openstreetmap.org/{ZOOM}/{tx}/{ty}.png",
                                         headers={"User-Agent": "domine-pet-map/1.0 (one-time static map build)"})
            with urllib.request.urlopen(req, timeout=30) as res:
                sheet.paste(Image.open(io.BytesIO(res.read())).convert("RGB"), ((tx - tx0) * 256, (ty - ty0) * 256))
            time.sleep(0.3)
    box = tuple(round(v) for v in (x0 - tx0 * 256, y0 - ty0 * 256, x1 - tx0 * 256, y1 - ty0 * 256))
    out = sheet.crop(box).resize((1200, 1200), Image.LANCZOS)
    out.save(sys.argv[1])
    print(f"tiles {(tx1 - tx0 + 1) * (ty1 - ty0 + 1)}, crop {box}, bounds N{NORTH:.5f} S{SOUTH:.5f} W{WEST:.5f} E{EAST:.5f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
