import type { PetMap, SceneCue } from "./pet-maps";

export type WorldCell = { id: string; name: string; theme: PetMap; kind: string };
export type Direction = Extract<SceneCue, { action: "map" }>["direction"];
export const DIRECTIONS = ["n", "s", "e", "w"] as const;
export const DEFAULT_CELL = "E5";

// docs/pet-world-research.md의 압축 배치. A5·D5만 게임용 가상 장소다.
export const PET_WORLD: readonly WorldCell[] = [
  { id: "A1", name: "도장중학교", theme: "school", kind: "중학교" },
  { id: "B1", name: "도장공원", theme: "park", kind: "근린공원" },
  { id: "C1", name: "산본역", theme: "station", kind: "전철역" },
  { id: "D1", name: "산본역 동쪽 상가 거리", theme: "street", kind: "상가 구역" },
  { id: "E1", name: "산본로 북측 거리", theme: "street", kind: "도로 구역" },
  { id: "F1", name: "군포성당", theme: "church", kind: "성당" },
  { id: "G1", name: "군포고등학교", theme: "school", kind: "고등학교" },
  { id: "H1", name: "금정중학교", theme: "school", kind: "중학교" },
  { id: "I1", name: "군포양정초등학교", theme: "school", kind: "초등학교" },
  { id: "J1", name: "한우물공원", theme: "park", kind: "근린공원" },
  { id: "A2", name: "철쭉동산", theme: "garden", kind: "꽃동산" },
  { id: "B2", name: "산본동 고산로 주변", theme: "street", kind: "주거·상가 구역" },
  { id: "C2", name: "금정동 오금로 주거 구역", theme: "apartment", kind: "주거 구역" },
  { id: "D2", name: "군포화산초등학교", theme: "school", kind: "초등학교" },
  { id: "E2", name: "당동 산본로249번길 주변", theme: "alley", kind: "주택가 골목" },
  { id: "F2", name: "웃터어린이공원", theme: "playground", kind: "어린이공원" },
  { id: "G2", name: "참말어린이공원", theme: "playground", kind: "어린이공원" },
  { id: "H2", name: "군포중학교", theme: "school", kind: "중학교" },
  { id: "I2", name: "군포역", theme: "station", kind: "전철역" },
  { id: "J2", name: "군포역전시장", theme: "market", kind: "전통시장" },
  { id: "A3", name: "신흥초등학교", theme: "school", kind: "초등학교" },
  { id: "B3", name: "흥진고등학교", theme: "school", kind: "고등학교" },
  { id: "C3", name: "흥진초등학교", theme: "school", kind: "초등학교" },
  { id: "D3", name: "오금로 남측 주거 구역", theme: "apartment", kind: "주거 구역" },
  { id: "E3", name: "월구지어린이공원", theme: "playground", kind: "어린이공원" },
  { id: "F3", name: "당동로시장", theme: "market", kind: "골목형 상점가" },
  { id: "G3", name: "안골어린이공원", theme: "playground", kind: "어린이공원" },
  { id: "H3", name: "효자어린이공원", theme: "playground", kind: "어린이공원" },
  { id: "I3", name: "당말어린이공원", theme: "playground", kind: "어린이공원" },
  { id: "J3", name: "봉성로 주변 거리", theme: "street", kind: "도로·상가 구역" },
  { id: "A4", name: "수리산역", theme: "station", kind: "전철역" },
  { id: "B4", name: "번영로 수리산역 동쪽 구간", theme: "street", kind: "큰길" },
  { id: "C4", name: "금당터널 서쪽 주거 구역", theme: "apartment", kind: "주거 구역" },
  { id: "D4", name: "금당터널입구·대림아파트 정류장 주변", theme: "street", kind: "버스 정류 거점" },
  { id: "E4", name: "신산본KCC아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "F4", name: "군포초등학교", theme: "school", kind: "초등학교" },
  { id: "G4", name: "교전어린이공원", theme: "playground", kind: "어린이공원" },
  { id: "H4", name: "새마을어린이공원", theme: "playground", kind: "어린이공원" },
  { id: "I4", name: "군포당동우체국", theme: "street", kind: "우체국" },
  { id: "J4", name: "한세로 북측 주거 구역", theme: "alley", kind: "주택가" },
  { id: "A5", name: "들판", theme: "field", kind: "가상 들판" },
  { id: "B5", name: "당동 금당터널 남쪽 주거 구역", theme: "alley", kind: "주거 구역" },
  { id: "C5", name: "용호마을 LG아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "D5", name: "도미네 집 마당", theme: "home", kind: "가상 집 마당" },
  { id: "E5", name: "용호성당 마당", theme: "church", kind: "성당" },
  { id: "F5", name: "술이좋아", theme: "foodstreet", kind: "기존 사용 가게·주점" },
  { id: "G5", name: "쁘니네 지지미", theme: "foodstreet", kind: "기존 사용 가게·음식점" },
  { id: "H5", name: "한세로12번안길", theme: "alley", kind: "주택가 골목" },
  { id: "I5", name: "당정초등학교", theme: "school", kind: "초등학교" },
  { id: "J5", name: "당정중학교", theme: "school", kind: "중학교" },
  { id: "A6", name: "감투봉 북쪽 숲", theme: "mountain", kind: "산자락" },
  { id: "B6", name: "당동 용호1로 서쪽 주거 구역", theme: "alley", kind: "주거 구역" },
  { id: "C6", name: "당동중학교", theme: "school", kind: "중학교" },
  { id: "D6", name: "당동초등학교", theme: "school", kind: "초등학교" },
  { id: "E6", name: "군포2동 행정복지센터", theme: "street", kind: "행정복지센터" },
  { id: "F6", name: "당정동 상가 거리", theme: "street", kind: "상가 거리" },
  { id: "G6", name: "화락바베큐치킨 군포당동점", theme: "foodstreet", kind: "기존 사용 가게·음식점" },
  { id: "H6", name: "한세대학교", theme: "school", kind: "대학교" },
  { id: "I6", name: "한세대학교 앞 한세로", theme: "foodstreet", kind: "대학가 식당 거리" },
  { id: "J6", name: "고산로151번길 주변", theme: "street", kind: "학교 주변 거리" },
  { id: "A7", name: "감투봉 북동쪽 숲", theme: "pilgrimpath", kind: "산자락" },
  { id: "B7", name: "샛터말어린이공원", theme: "playground", kind: "어린이공원" },
  { id: "C7", name: "해오름어린이공원", theme: "playground", kind: "어린이공원" },
  { id: "D7", name: "당동주공2단지아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "E7", name: "용호중학교", theme: "school", kind: "중학교" },
  { id: "F7", name: "군포옥천초등학교", theme: "school", kind: "초등학교" },
  { id: "G7", name: "당정역", theme: "station", kind: "전철역" },
  { id: "H7", name: "별님어린이공원", theme: "playground", kind: "어린이공원" },
  { id: "I7", name: "당정역로 동쪽 주거 구역", theme: "alley", kind: "주거 구역" },
  { id: "J7", name: "한세로16번길 주변", theme: "alley", kind: "주택가 골목" },
  { id: "A8", name: "감투봉", theme: "mountain", kind: "산" },
  { id: "B8", name: "감투봉 동쪽 산자락", theme: "mountain", kind: "숲 구역" },
  { id: "C8", name: "신기천 북쪽 구간", theme: "stream", kind: "하천" },
  { id: "D8", name: "용호고등학교", theme: "school", kind: "고등학교" },
  { id: "E8", name: "용호초등학교", theme: "school", kind: "초등학교" },
  { id: "F8", name: "샘들어린이공원", theme: "playground", kind: "어린이공원" },
  { id: "G8", name: "당정근린공원", theme: "park", kind: "근린공원" },
  { id: "H8", name: "골프장둘레길 철도변 북쪽 구간", theme: "park", kind: "공공 산책로" },
  { id: "I8", name: "당정역로 남쪽 거리", theme: "street", kind: "동네 거리" },
  { id: "J8", name: "당정동 남동쪽 도로 구역", theme: "street", kind: "도로 구역" },
  { id: "A9", name: "감투봉 남쪽 산자락", theme: "mountain", kind: "숲 구역" },
  { id: "B9", name: "삼성마을5단지아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "C9", name: "군포신기초등학교", theme: "school", kind: "초등학교" },
  { id: "D9", name: "군포국민체육센터", theme: "playground", kind: "공공 체육시설" },
  { id: "E9", name: "신기천 꽃길 입구", theme: "garden", kind: "하천 산책로" },
  { id: "F9", name: "신기천 꽃길", theme: "stream", kind: "하천 산책로" },
  { id: "G9", name: "골프장둘레길 철도변 중간 구간", theme: "park", kind: "공공 산책로" },
  { id: "H9", name: "골프장둘레길 철도변 남쪽 구간", theme: "park", kind: "공공 산책로" },
  { id: "I9", name: "당정동 철길 동쪽 거리", theme: "street", kind: "도로 구역" },
  { id: "J9", name: "당정동 남동쪽 경계 거리", theme: "street", kind: "도로 구역" },
  { id: "A10", name: "부곡동 삼성마을 서쪽 주거 구역", theme: "apartment", kind: "주거 구역" },
  { id: "B10", name: "산이슬어린이공원", theme: "playground", kind: "어린이공원" },
  { id: "C10", name: "삼성마을1단지아파트", theme: "apartment", kind: "아파트 단지" },
  { id: "D10", name: "산마을어린이공원", theme: "playground", kind: "어린이공원" },
  { id: "E10", name: "삼성로 주변 거리", theme: "street", kind: "동네 거리" },
  { id: "F10", name: "골프장둘레길 남서쪽 외곽 구간", theme: "park", kind: "공공 산책로" },
  { id: "G10", name: "삼성천 둘레길 구간", theme: "stream", kind: "하천" },
  { id: "H10", name: "삼성천·철도변 연결 구간", theme: "stream", kind: "하천 산책로" },
  { id: "I10", name: "골프장둘레길 남동쪽 외곽 구간", theme: "park", kind: "공공 산책로" },
  { id: "J10", name: "당정동 남동쪽 외곽 도로", theme: "street", kind: "도로 구역" },
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
  const old: Record<string, string> = { church: "E5", home: "D5", field: "A5", street: "F6", park: "B1" };
  const key = legacy ?? "";
  return Object.hasOwn(old, key) ? old[key] : DEFAULT_CELL;
}

export function visitedCells(value: string): string[] {
  try {
    const ids: unknown = JSON.parse(value);
    return Array.isArray(ids) ? [...new Set(ids.filter((id) => typeof id === "string" && PET_WORLD.some((cell) => cell.id === id)))] : [];
  } catch { return []; }
}
