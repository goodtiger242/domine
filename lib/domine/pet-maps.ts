import { BACKGROUNDS, CHURCH_BACKGROUNDS, backgroundAt } from "./pet-photos";
import type { PetAction } from "./pet";

export const PET_MAPS = [
  { id: "field", name: "들판", background: null },
  { id: "church", name: "용호성당 마당", background: null },
  { id: "street", name: "당정동", background: "/pet/bg/street.webp" },
  { id: "park", name: "공원 숲길", background: "/pet/bg/park.webp" },
  { id: "home", name: "도미네 집 마당", background: "/pet/bg/home.webp" },
  { id: "playground", name: "놀이터", background: "/pet/bg/playground.webp" },
  { id: "stream", name: "개울", background: "/pet/bg/stream.webp" },
  { id: "churchback", name: "성당 뒷길", background: "/pet/bg/churchback.webp" },
  { id: "alley", name: "골목", background: "/pet/bg/alley.webp" },
  { id: "market", name: "시장", background: "/pet/bg/market.webp" },
  { id: "station", name: "역", background: "/pet/bg/station.webp" },
  { id: "mountain", name: "산", background: "/pet/bg/mountain.webp" },
  { id: "lake", name: "호수", background: "/pet/bg/lake.webp" },
  { id: "school", name: "학교", background: "/pet/bg/school.webp" },
  { id: "foodstreet", name: "식당가", background: "/pet/bg/foodstreet.webp" },
  { id: "cafestreet", name: "카페 거리", background: "/pet/bg/cafestreet.webp" },
  { id: "bakery", name: "빵집", background: "/pet/bg/bakery.webp" },
  { id: "apartment", name: "아파트", background: "/pet/bg/apartment.webp" },
  { id: "bikepath", name: "자전거길", background: "/pet/bg/bikepath.webp" },
  { id: "overlook", name: "전망대", background: "/pet/bg/overlook.webp" },
  { id: "garden", name: "정원", background: "/pet/bg/garden.webp" },
  { id: "bridge", name: "다리", background: "/pet/bg/bridge.webp" },
  { id: "pilgrimpath", name: "숲길", background: "/pet/bg/pilgrimpath.webp" },
  { id: "farm", name: "논밭", background: "/pet/bg/farm.webp" },
] as const;
export type PetMap = typeof PET_MAPS[number]["id"];
export const DEFAULT_MAP: PetMap = "church";
export type SceneAction = PetAction | "sleep";
export type SceneCue = { id: number } & (
  { action: SceneAction | "tap" | "priest" } |
  { action: "map"; direction: "n" | "s" | "e" | "w" } |
  { action: "shop"; shop: number }
);

export function petMap(value: string) {
  return PET_MAPS.find((map) => map.id === value) ?? PET_MAPS[1];
}

export function actionsForMap(actions: readonly PetAction[], map: string): SceneAction[] {
  return map === "home" ? [...actions, "sleep"] : [...actions];
}

// 생성 사진(1774×887)을 확인한 간판 중심 좌표(%). 배경은 잘라내지 않고 장면 전체에 맞춘다.
export const SHOPS = [
  { name: "술이 좋아", x: 13.5, y: 19.5, line: "shop_pub" },
  { name: "맥도날드", x: 37.7, y: 19.5, line: "shop_burger" },
  { name: "쁘니네", x: 62.2, y: 19.5, line: "shop_restaurant" },
  { name: "화락", x: 86.5, y: 19.5, line: "shop_store" },
] as const;

export function mapBackground(map: PetMap, hour: number) {
  return petMap(map).background ?? (map === "church" ? CHURCH_BACKGROUNDS : BACKGROUNDS)[backgroundAt(hour)];
}
