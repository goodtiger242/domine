import { BREEDS as ENGINE_BREEDS } from "../battle/data";
import type { Breed, Group, Stats } from "../battle/types";
import type { RivalSpecies } from "../pet-rival-lines";
import variants from "../../../public/pet/breed/variants.json";
import variantsD1 from "../../../public/pet/breed/variants_d1.json";
import variantsD2 from "../../../public/pet/breed/variants_d2.json";
import variantsC from "../../../public/pet/breed/variants_c.json";

export type SpeciesKey = RivalSpecies | "chipmunk" | "bulbul";
export type Habitat = "forest" | "river" | "shops" | "housing" | "park" | "school" | "road" | "station" | "industry" | "church";
export interface SpeciesDefinition { id: SpeciesKey; name: string; active: boolean; art: string | null; category: "animal" | "guest" }
export const SPECIES: readonly SpeciesDefinition[] = [
  { id: "dog", name: "개", active: true, art: "/pet/adult.webp", category: "animal" },
  { id: "cat", name: "고양이", active: true, art: "/pet/breed/C01.webp", category: "animal" },
  { id: "pigeon", name: "비둘기", active: true, art: "/pet/breed/V01.webp", category: "animal" },
  { id: "waterdeer", name: "고라니", active: true, art: "/pet/breed/V03.webp", category: "animal" },
  { id: "boar", name: "멧돼지", active: true, art: "/pet/breed/V05.webp", category: "animal" },
  { id: "raccoon", name: "너구리", active: true, art: "/pet/breed/V07.webp", category: "animal" },
  { id: "squirrel", name: "청설모", active: true, art: "/pet/breed/V09.webp", category: "animal" },
  { id: "chipmunk", name: "다람쥐", active: true, art: "/pet/breed/V11.webp", category: "animal" },
  { id: "magpie", name: "까치", active: true, art: "/pet/breed/V13.webp", category: "animal" },
  { id: "sparrow", name: "참새", active: true, art: "/pet/breed/V15.webp", category: "animal" },
  { id: "bulbul", name: "직박구리", active: true, art: "/pet/breed/V17.webp", category: "animal" },
  { id: "duck", name: "오리", active: true, art: "/pet/breed/V19.webp", category: "animal" },
  { id: "goblin", name: "고블린", active: false, art: null, category: "guest" },
  { id: "orc", name: "오크", active: false, art: null, category: "guest" },
  { id: "slime", name: "슬라임", active: false, art: null, category: "guest" },
 ];
export const GROUPS: readonly Group[] = ["rush", "trick", "track", "guard", "bond", "endure"];
export const GROUP_LABEL: Record<Group, string> = { rush: "돌진", trick: "기교", track: "추적", guard: "수호", bond: "교감", endure: "지구" };
export interface BreedDefinition extends Omit<Breed, "group"> {
  species: SpeciesKey; habitat: readonly Habitat[]; art: string; active: true;
  variantKind: "breed" | "regional_type" | "appearance_form";
  variants: readonly { art: string; look: string }[];
}
type BreedRow = [string, string, SpeciesKey, Breed["size"], Breed["temperament"], number[], string, Breed["trait"], Habitat[]];
const rows: BreedRow[] = [
  ["B001", "골든 리트리버", "dog", "large", "kind", [121, 16, 21, 18, 18, 17], "G5", "restDamage", ["housing", "school", "church", "park", "river"]],
  ["B002", "말티즈", "dog", "small", "lively", [140, 19, 24, 23, 20, 19], "G2", "earlySpeed", ["housing", "school", "church", "shops", "station", "road", "industry"]],
  ["B003", "진돗개", "dog", "medium", "careful", [140, 18, 17, 20, 23, 17], "G4", "firstTrack", ["housing", "school", "church", "forest"]],
  ["B004", "삽살개", "dog", "medium", "kind", [135, 17, 21, 13, 26, 20], "G3", "firstShield", ["housing", "school", "church", "park"]],
  ["B005", "풍산개", "dog", "large", "steady", [166, 25, 21, 16, 16, 16], "G6", "thirdEnergy", ["forest", "park"]],
  ["B007", "푸들", "dog", "medium", "careful", [142, 14, 24, 23, 32, 16], "G2", "longBuff", ["housing", "school", "church", "shops", "station", "road", "industry", "park"]],
  ["B009", "포메라니안", "dog", "small", "lively", [128, 14, 22, 24, 24, 18], "G5", "firstBond", ["housing", "school", "church", "shops", "station", "road", "industry"]],
  ["B015", "웰시 코기 펨브로크", "dog", "medium", "lively", [144, 22, 19, 18, 15, 15], "G1", "firstRush", ["housing", "school", "church", "park"]],
  ["B017", "비글", "dog", "medium", "lively", [140, 17, 16, 22, 25, 20], "G4", "trackDamage", ["park", "forest"]],
  ["B018", "시바 이누", "dog", "medium", "careful", [136, 23, 24, 23, 18, 15], "G2", "statusImmune", ["housing", "school", "church", "shops", "station", "road", "industry", "forest"]],
  ["B020", "시베리안 허스키", "dog", "large", "lively", [180, 28, 18, 23, 18, 12], "G6", "restDamage", ["park", "forest"]],
  ["B022", "보더 콜리", "dog", "medium", "careful", [136, 15, 15, 25, 28, 16], "G4", "longBuff", ["park", "forest"]],
  ["B101", "래브라도 리트리버", "dog", "large", "kind", [150, 19, 21, 18, 22, 20], "G5", "firstBond", ["park", "river"]],
  ["B102", "미니어처 슈나우저", "dog", "medium", "careful", [140, 19, 24, 18, 22, 21], "G3", "firstShield", ["housing", "school", "church", "shops", "station", "road", "industry"]],
  ["B103", "닥스훈트", "dog", "small", "lively", [138, 20, 20, 18, 25, 17], "G4", "trackDamage", ["housing", "school", "church", "park"]],
  ["B104", "비숑 프리제", "dog", "small", "kind", [132, 16, 22, 22, 25, 22], "G5", "firstBond", ["housing", "school", "church", "shops", "station", "road", "industry"]],
  ["B105", "시추", "dog", "small", "steady", [150, 17, 24, 14, 21, 25], "G6", "thirdEnergy", ["housing", "school", "church", "shops", "station", "road", "industry"]],
  ["B106", "치와와", "dog", "small", "lively", [126, 20, 18, 27, 23, 17], "G2", "earlySpeed", ["housing", "school", "church", "shops", "station", "road", "industry"]],
  ["B107", "페키니즈", "dog", "small", "steady", [148, 18, 26, 12, 20, 25], "G3", "firstShield", ["housing", "school", "church", "shops", "station", "road", "industry"]],
  ["B108", "퍼그", "dog", "small", "kind", [154, 18, 25, 13, 21, 23], "G6", "restDamage", ["housing", "school", "church", "park"]],
  ["B109", "파피용", "dog", "small", "careful", [128, 16, 18, 28, 28, 18], "G2", "longBuff", ["housing", "school", "church", "park"]],
  ["B110", "요크셔 테리어", "dog", "small", "lively", [130, 19, 19, 25, 24, 18], "G4", "firstTrack", ["housing", "school", "church", "shops", "station", "road", "industry"]],
  ["B111", "잭 러셀 테리어", "dog", "small", "lively", [138, 24, 18, 26, 18, 14], "G1", "firstRush", ["park", "forest"]],
  ["B112", "휘핏", "dog", "medium", "steady", [132, 20, 17, 30, 21, 18], "G2", "earlySpeed", ["park"]],
  ["B113", "그레이하운드", "dog", "large", "steady", [144, 24, 18, 29, 18, 17], "G1", "firstRush", ["park"]],
  ["B114", "달마시안", "dog", "large", "lively", [158, 22, 20, 24, 18, 17], "G6", "thirdEnergy", ["park", "shops", "station", "road", "industry"]],
  ["B115", "사모예드", "dog", "large", "kind", [160, 18, 24, 18, 22, 24], "G5", "firstBond", ["housing", "school", "church", "park"]],
  ["B116", "저먼 셰퍼드", "dog", "large", "careful", [158, 23, 25, 20, 22, 18], "G3", "firstShield", ["shops", "station", "road", "industry", "park", "forest"]],
  ["B117", "도베르만", "dog", "large", "careful", [148, 24, 20, 25, 23, 16], "G4", "firstTrack", ["shops", "station", "road", "industry", "park"]],
  ["B118", "로트와일러", "dog", "large", "steady", [172, 25, 28, 13, 17, 22], "G3", "statusImmune", ["housing", "school", "church", "shops", "station", "road", "industry"]],
  ["B119", "뉴펀들랜드", "dog", "large", "kind", [180, 20, 27, 12, 19, 26], "G6", "restDamage", ["park", "river"]],
  ["B120", "그레이트 피레니즈", "dog", "large", "steady", [176, 22, 29, 12, 18, 25], "G3", "firstShield", ["park", "forest"]],
  ["C01", "코리안 쇼트헤어", "cat", "small", "careful", [136, 20, 20, 27, 24, 18], "G2", "statusImmune", ["housing", "school", "church", "shops", "station", "road", "industry", "park"]],
  ["C02", "샴", "cat", "small", "lively", [128, 16, 18, 27, 28, 20], "G5", "firstBond", ["housing", "school", "church"]],
  ["C03", "러시안 블루", "cat", "small", "careful", [130, 17, 20, 25, 27, 23], "G4", "firstTrack", ["housing", "school", "church"]],
  ["C04", "브리티시 쇼트헤어", "cat", "medium", "steady", [154, 20, 27, 15, 22, 25], "G3", "firstShield", ["housing", "school", "church"]],
  ["C05", "아메리칸 쇼트헤어", "cat", "medium", "steady", [150, 21, 23, 20, 22, 22], "G6", "thirdEnergy", ["housing", "school", "church"]],
  ["C06", "랙돌", "cat", "medium", "kind", [160, 16, 23, 14, 25, 28], "G5", "firstBond", ["housing", "school", "church"]],
  ["C07", "페르시안", "cat", "medium", "steady", [150, 17, 25, 13, 24, 29], "G3", "longBuff", ["housing", "school", "church"]],
  ["C08", "메인쿤", "cat", "medium", "kind", [168, 23, 24, 18, 22, 22], "G6", "restDamage", ["housing", "school", "church", "park"]],
  ["C09", "노르웨이 숲고양이", "cat", "medium", "careful", [154, 21, 22, 23, 25, 19], "G4", "trackDamage", ["housing", "school", "church", "park"]],
  ["C10", "벵갈", "cat", "medium", "lively", [140, 25, 19, 29, 22, 14], "G1", "firstRush", ["housing", "school", "church", "park"]],
  ["C11", "아비시니안", "cat", "small", "lively", [132, 19, 18, 29, 27, 17], "G2", "earlySpeed", ["housing", "school", "church", "park"]],
  ["C12", "터키시 앙고라", "cat", "small", "careful", [136, 17, 20, 26, 27, 22], "G5", "longBuff", ["housing", "school", "church"]],
  ["V01", "집비둘기 회색 띠형", "pigeon", "small", "lively", [130, 16, 18, 28, 24, 19], "G2", "earlySpeed", ["shops", "station", "road", "industry", "park"]],
  ["V02", "집비둘기 흰점 얼룩형", "pigeon", "small", "kind", [134, 16, 20, 24, 25, 22], "G5", "firstBond", ["shops", "station", "road", "industry", "park"]],
  ["V03", "고라니 갈색 숲형", "waterdeer", "large", "careful", [160, 22, 18, 29, 23, 16], "G4", "firstTrack", ["forest", "park"]],
  ["V04", "고라니 짙은 겨울털형", "waterdeer", "large", "steady", [172, 22, 23, 24, 20, 20], "G6", "thirdEnergy", ["forest", "park"]],
  ["V05", "멧돼지 짙은 갈색형", "boar", "large", "lively", [180, 28, 25, 16, 16, 18], "G1", "firstRush", ["forest"]],
  ["V06", "멧돼지 회갈색형", "boar", "large", "steady", [184, 24, 29, 13, 18, 22], "G3", "firstShield", ["forest"]],
  ["V07", "너구리 숲 가장자리형", "raccoon", "medium", "careful", [148, 19, 23, 21, 24, 22], "G2", "statusImmune", ["forest", "park"]],
  ["V08", "너구리 물가 생활형", "raccoon", "medium", "steady", [152, 18, 22, 19, 27, 23], "G4", "trackDamage", ["river", "forest"]],
  ["V09", "청설모 회갈색형", "squirrel", "small", "lively", [128, 17, 18, 29, 27, 17], "G4", "firstTrack", ["forest", "park"]],
  ["V10", "청설모 짙은 꼬리형", "squirrel", "small", "careful", [132, 18, 19, 28, 25, 19], "G2", "earlySpeed", ["forest", "park"]],
  ["V11", "다람쥐 선명한 줄무늬형", "chipmunk", "small", "lively", [124, 16, 17, 30, 28, 18], "G2", "earlySpeed", ["forest"]],
  ["V12", "다람쥐 옅은 줄무늬형", "chipmunk", "small", "careful", [132, 16, 20, 27, 25, 22], "G6", "thirdEnergy", ["forest"]],
  ["V13", "까치 긴꼬리형", "magpie", "small", "careful", [138, 19, 19, 26, 28, 18], "G4", "trackDamage", ["shops", "station", "road", "industry", "park", "forest"]],
  ["V14", "까치 짙은 광택형", "magpie", "small", "lively", [144, 20, 23, 23, 24, 19], "G3", "firstShield", ["shops", "station", "road", "industry", "park", "forest"]],
  ["V15", "참새 밝은 갈색형", "sparrow", "small", "lively", [122, 14, 17, 29, 27, 20], "G5", "firstBond", ["housing", "school", "church", "shops", "station", "road", "industry", "park"]],
  ["V16", "참새 짙은 갈색형", "sparrow", "small", "careful", [126, 15, 18, 28, 26, 21], "G2", "earlySpeed", ["housing", "school", "church", "shops", "station", "road", "industry", "park"]],
  ["V17", "직박구리 회갈색형", "bulbul", "small", "careful", [132, 17, 19, 27, 28, 18], "G4", "firstTrack", ["forest", "park"]],
  ["V18", "직박구리 밝은 가슴형", "bulbul", "small", "lively", [136, 16, 20, 25, 27, 21], "G5", "longBuff", ["forest", "park"]],
  ["V19", "흰뺨검둥오리 짙은 날개형", "duck", "medium", "steady", [156, 18, 24, 17, 22, 25], "G6", "restDamage", ["river"]],
  ["V20", "흰뺨검둥오리 밝은 옆구리형", "duck", "medium", "careful", [160, 18, 26, 16, 22, 24], "G3", "firstShield", ["river"]],
];
const allVariants = [...variants, ...variantsD1, ...variantsD2, ...variantsC];
const statKeys = ["hp", "attack", "defense", "speed", "focus", "calm"] as const;
// Existing twelve breeds stay intact; new rows use their size's mean total budget.
export const SIZE_BUDGET = Object.fromEntries(["small", "medium", "large"].map(size => {
  const peers = ENGINE_BREEDS.filter(b => b.size === size);
  return [size, Math.round(peers.reduce((sum, b) => sum + Object.values(b.base).reduce((a, v) => a + v, 0), 0) / peers.length)];
})) as Record<Breed["size"], number>;
export const BREEDS: readonly BreedDefinition[] = rows.map(([id, name, species, size, temperament, values, growth, trait, habitat]) => {
  const existing = ENGINE_BREEDS.find(b => b.id === id);
  const total = values.reduce((sum, value) => sum + value, 0);
  const base = existing?.base ?? Object.fromEntries(statKeys.map((key, i) => [key, Math.round(values[i] * SIZE_BUDGET[size] / total)])) as Stats;
  return { id, name, species, size, temperament, base, growth: existing?.growth ?? growth, trait, habitat,
    learn: existing?.learn ?? [{ level: 1, move: "T01" }, { level: 1, move: "T43" }],
    active: true, variantKind: species === "dog" || species === "cat" && id !== "C01" ? "breed" : id === "C01" ? "regional_type" : "appearance_form",
    art: id === "B001" ? "/pet/adult.webp" : id === "B002" ? "/pet/mine/stand.webp" : `/pet/breed/${id}.webp`,
    variants: allVariants.filter(v => v.breed === id).map(v => ({ art: `/pet/breed/${v.file}.webp`, look: v.look })),
  };
});
export const BREED_BY_ID: Readonly<Record<string, BreedDefinition>> = Object.fromEntries(BREEDS.map(b => [b.id, b]));
/** The engine receives the individual's aura, never a breed-fixed matchup. */
export function asBattleBreed(breedId: string, group: Group): Breed {
  const breed = BREED_BY_ID[breedId];
  if (!Object.hasOwn(BREED_BY_ID, breedId) || !GROUPS.includes(group)) throw new RangeError("Unknown breed or aura");
  return { ...breed, group };
}
