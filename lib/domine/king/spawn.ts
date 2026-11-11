import { random, seedFor } from "../battle/rng";
import { BREED_BY_ID, SPECIES, type Habitat } from "./species";
import { INDIVIDUALS, intelligenceFor, type Individual } from "./individuals";
import { NAMED, type NamedIndividual } from "./named";
import { HABITAT_WEIGHTS, habitatOf, levelRange, SAFE_CELLS } from "./world";

export const GUEST_RATE = .065;
export interface Spawn {
  individual: Individual | NamedIndividual;
  kind: "resident" | "named"; cellId: string; slot: number; level: number;
}
const pools = Object.fromEntries(Object.keys(HABITAT_WEIGHTS).map(key => {
  const habitat = key as Habitat;
  return [habitat, INDIVIDUALS.filter(i => BREED_BY_ID[i.breedId].habitat.includes(habitat) && (HABITAT_WEIGHTS[habitat][i.species] ?? 0) > 0)];
})) as Readonly<Record<string, readonly Individual[]>>;
const guests = INDIVIDUALS.filter(i => SPECIES.some(s => s.id === i.species && s.category === "guest" && s.active && s.art));

/** Slot is floor(timestamp / 1800000). Care level gates named opponents only. */
export function pickSpawns(cellId: string, slot: number, careLevel: number): Spawn[] {
  const habitat = habitatOf(cellId);
  if (!Number.isSafeInteger(slot) || slot < 0) throw new RangeError("Invalid encounter slot");
  if (SAFE_CELLS.includes(cellId)) return [];
  const playerLevel = Number.isFinite(careLevel) ? Math.max(1, Math.min(999, Math.floor(careLevel))) : 1;
  const cellSeed = seedFor(cellId, seedFor(String(slot), 0));
  const roll = (label: string) => random(seedFor(label, cellSeed)).value;
  const spawns: Spawn[] = [];
  if (roll("presence") < .3) {
    const countRoll = roll("count"), count = countRoll < .65 ? 1 : countRoll < .9 ? 2 : 3;
    const used = new Set<string>();
    for (let i = 0; i < count; i++) {
      const guestPool = guests.filter(g => !used.has(g.id));
      let candidates = roll(`guest:${i}`) < GUEST_RATE && guestPool.length ? guestPool : pools[habitat].filter(p => !used.has(p.id));
      if (!candidates.length) throw new Error(`Empty spawn pool: ${habitat}`);
      if (candidates !== guestPool) {
        const species = [...new Set(candidates.map(c => c.species))];
        const total = species.reduce((sum, s) => sum + (HABITAT_WEIGHTS[habitat][s] ?? 0), 0);
        let point = roll(`species:${i}`) * total;
        const selected = species.find(s => (point -= HABITAT_WEIGHTS[habitat][s] ?? 0) < 0) ?? species[species.length - 1];
        candidates = candidates.filter(c => c.species === selected);
      }
      const individual = candidates[Math.floor(roll(`individual:${i}`) * candidates.length)];
      used.add(individual.id);
      const range = levelRange(cellId);
      const level = Math.max(1, (range[0] + range[1]) / 2 + individual.levelOffset);
      spawns.push({ individual: { ...individual, intelligence: intelligenceFor(individual.temperament, level) }, kind: "resident", cellId, slot, level });
    }
  }
  // Named encounters are additional fixed residents, outside the 0/1/2/3 random quota.
  for (const individual of NAMED) {
    if (individual.cellId === cellId && playerLevel >= individual.minCareLevel) {
      spawns.push({ individual, kind: "named", cellId, slot, level: individual.baseLevel });
    }
  }
  return spawns;
}
