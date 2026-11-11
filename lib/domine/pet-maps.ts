import type { PetAction } from "./pet";

export const PET_MAPS = [
  { id: "field", name: "들판", background: null },
  { id: "church", name: "성당 앞마당", background: "/pet/bg/church.webp" },
  { id: "street", name: "당정동", background: "/pet/bg/street.webp" },
  { id: "park", name: "공원 숲길", background: "/pet/bg/park.webp" },
  { id: "home", name: "도미네 집 마당", background: "/pet/bg/home.webp" },
] as const;
export type PetMap = typeof PET_MAPS[number]["id"];
export type SceneAction = PetAction | "sleep";
export type SceneCue = { id: number } & (
  { action: SceneAction | "tap" | "priest" } |
  { action: "map"; direction: 1 | -1 } |
  { action: "shop"; shop: number }
);

export function petMap(value: string) {
  return PET_MAPS.find((map) => map.id === value) ?? PET_MAPS[0];
}

export function neighborMap(current: string, direction: 1 | -1) {
  const index = PET_MAPS.indexOf(petMap(current));
  return PET_MAPS[(index + direction + PET_MAPS.length) % PET_MAPS.length];
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
