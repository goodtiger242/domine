import { PET_WORLD } from "../pet-world";
import type { Habitat as EngineHabitat } from "../battle/types";
import type { Habitat, SpeciesKey } from "./species";

export const HABITAT_LABEL: Record<Habitat, string> = { forest: "숲", river: "하천", shops: "상가", housing: "주택", park: "공원", school: "학교", road: "도로", station: "역", industry: "공업", church: "성당·교회" };
export const ENGINE_HABITAT: Record<Habitat, EngineHabitat> = { forest: "F", river: "W", shops: "U", housing: "H", park: "G", school: "H", road: "U", station: "U", industry: "U", church: "H" };
const regionRows = [
  ["성당·당동 생활권", "EF", 1, "E1"], ["금당산·용호 서쪽", "CD", 1, "C1"],
  ["군포역·시장 골목", "GH", 1, "G3"], ["당정 공업지대", "IJ", 1, "J3"],
  ["율곡·오금 산책권", "AB", 1, "B3"], ["용호 학교·체육권", "CD", 6, "C10"],
  ["주공·잔디 둘레권", "EF", 6, "E8"], ["당정역·물가권", "GH", 6, "H8"],
  ["한세·철길 동쪽", "IJ", 6, "I8"], ["수리산·삼성마을", "AB", 6, "A7"],
] as const;
export const REGIONS = regionRows.map(([name, columns, firstRow, anchorCellId], i) => ({
  id: `R${String(i + 1).padStart(2, "0")}`, name, anchorCellId,
  cells: [...columns].flatMap(col => Array.from({ length: 5 }, (_, row) => `${col}${firstRow + row}`)),
  levelRange: [1 + i * 6, 7 + i * 6] as readonly [number, number], bossLevel: 10 + i * 6,
}));
export function regionOf(cellId: string) {
  const region = REGIONS.find(r => r.cells.includes(cellId));
  if (!region) throw new RangeError(`Unknown cell: ${cellId}`);
  return region;
}
export function levelRange(cellId: string): readonly [number, number] { return regionOf(cellId).levelRange; }
export function habitatOf(cellId: string): Habitat {
  const cell = PET_WORLD.find(c => c.id === cellId);
  if (!cell) throw new RangeError(`Unknown cell: ${cellId}`);
  if (/하천|연못|물가/.test(`${cell.name} ${cell.kind}`)) return "river";
  if (/코스/.test(cell.name) && /숲/.test(cell.kind)) return "forest";
  // Actual place names take precedence over old decorative map themes/kinds.
  const classify = (text: string): Habitat | undefined => {
    if (/하천|연못|물가/.test(text)) return "river";
    if (/숲|산길|동산/.test(text)) return "forest";
    if (/주택|아파트|단지|집 마당/.test(text)) return "housing";
    if (/학교|대학/.test(text)) return "school";
    if (/성당|교회|예배당/.test(text)) return "church";
    if (/역전|전철역|당정역|군포역/.test(text)) return "station";
    if (/시장|상가|마트|먹자|가게|음식점|트레이더스/.test(text)) return "shops";
    if (/공원|광장|잔디|골프|컨트리클럽|체육센터|운동장|녹지|들판/.test(text)) return "park";
    if (/공장|공단 거리|공단 지역|산업|물류|창고|철도 기지/.test(text)) return "industry";
    if (/도로|철길|고가|터널|길|거리|차로/.test(text)) return "road";
    return undefined;
  };
  return classify(cell.name) ?? classify(cell.kind) ?? "housing";
}
export const HABITAT_WEIGHTS: Record<Habitat, Partial<Record<SpeciesKey, number>>> = {
  forest: { waterdeer: 22, boar: 18, raccoon: 16, squirrel: 16, chipmunk: 12, bulbul: 8, magpie: 4, dog: 4 },
  river: { duck: 65, raccoon: 25, dog: 10 },
  shops: { pigeon: 35, cat: 30, magpie: 20, dog: 10, sparrow: 5 },
  station: { pigeon: 40, cat: 25, magpie: 20, dog: 10, sparrow: 5 },
  housing: { dog: 50, cat: 35, sparrow: 15 },
  park: { dog: 30, cat: 10, pigeon: 10, sparrow: 10, waterdeer: 10, squirrel: 10, raccoon: 5, magpie: 5, bulbul: 10 },
  school: { dog: 40, cat: 25, sparrow: 35 },
  road: { dog: 25, cat: 25, pigeon: 25, magpie: 15, sparrow: 10 },
  industry: { dog: 30, cat: 20, pigeon: 30, magpie: 20 },
  church: { dog: 45, cat: 25, sparrow: 30 },
};
export const SAFE_CELLS: readonly string[] = ["D5", "E5"];
