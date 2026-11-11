import { mapBackground } from "./pet-maps";
import { worldCell } from "./pet-world";
import { CELL_DATA } from "./pet-cell-data";

/** 칸 배경: 실제 동네를 그린 칸 그림이 있으면 그것, 없으면 풍경 기본 그림. */
export function cellBackground(id: string, hour: number) {
  return CELL_DATA[id]?.image ? `/pet/cell/${id}.webp` : mapBackground(worldCell(id).theme, hour);
}

/** 장면에 크게 세울 실제 가게 이름(리뷰 많은 순, 최대 2개). */
export function cellShops(id: string): string[] {
  return CELL_DATA[id]?.shops ?? [];
}
