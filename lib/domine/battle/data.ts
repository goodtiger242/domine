import { powerBudget } from "./move-budget";
import { EXPANDED_MOVES, describeMove } from "./moves";
import type { Breed, Group, Item, Move, Stats } from "./types";

const stats = (hp: number, attack: number, defense: number, speed: number, focus: number, calm: number): Stats => ({ hp, attack, defense, speed, focus, calm });
export const GROWTH: Readonly<Record<string, Stats>> = {
  G1: stats(4, 1, .9, .9, .9, .8), G2: stats(3.2, .8, .7, 1.3, 1.1, .8),
  G3: stats(4.8, 1.1, 1.3, .5, .6, .8), G4: stats(3.6, .8, .8, 1, 1.4, .6),
  G5: stats(3.2, .6, .7, 1, 1.2, 1.2), G6: stats(4.8, 1.1, 1.1, .7, .6, .8),
};
const learn = (...ids: number[]) => ids.map((id, i) => ({ level: [1, 1, 5, 10, 18, 26][i], move: `T${String(id).padStart(2, "0")}` }));
export const BREEDS: readonly Breed[] = [
  { id: "B001", name: "골든 리트리버", group: "bond", temperament: "kind", size: "large", base: stats(160,16,21,18,18,17), growth: "G1", trait: "restDamage", learn: learn(1,43,50,26,60,21) },
  { id: "B002", name: "말티즈", group: "trick", temperament: "lively", size: "small", base: stats(160,19,24,23,20,19), growth: "G2", trait: "earlySpeed", learn: learn(13,19,37,50,21,18) },
  { id: "B003", name: "진돗개", group: "track", temperament: "careful", size: "medium", base: stats(200,18,17,20,23,17), growth: "G4", trait: "firstTrack", learn: learn(25,31,34,3,28,26) },
  { id: "B004", name: "삽살개", group: "guard", temperament: "kind", size: "medium", base: stats(115,17,21,13,26,20), growth: "G6", trait: "firstShield", learn: learn(37,43,60,26,21,51) },
  { id: "B005", name: "풍산개", group: "endure", temperament: "steady", size: "large", base: stats(115,25,21,16,16,16), growth: "G6", trait: "thirdEnergy", learn: learn(61,67,60,28,63,65) },
  { id: "B007", name: "푸들", group: "trick", temperament: "careful", size: "medium", base: stats(115,14,24,23,32,16), growth: "G2", trait: "longBuff", learn: learn(14,19,34,50,21,18) },
  { id: "B009", name: "포메라니안", group: "bond", temperament: "lively", size: "small", base: stats(115,14,22,24,24,18), growth: "G2", trait: "firstBond", learn: learn(50,43,58,1,21,49) },
  { id: "B015", name: "웰시 코기 펨브로크", group: "rush", temperament: "lively", size: "medium", base: stats(200,22,19,18,15,15), growth: "G1", trait: "firstRush", learn: learn(3,43,14,16,21,18) },
  { id: "B017", name: "비글", group: "track", temperament: "lively", size: "medium", base: stats(115,17,16,22,25,20), growth: "G4", trait: "trackDamage", learn: learn(25,31,34,1,28,26) },
  { id: "B018", name: "시바 이누", group: "trick", temperament: "careful", size: "medium", base: stats(115,23,24,23,18,15), growth: "G2", trait: "statusImmune", learn: learn(16,19,34,37,21,18) },
  { id: "B020", name: "시베리안 허스키", group: "endure", temperament: "lively", size: "large", base: stats(200,28,18,23,18,12), growth: "G6", trait: "restDamage", learn: learn(61,67,60,16,63,65) },
  { id: "B022", name: "보더 콜리", group: "track", temperament: "careful", size: "medium", base: stats(200,15,15,25,28,16), growth: "G4", trait: "longBuff", learn: learn(28,31,34,14,26,65) },
];

export { POWER_DEDUCTIONS, powerBudget } from "./move-budget";
const attack = (id: string, name: string, group: Move["group"], accuracy: number, energy: number, extra: Partial<Move> = {}): Move => ({ id, name, kind: "attack", mode: "normal", group, power: powerBudget(energy,extra), accuracy, energy, priority: 0, contact: group !== "bond" && group !== "track", ...extra });
const support = (id: string, name: string, group: Group, kind: "defense" | "support", energy: number, extra: Partial<Move> = {}): Move => ({ id, name, group, kind, mode: "normal", power: 0, accuracy: 100, energy, priority: kind === "defense" ? 1 : 0, ...extra });
const LEGACY_MOVES: Move[] = [
  attack("T01","앞발 밀기","rush",96,2),
  attack("T03","어깨 자리잡기","rush",94,3),
  attack("T13","옆걸음 톡","trick",97,2),
  attack("T14","꼬리쪽 돌아가기","trick",95,2,{ priority: 1 }),
  attack("T16","발끝 방향바꿈","trick",94,3,{ status: "open", chance: 25 }),
  attack("T18","반바퀴 자리뺏기","trick",92,5,{ buff: "speed" }),
  support("T19","옆자리 비우기","trick","defense",1,{ common: true, defense: "evade" }),
  support("T21","꼬리 균형잡기","trick","defense",3,{ common: true, defense: "counter", buff: "focus" }),
  attack("T25","냄새선 따라가기","track",97,2),
  attack("T26","발자국 맞추기","track",96,3),
  attack("T28","돌아온 흔적","track",94,3,{ status: "slow", chance: 25 }),
  support("T31","귀 세워 살피기","track","defense",3,{ common: true, defense: "counter" }),
  support("T34","코끝 집중","track","support",2,{ buff: "focus" }),
  attack("T37","문턱 밀어내기","guard",96,2),
  support("T43","마당 지키기","guard","defense",0,{ common: true, defense: "guard" }),
  attack("T49","눈맞춤 흔들기","bond",97,2),
  attack("T50","반가운 소리","bond",96,3),
  attack("T51","꼬리로 시선끌기","bond",95,3,{ status: "tense", chance: 25 }),
  support("T58","다정한 호흡","bond","support",2,{ buff: "focus" }),
  support("T60","곁에서 쉬기","bond","support",4,{ heal: .12 }),
  attack("T61","일정한 발걸음","endure",97,2),
  attack("T63","묵직한 보폭","endure",94,3,{ status: "winded", chance: 25 }),
  attack("T65","끝까지 따라붙기","endure",94,4,{ status: "slow", chance: 25 }),
  support("T67","보폭 줄여 버티기","endure","defense",2,{ common: true, defense: "stance" }),
  attack("C01","웅크려 큰걸음","rush",94,6,{ common: true, mode: "charge" }),
  attack("C02","긴 호흡 눈맞춤","bond",96,8,{ common: true, mode: "charge" }),
  attack("C03","두 번 발맞춤","trick",92,3,{ common: true, mode: "multi", hits: 2 }),
  attack("C04","세 번 원그리기","track",90,4,{ common: true, mode: "multi", hits: 3 }),
  attack("C05","힘껏 한걸음","endure",94,3,{ common: true, mode: "recoil", recoil: { energy: 3 } }),
  attack("C06","빠른 몸돌리기","rush",92,5,{ common: true, mode: "recoil", recoil: { stat: "defense", rate: .15 } }),
  attack("K01","중심 흔들기","neutral",97,4,{ common: true, breaksDefense: true }),
  attack("K02","어깨 틈새치기","rush",97,4,{ common: true, breaksDefense: true }),
  attack("K03","시선 뒤집기","trick",97,4,{ common: true, breaksDefense: true, contact: false }),
];
export const MOVES: readonly Move[] = [...LEGACY_MOVES.map(describeMove), ...EXPANDED_MOVES];
export const FINISHERS: readonly Move[] = (["rush","trick","track","guard","bond","endure"] as Group[]).map((group,i) => ({
  ...attack(`F0${i+1}`,["돌진의 한걸음","기교의 원무","추적의 일격","수호의 반향","교감의 울림","지구의 전진"][i],group,98,0),
  power: 34, finisher: true,
}));
export const PUSH: Move = { id: "push", name: "가볍게 밀기", group: "neutral", kind: "attack", mode: "normal", power: 10, accuracy: 95, energy: 0, priority: 0, contact: true };
export const ITEMS: readonly Item[] = [
  { id: "I01", name: "가벼운 산책줄", slot: "collar", rates: { speed: .04 } },
  { id: "I02", name: "집중 매듭줄", slot: "collar", rates: { focus: .04 } },
  { id: "I04", name: "힘찬 짜임목줄", slot: "collar", rates: { attack: .04 } },
  { id: "I07", name: "얇은 산책 하네스", slot: "harness", rates: { defense: .04 } },
  { id: "I08", name: "폭신한 가슴받이", slot: "harness", rates: { hp: .06 } },
  { id: "I13", name: "나무 발자국 장식", slot: "charm", rates: { attack: .03 } },
  { id: "I19", name: "작은 물그릇", slot: "bag", energy: 3 },
  { id: "I21", name: "쉬는 돗자리", slot: "bag", heal: .10 },
];
export const CONSUMABLES: readonly Item[] = [
  { id: "P01", name: "작은 물약", slot: "bag", category: "heal", heal: .10, price: 15 },
  { id: "P02", name: "보통 물약", slot: "bag", category: "heal", heal: .15, price: 35 },
  { id: "P03", name: "큰 물약", slot: "bag", category: "heal", heal: .30, price: 70 },
  { id: "P04", name: "시원한 물", slot: "bag", category: "energy", energy: 3, price: 12 },
  { id: "P05", name: "기운 음료", slot: "bag", category: "energy", energy: 6, price: 30 },
  { id: "P06", name: "힘나는 간식", slot: "bag", category: "buff", buff: "attack", price: 25 },
  { id: "P07", name: "든든한 간식", slot: "bag", category: "buff", buff: "defense", price: 25 },
  { id: "P08", name: "날쌘 간식", slot: "bag", category: "buff", buff: "speed", price: 25 },
  { id: "P09", name: "또렷한 간식", slot: "bag", category: "buff", buff: "focus", price: 25 },
  { id: "P10", name: "정신 번쩍 껌", slot: "bag", category: "cleanse", price: 20 },
  { id: "P11", name: "푹신한 방석", slot: "bag", category: "protect", price: 30 },
  { id: "P12", name: "집중 사탕", slot: "bag", category: "critical", price: 40 },
  { id: "P13", name: "장난감 공", slot: "bag", category: "cancel", price: 35 },
  { id: "P14", name: "끈기 리본", slot: "bag", category: "survive", price: 60 },
];
export const BREED_BY_ID: Readonly<Record<string, Breed>> = Object.fromEntries(BREEDS.map(b => [b.id, b]));
export const MOVE_BY_ID: Readonly<Record<string, Move>> = Object.fromEntries([...MOVES,...FINISHERS].map(m => [m.id, m]));
export const ITEM_BY_ID: Readonly<Record<string, Item>> = Object.fromEntries([...ITEMS,...CONSUMABLES].map(i => [i.id, i]));
