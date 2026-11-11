import { PET_WORLD } from "../pet-world";
import { buildFighter } from "./rules";
import { random, seedFor } from "./rng";
import type { Difficulty } from "./types";

// First-stage pools retain the source theme's breeds where possible; empty pools use a nearby activity group.
export const THEME_POOLS: Readonly<Record<string, readonly string[]>> = {
  church: ["B001","B002","B004"], field: ["B015","B020"], street: ["B009","B015"],
  park: ["B001","B017","B022"], home: ["B002","B009"], playground: ["B007","B015"],
  stream: ["B001","B020"], churchback: ["B001","B004"], alley: ["B003","B018"],
  market: ["B004","B009"], station: ["B003","B018"], mountain: ["B003","B005","B020"],
  lake: ["B001","B020"], school: ["B007","B022"], foodstreet: ["B002","B009"],
  cafestreet: ["B009","B007"], bakery: ["B002","B009"], apartment: ["B002","B009","B015"],
  bikepath: ["B020","B022"], overlook: ["B005","B020"], garden: ["B004","B007"],
  bridge: ["B003","B020"], pilgrimpath: ["B003","B004","B005","B020"], farm: ["B015","B022"],
};
const TITLES: Readonly<Record<string, string>> = {
  church: "마당을 산책하는 봉사자", field: "공을 챙겨 온 이웃", street: "걸어서 퇴근하는 이웃", park: "벤치에서 쉬는 산책객",
  home: "마당에 놀러 온 이웃", playground: "공놀이 모임원", stream: "물새를 관찰하는 산책객", churchback: "화단 봉사자",
  alley: "화분을 손질하던 이웃", market: "장을 본 이웃", station: "약속을 기다리는 산책객", mountain: "등산을 마친 이웃",
  lake: "풍경을 그리는 사람", school: "운동장을 걷는 이웃", foodstreet: "포장을 기다리는 이웃", cafestreet: "산책 중 쉬는 독서가",
  bakery: "빵 봉투를 든 이웃", apartment: "단지 산책 모임원", bikepath: "자전거를 세워 둔 산책객", overlook: "쉬어 가는 등산객",
  garden: "꽃 사진을 찍는 이웃", bridge: "다리 입구에서 쉬는 산책객", pilgrimpath: "길 안내 봉사자", farm: "텃밭을 돌보는 이웃",
};
export function opponentFor(cellId: string, daySeed: number, playerLevel: number) {
  const cell = PET_WORLD.find(c => c.id === cellId);
  if (!cell || !Number.isSafeInteger(daySeed) || !Number.isInteger(playerLevel) || playerLevel < 1 || playerLevel > 30) throw new Error("지도 칸·날짜 시드·플레이어 레벨을 확인해 주세요.");
  const distance = Math.max(Math.abs(cellId.charCodeAt(0) - 69),Math.abs(Number(cellId.slice(1)) - 5));
  const rank = Math.min(5,1 + Math.floor(distance / 2));
  const level = Math.min(30,1 + 2 * distance);
  let rng = seedFor(cellId,daySeed);
  const pick = <T,>(values: readonly T[]): T => { const next = random(rng); rng = next.seed; return values[Math.floor(next.value * values.length)]; };
  const pool = THEME_POOLS[cell.theme];
  if (!pool) throw new Error("아직 정의하지 않은 풍경입니다.");
  const breedId = pick(pool), equipment: string[] = [];
  if (rank >= 2) equipment.push(pick(["I01","I02","I04"]));
  if (rank >= 3) equipment.push(pick(["I07","I08"]));
  if (rank >= 4) equipment.push("I13");
  const consumable = rank >= 3 ? "I19" : undefined;
  const fighter = buildFighter(breedId,level,equipment,{ consumable });
  return { cellId, theme: cell.theme, distance, rank, fighter,
    npc: { name: pick(["유진","민호","서연","정우","다은","하람"]), title: TITLES[cell.theme] },
    difficulty: (rank >= 3 ? "hard" : "normal") as Difficulty, levelDifference: level - playerLevel };
}
