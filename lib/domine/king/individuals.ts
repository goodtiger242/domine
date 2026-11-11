import type { Condition, Group, Stats, Temperament } from "../battle/types";
import { random, seedFor } from "../battle/rng";
import { PET_WORLD } from "../pet-world";
import { BREEDS, GROUPS, SPECIES, type Habitat, type SpeciesKey } from "./species";
import { habitatOf, levelRange, SAFE_CELLS } from "./world";

export const FORM_TAGS = ["contact", "sound", "scent", "trick", "multi", "charge", "gaze"] as const;
export type FormTag = typeof FORM_TAGS[number];
export const INTELLIGENCE = ["순둥이", "보통", "노련", "대장", "싸움왕"] as const;
export type Intelligence = typeof INTELLIGENCE[number];
export interface Individual {
  id: string; seed: number; name: string; epithet: string; species: SpeciesKey; breedId: string;
  temperament: Temperament; homeCellId: string; habitat: Habitat;
  owner: { name: string; title: string } | null; ownerLabel: string;
  appearance: { art: string; look: string; scale: number; facing: "left" | "right" };
  group: Group; weakness: FormTag; resistance: FormTag; intelligence: Intelligence;
  condition: Condition; levelOffset: number; baseLevel: number; statShift: Partial<Stats>;
}
const PREFIXES = "작은 큰 고운 둥근 맑은 느린 빠른 흰 검은 노란 붉은 파란 은빛 금빛 초록 분홍 봄 여름 가을 겨울 새벽 저녁 달 별 꽃 눈 비 솔 돌 물 햇 숲".split(" ");
export const SINGLE_NAMES = "두부 콩이 콩순이 콩돌이 팥이 깨비 참깨 들깨 녹두 완두 보리 밀쌀 찹쌀 현미 누룽지 숭늉 떡국 인절미 찰떡 송편 만두 찐빵 호빵 식빵 모닝 베이글 쿠키 와플 머핀 스콘 호두 밤이 도토리 땅콩 잣이 은행 아몬드 밤톨 깨알 콩알 감자 고구마 당근 호박 오이 가지 무순 배추 양파 토란 사과 배리 복숭아 자두 살구 앵두 체리 딸기 포도 망고 레몬 유자 귤이 한라 모과 수박 참외 멜론 키위 오디 우유 크림 버터 치즈 요거 푸딩 카라멜 초코 코코아 바닐라 솜이 솜솜 뭉치 몽실 복실 포실 보송 폭신 털뭉 구름 하늘 바람 햇살 노을 달빛 별빛 새벽 아침 저녁 이슬 봄이 여름 가을 겨울 봄비 여우비 눈송 서리 안개 무지개 솔이 잎새 새싹 풀잎 꽃잎 꽃비 나리 진달 매화 수국 장미 목련 동백 봉선 민들레 제비꽃 라일락 개나리 금잔 해바라기 돌이 돌돌 조약 자갈 모래 진주 호박돌 수정 산호 옥이 복이 복덩 복순 복돌 행운 다복 기쁨 웃음 미소 행복 사랑 다정 온유 온기 포근 편안 든든 씩씩 용감 당당 반짝 초롱 또롱 반달 동글 둥글 동동 통통 쪼꼬 꼬미 꼬물 꼬리 쫑이 쫑긋 쌩쌩 팔랑 폴짝 총총 사뿐 살랑 누리 마루 가람 나루 다솜 라온 해솔 한울 아라 도담 수리 용호 당동 금당 오금 율곡 샘들 교전 밤바위 당정".split(" ");
const NAME_FAMILIES = {
  pet: "두부 만두 보리 찹쌀 호두 밤톨 쿠키 푸딩 치즈 솜이 뭉치 방울 리본 단추 구슬 모자 양말 공이 베개 복실",
  bird: "깃털 날개 콩알 깨알 참깨 들깨 보리 조약 하늘 바람 노을 별빛 이슬 햇살 풀잎 새싹 총총 팔랑 쫑긋 솔이",
  forest: "도토리 밤톨 솔방울 잎새 풀잎 새싹 나무 이끼 버섯 호두 땅콩 모래 돌이 이슬 서리 바람 구름 달빛 산호 나루",
  water: "물결 물방울 여울 나루 가람 갈대 자갈 모래 조약 이슬 연잎 수련 바람 하늘 구름 반달 샘물 방울 동동 둥실",
};
export const RESERVED_NAMES = "종달콩 담장별 봉돌 솔꼬리 밤소리 바람등 골목잎 역전점 장돌 쇠솔 높은점 철콩 꽃초롱 터널밤 솔마루 공방울 선읽이 공돌장 풀발 잔디달 들보리 돌물결 갈대눈 물수리 창고별 철길바람 길반장 밤도약 고갯빛 산묵 높은깃 느린산 잔물왕 골목대모 큰마루".split(" ");
export const NAME_POOLS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(SPECIES.map(species => {
  const family = species.id === "dog" || species.id === "cat" ? "pet" : species.id === "duck" ? "water"
    : ["pigeon", "magpie", "sparrow", "bulbul"].includes(species.id) ? "bird" : "forest";
  return [species.id, [...new Set([...SINGLE_NAMES, ...PREFIXES.flatMap(p => NAME_FAMILIES[family].split(" ").map(n => p + n))])].filter(name => !RESERVED_NAMES.includes(name))];
}));
const EPITHETS = "느긋한 재빠른 조용한 수다쟁이 반듯한 능청스런 씩씩한 신중한 호기심쟁이 잠꾸러기 눈치쟁이 낯가리는 다정한 고집쟁이 깔끔한 장난꾸러기".split(" ");
const OWNER_NAMES = "유진 민호 서연 정우 다은 하람 지우 수빈 현우 은서 지민 도윤 나연 태민 예린 준서 소윤 건우 시온 하윤 다솔 은우 세진 연우".split(" ");
export const OWNER_TITLES: Record<Habitat, readonly string[]> = {
  forest: ["숲 해설가", "산길 안내원", "나무 의사", "산림 연구원", "생태 사진가", "숲 관리인"],
  river: ["하천 관리인", "수질 연구원", "생태 안내원", "다리 점검원", "수변 정원사", "물길 조사원"],
  shops: ["빵집 주인", "꽃집 주인", "책방 주인", "문구점 주인", "과일장수", "카페 주인"],
  housing: ["동네 화가", "재택 번역가", "주민 대표", "아파트 관리인", "뜨개 선생님", "동네 작가"],
  park: ["공원 관리인", "정원사", "체육 강사", "산책 안내원", "운동 코치", "조경사"],
  school: ["초등 교사", "음악 교사", "미술 교사", "학교 사서", "급식 조리사", "통학 도우미"],
  road: ["택배 기사", "우편 배달원", "버스 기사", "도로 점검원", "자전거 수리공", "교통 안내원"],
  station: ["역무원", "열차 기관사", "승강장 안내원", "매표 담당자", "철도 정비사", "역 청소원"],
  industry: ["기계 기사", "창고 관리인", "안전 관리자", "설비 기술자", "물류 기사", "품질 검사원"],
  church: ["성가대원", "반주자", "성당 사무원", "마당 봉사자", "종지기", "청년 교리교사"],
};
export function intelligenceFor(temperament: Temperament, level: number): Intelligence {
  if (level >= 30 || temperament === "careful" && level >= 16) return "노련";
  return temperament === "kind" && level < 10 ? "순둥이" : "보통";
}
/** Seed is an unsigned integer; pool seeds 0..511 allocate eight residents per breed. */
export function makeIndividual(speciesKey: SpeciesKey, seed: number): Individual {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError("Invalid individual seed");
  if (!SPECIES.some(s => s.id === speciesKey && s.active)) throw new RangeError(`Inactive species: ${speciesKey}`);
  const roll = (label: string) => random(seedFor(`${speciesKey}:${label}`, seed)).value;
  const pick = <T,>(items: readonly T[], label: string): T => items[Math.floor(roll(label) * items.length)];
  const scheduled = BREEDS[Math.floor(seed / 8) % BREEDS.length];
  const breed = scheduled.species === speciesKey ? scheduled : pick(BREEDS.filter(b => b.species === speciesKey), "breed");
  const local = seed % 8;
  const owned = speciesKey === "dog" ? local !== 7 : speciesKey === "cat" && (breed.id !== "C01" || local < 2);
  const homes = PET_WORLD.filter(c => !SAFE_CELLS.includes(c.id) && breed.habitat.includes(habitatOf(c.id)));
  const homeCellId = pick(homes, "home").id, habitat = habitatOf(homeCellId);
  const owner = owned ? { name: pick(OWNER_NAMES, "owner"), title: pick(OWNER_TITLES[habitat], "title") } : null;
  const temperament = local < 6 ? breed.temperament : ({ kind: "steady", steady: "careful", careful: "lively", lively: "kind" } as const)[breed.temperament];
  const levelOffset = Math.floor(roll("level") * 7) - 3;
  const range = levelRange(homeCellId), baseLevel = Math.max(1, (range[0] + range[1]) / 2 + levelOffset);
  const weakness = pick(FORM_TAGS, "weakness");
  const namePool = NAME_POOLS[speciesKey];
  // A species-wide cyclic permutation keeps all 512 seeds distinct without mutable name tracking.
  const name = namePool[(seed + seedFor(speciesKey, 17)) % namePool.length];
  const art = pick([{ art: breed.art, look: `${breed.name} 기본 모습` }, ...breed.variants], "art");
  const conditionValue = (key: string) => 20 + Math.floor(roll(key) * 81);
  const condition = (key: string) => owned ? 60 + Math.floor(roll(key) * 41) : conditionValue(key);
  const statKeys = ["hp", "attack", "defense", "speed", "focus", "calm"] as const;
  const up = pick(statKeys, "stat-up"), down = pick(statKeys.filter(s => s !== up), "stat-down");
  return {
    id: `resident:${breed.id}:${seed.toString().padStart(3, "0")}`, seed, name, epithet: pick(EPITHETS, "epithet"), species: speciesKey, breedId: breed.id,
    temperament, homeCellId, habitat, owner, ownerLabel: owner ? `${owner.title} ${owner.name}` : "길에서 지냄",
    appearance: { ...art, scale: pick([.92, 1, 1.08], "scale"), facing: pick(["left", "right"] as const, "facing") },
    group: pick(GROUPS, "aura"), weakness, resistance: pick(FORM_TAGS.filter(t => t !== weakness), "resistance"),
    intelligence: intelligenceFor(temperament, baseLevel), condition: { fullness: condition("fullness"), mood: condition("mood"), clean: condition("clean") },
    levelOffset, baseLevel, statShift: { [up]: up === "hp" ? 8 : 2, [down]: down === "hp" ? -8 : -2 },
  };
}
export const INDIVIDUALS: readonly Individual[] = Array.from({ length: 512 }, (_, seed) => makeIndividual(BREEDS[Math.floor(seed / 8)].species, seed));
