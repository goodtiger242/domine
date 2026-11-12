import { random, seedFor } from "../battle/rng";
import { BREED_BY_ID, SPECIES, type Habitat } from "./species";
import { INDIVIDUALS, intelligenceFor, type Individual } from "./individuals";
import { NAMED, type NamedIndividual } from "./named";
import { HABITAT_WEIGHTS, habitatOf, levelRange, REGIONS, regionOf, SAFE_CELLS } from "./world";

export const GUEST_RATE = .065;
/** Animals are shared by every player, so they are scarce: a cell has animals in 18% of slots and each stays 15 of the 30 minutes. */
export const SPAWN_RATE = .18, SLOT_MS = 1800000, STAY_MS = 900000;
/** Below this level a dog is still practising: it keeps the plentiful animals at its own level so a new player always finds a first opponent. */
export const STARTER_LEVEL = 5, STARTER_RATE = .3;
/** Five points (lowest, 25%, 50%, 75%, highest) of every active player's dog levels; the server fixes them once a day. */
export type LevelProfile = { day: string; levels: readonly number[] };
export interface Spawn {
  individual: Individual | NamedIndividual;
  kind: "resident" | "named"; cellId: string; slot: number; level: number;
  /** Epoch ms between which the animal is on the map. */
  from: number; until: number;
}
export const validProfile = (profile?: LevelProfile | null): profile is LevelProfile => !!profile && Array.isArray(profile.levels)
  && profile.levels.length === 5 && profile.levels.every((l, i, all) => Number.isInteger(l) && l >= 1 && l <= 999 && (!i || l >= all[i - 1]));
/** Level from the shared profile: regions near the church draw from the lower half, the farthest from the upper half. */
export function profileLevel(profile: LevelProfile, cellId: string, roll: number, offset: number): number {
  const lowest = REGIONS.indexOf(regionOf(cellId)) / (REGIONS.length - 1) * .5, at = (lowest + roll * .5) * 4;
  const i = Math.min(3, Math.floor(at)), level = profile.levels[i] + (profile.levels[i + 1] - profile.levels[i]) * (at - i);
  return Math.max(1, Math.min(999, profile.levels[4] + 3, Math.round(level) + offset));
}
const pools = Object.fromEntries(Object.keys(HABITAT_WEIGHTS).map(key => {
  const habitat = key as Habitat;
  return [habitat, INDIVIDUALS.filter(i => BREED_BY_ID[i.breedId].habitat.includes(habitat) && (HABITAT_WEIGHTS[habitat][i.species] ?? 0) > 0)];
})) as Readonly<Record<string, readonly Individual[]>>;
const guests = INDIVIDUALS.filter(i => SPECIES.some(s => s.id === i.species && s.category === "guest" && s.active && s.art));

/** Slot is floor(timestamp / 1800000). Who is where and when is the same for everyone; without a profile (older server) levels follow our dog. */
export function pickSpawns(cellId: string, slot: number, careLevel: number, profile?: LevelProfile | null): Spawn[] {
  const habitat = habitatOf(cellId);
  if (!Number.isSafeInteger(slot) || slot < 0) throw new RangeError("Invalid encounter slot");
  if (SAFE_CELLS.includes(cellId)) return [];
  const playerLevel = Number.isFinite(careLevel) ? Math.max(1, Math.min(999, Math.floor(careLevel))) : 1;
  const cellSeed = seedFor(cellId, seedFor(String(slot), 0));
  const roll = (label: string) => random(seedFor(label, cellSeed)).value;
  const spawns: Spawn[] = [];
  const starter = playerLevel < STARTER_LEVEL;
  // The same roll decides both, so a veteran's animals are always a subset of a starter's.
  if (roll("presence") < (starter ? STARTER_RATE : SPAWN_RATE)) {
    const countRoll = roll("count"), count = countRoll < .65 ? 1 : countRoll < .9 ? 2 : 3;
    const used = new Set<string>(), usedGuests = new Set<string>();
    for (let i = 0; i < count; i++) {
      const guestPool = guests.filter(g => !usedGuests.has(g.id));
      let candidates = pools[habitat].filter(p => !used.has(p.id));
      if (!candidates.length) throw new Error(`Empty spawn pool: ${habitat}`);
      {
        const species = [...new Set(candidates.map(c => c.species))];
        const total = species.reduce((sum, s) => sum + (HABITAT_WEIGHTS[habitat][s] ?? 0), 0);
        let point = roll(`species:${i}`) * total;
        const selected = species.find(s => (point -= HABITAT_WEIGHTS[habitat][s] ?? 0) < 0) ?? species[species.length - 1];
        candidates = candidates.filter(c => c.species === selected);
      }
      let individual = candidates[Math.floor(roll(`individual:${i}`) * candidates.length)];
      used.add(individual.id);
      // Reserve the original animal even when replaced, so later animal slots keep their seeds.
      const guest = roll(`guest:${i}`) < GUEST_RATE + (habitat === "forest" ? .01 : 0) && guestPool.length > 0;
      if (guest) {
        individual = guestPool[Math.floor(roll(`individual:${i}`) * guestPool.length)];
        usedGuests.add(individual.id);
      }
      // Residents scale with our dog: farther regions add +0..+3, each animal −3..+3, never more than 5 above us.
      const tier = Math.floor((levelRange(cellId)[0] - 1) / 18);
      const level = !starter && validProfile(profile) ? profileLevel(profile, cellId, roll(`level:${i}`), individual.levelOffset)
        : Math.max(1, Math.min(999, playerLevel + 5, playerLevel + tier + individual.levelOffset));
      const from = starter ? slot * SLOT_MS : slot * SLOT_MS + Math.floor(roll(`start:${i}`) * ((SLOT_MS - STAY_MS) / 60000 + 1)) * 60000;
      spawns.push({ individual: { ...individual, intelligence: intelligenceFor(individual.temperament, guest ? Math.min(level, 15) : level) }, kind: "resident", cellId, slot, level, from, until: starter ? (slot + 1) * SLOT_MS : from + STAY_MS });
    }
  }
  // Named encounters are additional fixed residents, outside the 0/1/2/3 random quota.
  for (const individual of NAMED) {
    if (individual.cellId === cellId && playerLevel >= individual.minCareLevel) {
      spawns.push({ individual, kind: "named", cellId, slot, level: individual.baseLevel, from: slot * SLOT_MS, until: (slot + 1) * SLOT_MS });
    }
  }
  return spawns;
}
