import { redesignSupport } from "./support";
import { powerBudget } from "./move-budget";
import type { Group, JobId, Move, MoveTag, Species } from "./types";

export const ELEMENTS: readonly Group[] = ["rush", "trick", "track", "guard", "bond", "endure"];
export const MOVE_TAGS: readonly MoveTag[] = ["contact", "sound", "scent", "trick", "multi", "charge", "gaze"];
const ANIMAL_SPECIES = ["dog", "cat", "pigeon", "magpie", "sparrow", "bulbul", "duck", "deer", "boar", "raccoon", "squirrel", "chipmunk"] as const;
export const SPECIES: readonly Species[] = [...ANIMAL_SPECIES, "goblin", "orc", "slime"];

export function describeMove(move: Move): Move {
  const tag: MoveTag = move.contact ? "contact" : move.group === "track" ? "scent" : move.group === "bond" ? "sound" : "trick";
  return redesignSupport({ tags: move.mode === "multi" || move.mode === "charge" ? [tag, move.mode] : [tag],
    fx: move.mode === "charge" ? "charge" : move.mode === "multi" ? "flurry" : move.defense ?? tag,
    source: move.common && move.group === "neutral" ? "common" : "element", learn: { level: 1 }, ...move });
}
let nextId = 1;
function make(name: string, group: Move["group"], energy: number, source: NonNullable<Move["source"]>, level: number, extra: Partial<Move> = {}): Move {
  const kind = extra.kind ?? "attack";
  const move: Move = { id: `M${String(nextId++).padStart(3,"0")}`, name, kind, group,
    power: kind === "attack" ? powerBudget(energy, extra) : 0, accuracy: kind === "attack" ? 96 : 100,
    priority: kind === "defense" ? 1 : 0, mode: "normal", contact: group !== "bond" && group !== "track",
    source, common: source === "common", learn: { level }, ...extra, energy: extra.defense === "counter" ? 4 : energy };
  return describeMove(move);
}

const commonNames = ["발끝 톡톡", "살짝 밀치기", "자리 콕콕", "가벼운 기척", "시선 살피기", "작은 몸짓", "자리 감싸기", "한발 비우기", "장난감 겨루기", "옆자리 차지", "어깨 맞대기", "둥글게 돌기", "귀 기울이기", "몸 낮춰 받기", "호흡 가다듬기", "틈새 흔들기", "두발 번갈기", "모아서 뛰기", "힘껏 자리잡기", "큰 원 그리기"];
const commonCosts = [0,1,0,1,1,0,0,1,3,3,4,2,2,3,4,4,3,6,7,8];
const commonExtras: Record<number, Partial<Move>> = {
  3: { contact: false, tags: ["sound"] }, 4: { contact: false, tags: ["gaze"] },
  6: { kind: "defense", defense: "guard" }, 7: { kind: "defense", defense: "evade" },
  8: { contact: false, tags: ["trick"], fx: "toy-contest" },
  11: { kind: "defense", defense: "stance" }, 12: { kind: "support", buff: "focus" },
  13: { kind: "defense", defense: "counter" }, 14: { kind: "support", heal: .12 },
  15: { breaksDefense: true, tags: ["trick"] }, 16: { mode: "multi", hits: 2 },
  17: { mode: "charge", fx: "pounce" }, 18: { mode: "recoil", recoil: { energy: 1 }, contact: false, tags: ["sound"] },
};
const common = commonNames.map((name,i) => make(name,"neutral",commonCosts[i],"common",[1,1,1,1,1,1,1,5,1,1,10,10,5,10,18,26,10,30,45,60][i],commonExtras[i]));

const elementNames: Record<Group, string[]> = {
  rush: ["앞발 툭", "빠른 들이밀기", "공 향해 달리기", "어깨로 자리내기", "넓게 달려들기", "힘찬 도약", "웅크려 도약", "연달아 뛰기", "힘껏 들이받기", "발판 굳히기", "출발 준비", "달리며 흔들기"],
  trick: ["옆발 톡", "꼬리 흔들흔들", "엇갈린 발걸음", "빙글 자리잡기", "재빠른 옆돌기", "높은 곳 급습", "숨었다 튀기", "세갈래 발놀림", "몸 던져 돌기", "옆으로 흘리기", "눈치 살피기", "딴청 흔들기"],
  track: ["코끝 살피기", "발소리 좇기", "냄새길 따라가기", "발자국 겨루기", "멀리 흔적읽기", "끝까지 뒤따르기", "길목 기다리기", "연달아 길읽기", "몸 낮춰 추적", "기척 받아치기", "냄새 모으기", "발밑 흔들기"],
  guard: ["자리 톡", "문턱 건드리기", "마당 선긋기", "단단히 자리잡기", "어깨로 밀어내기", "큰자리 차지", "발판 모으기", "세번 밀어내기", "온몸 자리막기", "자리 틀어막기", "중심 다지기", "문턱 흔들기"],
  bond: ["작은 부름", "짧은 눈맞춤", "다정한 울림", "목소리 겨루기", "시선 모으기", "멀리 부르기", "호흡 모아부름", "세번 답하기", "큰소리 외치기", "호흡 지키기", "마음 모으기", "시선 흩뜨리기"],
  endure: ["한발 내딛기", "느긋한 밀기", "묵묵히 걷기", "긴보폭 다가가기", "버티며 밀기", "끝까지 전진", "힘 모아걷기", "이어진 세걸음", "마지막 큰걸음", "자세 오래잡기", "차분히 고르기", "중심 빼앗기"],
};
const elementCosts = [0,1,2,3,4,5,6,7,8,2,3,4];
const elementLevels = [1,1,1,5,10,18,30,45,60,5,10,26];
const elemental = ELEMENTS.flatMap(group => elementNames[group].map((name,i) => {
  const extra: Partial<Move> = i === 3 ? { status: group === "bond" ? "tense" : "slow", chance: 25 }
    : i === 6 ? { mode: "charge" } : i === 7 ? { mode: "multi", hits: 3 }
    : i === 8 ? { mode: "recoil", recoil: { stat: "defense", rate: .15 } }
    : i === 9 ? { kind: "defense", defense: group === "trick" ? "evade" : group === "track" ? "counter" : group === "endure" ? "stance" : "guard" }
    : i === 10 ? { kind: "support", buff: group === "rush" ? "attack" : group === "guard" ? "defense" : "focus" }
    : i === 11 ? { breaksDefense: true } : {};
  return make(name,group,elementCosts[i],"element",elementLevels[i],extra);
}));

const speciesNames: Record<typeof ANIMAL_SPECIES[number], [string,string,string]> = {
  dog: ["코로 장난감찾기", "앞발 장난치기", "달려 물고당기기"],
  cat: ["수염 간질이기", "높은곳 점프급습", "꼬리잡기 놀이"],
  pigeon: ["고개 까딱이기", "날아올라 급강하", "날개로 자리내기"],
  magpie: ["깍깍 시선끌기", "긴꼬리 방향전환", "반짝이 낚아채기"],
  sparrow: ["짹짹 부르기", "통통 곁뛰기", "작은날개 급강하"],
  bulbul: ["또르르 울기", "나뭇가지 훑기", "열매자리 급강하"],
  duck: ["물장구 치기", "물결 가르기", "큰날개 펼치기"],
  deer: ["귀 쫑긋 세우기", "뒷발 걷어차기", "풀숲 뛰어넘기"],
  boar: ["코로 흙고르기", "돌진 박치기", "땅 딛고 밀기"],
  raccoon: ["시치미 떼기", "앞발 슬쩍밀기", "꼬리숨겨 돌기"],
  squirrel: ["큰꼬리 시선끌기", "나무타고 돌아오기", "가지넘어 뛰기"],
  chipmunk: ["볼주머니 흔들기", "도토리 숨기기", "바위틈 뛰기"],
};
const speciesMoves = ANIMAL_SPECIES.flatMap((species, s) => speciesNames[species].map((name,i) => {
  const bird = ["pigeon","magpie","sparrow","bulbul","duck"].includes(species);
  const group: Group = species === "boar" || species === "dog" ? "rush" : bird ? "bond" : "trick";
  const energy = i === 0 ? 1 : i === 1 ? 3 : s % 2 ? 5 : 4;
  const extra: Partial<Move> = { learn: { level: [1,10,30][i], species }, contact: i > 0,
    tags: [i === 0 ? bird ? "sound" : species === "dog" || species === "boar" ? "scent" : "trick" : "contact"],
    fx: bird ? i === 0 ? "chirp" : "dive" : species === "cat" ? "pounce" : species === "deer" ? "kick" : species === "boar" ? "charge-bite" : "feint" };
  if (species === "raccoon" && i === 0) Object.assign(extra, { kind: "defense", defense: "evade" });
  if (species === "cat" && i === 1) Object.assign(extra, { mode: "charge", tags: ["contact","charge"] });
  return make(name,group,energy,"species",1,extra);
}));

export const SIGNATURE_BREEDS = [
  ["B001","반가운 공가져오기"], ["B002","작은발 종종뛰기"], ["B003","끈질긴 추적"], ["B004","털로 자리감싸기"],
  ["B005","산길 끝까지걷기"], ["B007","우아한 회전"], ["B009","풍성꼬리 뽐내기"], ["B015","낮은 태클"],
  ["B017","냄새길 파고들기"], ["B018","모른척 옆돌기"], ["B020","눈밭 질주"], ["B022","양몰이 원그리기"],
  ["B101","물가 공건지기"], ["B102","수염 당당세우기"], ["B103","낮은틈 기어가기"], ["B104","솜털 통통뛰기"],
  ["B105","느긋한 자리찜"], ["B106","작은몸 큰외침"], ["B107","갈기 펴고버티기"], ["B108","둥근어깨 밀기"],
  ["B109","나비귀 방향틀기"], ["B110","가느다란길 추적"], ["B111","통통 높이뛰기"], ["B112","바람옆 따라가기"],
  ["B113","긴다리 앞지르기"], ["B114","점박이 보폭"], ["B115","눈웃음 부르기"], ["B116","울타리 지키기"],
  ["B117","먼기척 따라가기"], ["B118","넓은가슴 버티기"], ["B119","물결 온몸밀기"], ["B120","흰털 벽세우기"],
  ["C01","골목턱 넘기"], ["C02","또렷한 대답"], ["C03","은빛 조용걸음"], ["C04","둥근발 자리찜"],
  ["C05","줄무늬 발장난"], ["C06","느긋한 기대기"], ["C07","긴털 시선가리기"], ["C08","큰발 장난감잡기"],
  ["C09","숲가지 건너뛰기"], ["C10","점박이 높이뛰기"], ["C11","긴몸 방향바꾸기"], ["C12","하얀꼬리 회전"],
] as const;
const signatures = SIGNATURE_BREEDS.map(([breedId,name],i) => make(name,ELEMENTS[i % 6],[1,2,3,4,6,2,3,7,4,0][i % 10],"breed",10,
  { learn: { level: 10, species: breedId.startsWith("B") ? "dog" : "cat", breedId }, fx: breedId === "B020" ? "snow-run" : breedId === "B015" ? "low-tackle" : "signature" }));

// The design's J01…J30 node order is preserved; only the new public IDs use M… .
const jobRows: [string, Group, number, Partial<Move>?][] = [
  ["먼저 자리잡기","rush",3,{priority:1}], ["넓게 딛기","rush",2,{kind:"support",buff:"attack"}],
  ["어깨로 흐름바꾸기","rush",4,{status:"open",chance:25}], ["돌아서 재출발","trick",3],
  ["선봉의 보폭","rush",5,{status:"slow",chance:25}], ["마지막 자리","endure",4,{status:"stagger",chance:25}],
  ["단단한 발판","guard",3,{kind:"defense",defense:"guard",buff:"defense"}], ["낮은 중심","endure",2,{kind:"support",buff:"calm"}],
  ["한걸음 밀어내기","guard",3], ["틈없는 자세","guard",3,{kind:"defense",defense:"stance",buff:"focus"}],
  ["마당의 중심","guard",5,{status:"stagger",chance:30}], ["지키며 고르기","bond",4,{kind:"support",heal:.10}],
  ["옆발 바꾸기","trick",2], ["꼬리로 균형","trick",2,{kind:"support",buff:"speed"}],
  ["눈앞에서 비키기","trick",4,{status:"blur",chance:25}], ["흔적 반바퀴","track",3],
  ["빈자리 세걸음","trick",5,{priority:1}], ["흐름 끊기","bond",4,{status:"tense",chance:30}],
  ["발끝 읽기","track",2], ["길목 살피기","track",2,{kind:"support",buff:"focus"}],
  ["돌아갈길 찾기","track",4,{status:"slow",chance:25}], ["정면대신 옆길","trick",3],
  ["한수 먼저읽기","track",5,{status:"open",chance:25}], ["끝까지 같은거리","endure",4,{status:"winded",chance:30}],
  ["시선 맞추기","bond",2], ["호흡 맞추기","bond",2,{kind:"support",buff:"calm"}],
  ["반가운 한걸음","bond",3], ["마음 가라앉히기","bond",4,{kind:"support",heal:.10}],
  ["모두의 시선","bond",5,{status:"tense",chance:30}], ["함께 지키는자리","guard",3,{kind:"defense",defense:"counter",buff:"focus"}],
];
const jobStart = nextId;
const jobMoves = jobRows.map(([name,group,cost,extra],i) => make(name,group,cost,"job",1, { ...extra,
  learn: { level: [10,15,30,40,60,80][i % 6], job: (["rush","guard","trick","track","bond"] as JobId[])[Math.floor(i / 6)],
    tier: (Math.floor(i % 6 / 2) + 1) as 1 | 2 | 3,
    ...(i % 6 >= 2 ? { prerequisite: `M${String(jobStart + i - 2).padStart(3,"0")}` } : {}) } }));
const supportNames = ["주머니 숨모으기", "발판 다지기", "딴청 피우기", "털 털고쉬기", "도약 꿈꾸기", "버릇 살피기", "응원 모으기"];
const supportRoles = ["energy", "buff", "disrupt", "recover", "prepare", "read", "momentum"] as const;
const supportLevels = [1, 5, 10, 15, 20, 25, 30];
const supportCosts = [0, 2, 2, 2, 2, 1, 5];
const supportStats = ["attack", "speed", "focus", "defense", "calm", "attack"] as const;
const supportMoves = supportRoles.flatMap((role, i) => [
  make(supportNames[i], "neutral", supportCosts[i], "common", supportLevels[i], { kind: "support", support: { role }, fx: role, tags: [role === "read" ? "gaze" : "trick"] }),
  ...ELEMENTS.map((group, j) => make(`${["씽씽", "살랑", "킁킁", "단단", "도란", "느긋"][j]}${["숨모으기", "발다지기", "딴청놀이", "털고쉬기", "뜀준비", "눈치놀이", "응원놀이"][i]}`, group, supportCosts[i], "element", supportLevels[i] + 5,
    { kind: "support", support: { role }, ...(role === "buff" ? { buff: supportStats[j] } : {}), fx: role, tags: [group === "bond" ? "sound" : group === "track" ? "scent" : "trick"] })),
]);
const speciesSupport = ANIMAL_SPECIES.map((species, i) => {
  const role = supportRoles[i % 7];
  return make(`${["꼬리", "수염", "깃털", "깍깍", "짹짹", "열매", "물결", "쫑긋", "흙발", "능청", "솔방울", "도토리"][i]}${["숨모으기", "발다지기", "딴청놀이", "털고쉬기", "뜀준비", "눈치놀이", "응원놀이"][i % 7]}`, "neutral", supportCosts[i % 7], "species", 10 + i * 3,
    { kind: "support", support: { role }, learn: { species, level: 10 + i * 3 }, fx: role, tags: ["trick"] });
});
// Append only: persisted M001–M263 IDs must never shift when a species joins.
const guestMoves = ([
  ["goblin", "trick", ["주머니 뒤지기", "동전 딸랑이기", "주머니 공 던지기"], [1,3,5]],
  ["orc", "guard", ["방패 두드리기", "어깨로 공 굴리기", "쿠션 크게 밀기"], [2,3,5]],
  ["slime", "endure", ["몰랑 튕기기", "젤리 통통뛰기", "말랑 파도타기"], [1,3,5]],
] as const).flatMap(([species, group, names, costs]) => names.map((name, i) => make(name, group, costs[i], "species", [1,10,30][i], {
  learn: { species, level: [1,10,30][i] }, contact: i === 1,
  tags: [i === 1 ? "contact" : species === "orc" ? "sound" : "trick"],
  fx: species === "goblin" ? "feint" : species === "orc" ? "toy-contest" : "pounce",
})));
export const EXPANDED_MOVES: readonly Move[] = [...common, ...elemental, ...speciesMoves, ...signatures, ...jobMoves, ...supportMoves, ...speciesSupport, ...guestMoves];
