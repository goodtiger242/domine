import type { PetMap, SceneCue } from "./pet-maps";

export type WorldCell = { id: string; name: string; theme: PetMap; kind: string };
export type Direction = NonNullable<Extract<SceneCue, { action: "map" }>["direction"]>;
export const DIRECTIONS = ["n", "s", "e", "w"] as const;
export const DEFAULT_CELL = "E5";

export function travelDirection(from: string, to: string): Direction {
  const dx = to.charCodeAt(0) - from.charCodeAt(0);
  const dy = Number(to.slice(1)) - Number(from.slice(1));
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "e" : "w") : (dy >= 0 ? "s" : "n");
}
export type MapTravel = { id: number; from: string; direction: Direction; phase: "exit" | "cross" | "enter"; reduced: boolean };

// 실제 지도(public/pet/world.webp, OpenStreetMap)의 200m 격자에서 읽은 장소. D5만 게임용 가상 장소이고, 가게 4곳은 대략의 위치다.
export const PET_WORLD: readonly WorldCell[] = [
  { id: "A1", name: "군포산본 율곡아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "B1", name: "화산초교 삼거리", theme: "street", kind: "삼거리" },
  { id: "C1", name: "군포시민체육광장", theme: "playground", kind: "체육 공원" },
  { id: "D1", name: "금당 숲길 입구", theme: "pilgrimpath", kind: "숲길" },
  { id: "E1", name: "금당로 숲 어귀", theme: "park", kind: "숲 어귀" },
  { id: "F1", name: "당산로 주택가", theme: "alley", kind: "주택가" },
  { id: "G1", name: "군포1동 골목", theme: "alley", kind: "주택가" },
  { id: "H1", name: "군포역", theme: "station", kind: "전철역" },
  { id: "I1", name: "공단로 거리", theme: "street", kind: "공단 거리" },
  { id: "J1", name: "당정로 공장 거리", theme: "street", kind: "공단 거리" },
  { id: "A2", name: "삼익소월아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "B2", name: "화산초등학교", theme: "school", kind: "초등학교" },
  { id: "C2", name: "체육광장 뒤 숲", theme: "park", kind: "숲" },
  { id: "D2", name: "금당 숲", theme: "mountain", kind: "숲" },
  { id: "E2", name: "금당로 60번길", theme: "alley", kind: "주택가" },
  { id: "F2", name: "당산로 19번길", theme: "alley", kind: "주택가" },
  { id: "G2", name: "군포로 큰길", theme: "street", kind: "큰길" },
  { id: "H2", name: "군포역 남쪽 광장", theme: "station", kind: "역 앞" },
  { id: "I2", name: "공단로 물류 거리", theme: "street", kind: "공단 거리" },
  { id: "J2", name: "산본로 고가", theme: "bridge", kind: "고가도로" },
  { id: "A3", name: "산본주공3단지아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "B3", name: "재궁동 숲길", theme: "pilgrimpath", kind: "숲길" },
  { id: "C3", name: "숲속 정자", theme: "overlook", kind: "쉼터" },
  { id: "D3", name: "금당 숲 기슭", theme: "mountain", kind: "숲" },
  { id: "E3", name: "금당로 17번길", theme: "alley", kind: "주택가" },
  { id: "F3", name: "당동 교회 골목", theme: "alley", kind: "주택가" },
  { id: "G3", name: "당동우체국 사거리", theme: "market", kind: "상가 사거리" },
  { id: "H3", name: "봉성로", theme: "street", kind: "거리" },
  { id: "I3", name: "당정고가", theme: "bridge", kind: "고가도로" },
  { id: "J3", name: "봉성로 공장 거리", theme: "street", kind: "공단 거리" },
  { id: "A4", name: "고산로 서쪽 길", theme: "street", kind: "큰길" },
  { id: "B4", name: "금당터널", theme: "bridge", kind: "터널" },
  { id: "C4", name: "금당터널 동쪽 입구", theme: "street", kind: "터널 입구" },
  { id: "D4", name: "신산본e편한세상아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "E4", name: "금당터널 사거리", theme: "street", kind: "사거리" },
  { id: "F4", name: "군포초등학교", theme: "school", kind: "초등학교" },
  { id: "G4", name: "고산로 도서관 골목", theme: "cafestreet", kind: "도서관 골목" },
  { id: "H4", name: "동아아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "I4", name: "철길 옆 텃밭", theme: "farm", kind: "녹지" },
  { id: "J4", name: "SK벤티움", theme: "street", kind: "지식산업센터" },
  { id: "A5", name: "감투봉 기슭 들판", theme: "field", kind: "들판" },
  { id: "B5", name: "감투봉 오솔길", theme: "pilgrimpath", kind: "숲길" },
  { id: "C5", name: "숲속 빈터", theme: "garden", kind: "빈터" },
  { id: "D5", name: "도미네 집 마당", theme: "home", kind: "가상 집 마당" },
  { id: "E5", name: "용호성당 마당", theme: "church", kind: "성당" },
  { id: "F5", name: "술이좋아", theme: "foodstreet", kind: "가게·주점" },
  { id: "G5", name: "쁘니네 지지미", theme: "foodstreet", kind: "가게·음식점" },
  { id: "H5", name: "고산로 228번길", theme: "alley", kind: "주택가" },
  { id: "I5", name: "공단로 교회 앞", theme: "churchback", kind: "교회 앞" },
  { id: "J5", name: "한세로 언덕길", theme: "churchback", kind: "언덕길" },
  { id: "A6", name: "감투봉 서쪽 숲", theme: "mountain", kind: "숲" },
  { id: "B6", name: "감투봉 숲", theme: "mountain", kind: "숲" },
  { id: "C6", name: "당동중학교", theme: "school", kind: "중학교" },
  { id: "D6", name: "당동초등학교", theme: "school", kind: "초등학교" },
  { id: "E6", name: "군포로 용호 구간", theme: "street", kind: "큰길" },
  { id: "F6", name: "당정동 상가 거리", theme: "street", kind: "상가 거리" },
  { id: "G6", name: "화락바베큐치킨", theme: "foodstreet", kind: "가게·음식점" },
  { id: "H6", name: "당정지하차도", theme: "bridge", kind: "지하차도" },
  { id: "I6", name: "한세로 12번길", theme: "alley", kind: "주택가" },
  { id: "J6", name: "한세대 가는 길", theme: "cafestreet", kind: "대학가" },
  { id: "A7", name: "감투봉 남쪽 숲", theme: "mountain", kind: "숲" },
  { id: "B7", name: "감투봉 기슭 길", theme: "pilgrimpath", kind: "숲길" },
  { id: "C7", name: "용호마을 e편한세상아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "D7", name: "용호1로", theme: "alley", kind: "주택가" },
  { id: "E7", name: "당동주공2단지아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "F7", name: "당동주공4단지아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "G7", name: "군포옥천초등학교", theme: "school", kind: "초등학교" },
  { id: "H7", name: "당정근린공원", theme: "park", kind: "근린공원" },
  { id: "I7", name: "당정역", theme: "station", kind: "전철역" },
  { id: "J7", name: "한세대학교", theme: "school", kind: "대학교" },
  { id: "A8", name: "삼성로 69번길", theme: "alley", kind: "주택가" },
  { id: "B8", name: "삼성마을1단지아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "C8", name: "용호사거리 골목", theme: "alley", kind: "주택가" },
  { id: "D8", name: "용호고등학교", theme: "school", kind: "고등학교" },
  { id: "E8", name: "용호초등학교", theme: "school", kind: "초등학교" },
  { id: "F8", name: "용호2로 교회 골목", theme: "alley", kind: "주택가" },
  { id: "G8", name: "용호중학교", theme: "school", kind: "중학교" },
  { id: "H8", name: "신기천 산책로", theme: "stream", kind: "하천 산책로" },
  { id: "I8", name: "당정역로", theme: "street", kind: "거리" },
  { id: "J8", name: "당정동 아파트 단지", theme: "apartment", kind: "아파트 단지" },
  { id: "A9", name: "삼성마을2단지아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "B9", name: "복합생활스포츠타운", theme: "playground", kind: "체육 시설" },
  { id: "C9", name: "삼성로 공원길", theme: "park", kind: "공원길" },
  { id: "D9", name: "골프클럽 앞 삼거리", theme: "street", kind: "삼거리" },
  { id: "E9", name: "골프연습장", theme: "field", kind: "골프 연습장" },
  { id: "F9", name: "골프장 둘레길", theme: "bikepath", kind: "둘레길" },
  { id: "G9", name: "골프장 연못", theme: "lake", kind: "연못" },
  { id: "H9", name: "골프장 숲길", theme: "park", kind: "숲길" },
  { id: "I9", name: "당정역로 남쪽", theme: "street", kind: "거리" },
  { id: "J9", name: "철길 옆 길", theme: "street", kind: "철도변" },
  { id: "A10", name: "신기초등학교", theme: "school", kind: "초등학교" },
  { id: "B10", name: "신기초 옆 골목", theme: "alley", kind: "주택가" },
  { id: "C10", name: "스포츠타운 운동장", theme: "park", kind: "운동장" },
  { id: "D10", name: "군포로 남쪽 길", theme: "street", kind: "큰길" },
  { id: "E10", name: "골프장 연못가", theme: "lake", kind: "연못" },
  { id: "F10", name: "안양컨트리클럽", theme: "garden", kind: "골프장" },
  { id: "G10", name: "골프장 잔디 언덕", theme: "field", kind: "잔디 언덕" },
  { id: "H10", name: "골프장 동쪽 숲", theme: "park", kind: "숲" },
  { id: "I10", name: "철도 차량기지 옆", theme: "street", kind: "철도변" },
  { id: "J10", name: "의왕 철도기지", theme: "street", kind: "철도 기지" },
];

export function worldCell(id: string) {
  return PET_WORLD.find((cell) => cell.id === id) ?? PET_WORLD[44];
}

export function neighborCell(id: string, direction: Direction): WorldCell | null {
  const index = PET_WORLD.findIndex((cell) => cell.id === id);
  if (index < 0) return null;
  const col = index % 10 + (direction === "e" ? 1 : direction === "w" ? -1 : 0);
  const row = Math.floor(index / 10) + (direction === "s" ? 1 : direction === "n" ? -1 : 0);
  return col < 0 || col > 9 || row < 0 || row > 9 ? null : PET_WORLD[row * 10 + col];
}

export function savedCell(value: string | null, legacy: string | null) {
  if (value !== null) return worldCell(value).id;
  const old: Record<string, string> = { church: "E5", home: "D5", field: "A5", street: "F6", park: "H7" };
  const key = legacy ?? "";
  return Object.hasOwn(old, key) ? old[key] : DEFAULT_CELL;
}

export function visitedCells(value: string): string[] {
  try {
    const ids: unknown = JSON.parse(value);
    return Array.isArray(ids) ? [...new Set(ids.filter((id) => typeof id === "string" && PET_WORLD.some((cell) => cell.id === id)))] : [];
  } catch { return []; }
}
