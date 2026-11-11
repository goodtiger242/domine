import { BREED_BY_ID } from "./data";
import type { BattleProfile, Fighter, Size, Species, Stat, Stats } from "./types";

export const DEFAULT_PROFILE: BattleProfile = {
  critBonus: 0, critMultiplier: 1.5, momentumRate: 1, evade: 0,
  restEnergy: 5, statusTaken: 1, statusDealt: 1, statTilt: {},
};
const profile = (values: Partial<BattleProfile>): BattleProfile => ({ ...DEFAULT_PROFILE, ...values });
export const BATTLE_PROFILES: Record<Exclude<Species, "dog"> | `dog_${Size}`, BattleProfile> = {
  dog_medium: profile({ momentumRate: 1.1, statusTaken: .925, critBonus: -1 }),
  dog_small: profile({ critBonus: 2, evade: 1, statTilt: { hp: -.10, attack: .02, speed: .02 } }),
  dog_large: profile({ statusTaken: .8, critBonus: -1, statTilt: { hp: .10, speed: -.10 } }),
  cat: profile({ critBonus: 2, critMultiplier: 1.54, statTilt: { hp: -.06 } }),
  pigeon: profile({ restEnergy: 6, momentumRate: 1.025, statTilt: { attack: -.08 } }),
  magpie: profile({ momentumRate: 1.2, statTilt: { defense: -.08 } }),
  sparrow: profile({ evade: 1, statTilt: { speed: .04, hp: -.06 } }),
  bulbul: profile({ evade: 1, statTilt: { speed: .04, hp: -.06 } }),
  duck: profile({ statusTaken: .9, statTilt: { calm: .04, speed: -.04 } }),
  deer: profile({ momentumRate: 1.1, statTilt: { speed: .04, calm: -.04 } }),
  boar: profile({ critBonus: -.5, statTilt: { attack: .08, hp: .01, speed: -.02 } }),
  raccoon: profile({ evade: 1, statusDealt: 1.15, statTilt: { attack: -.06 } }),
  squirrel: profile({ critBonus: 1, statTilt: { speed: .04, defense: -.06 } }),
  chipmunk: profile({ critBonus: 1, statTilt: { speed: .04, defense: -.06 } }),
};
export const BREED_PROFILE_BONUSES: Record<string, { species: Species; bonus: Partial<BattleProfile> }> = {
  B003: { species: "dog", bonus: { momentumRate: 1.05 } },
  B020: { species: "dog", bonus: { statTilt: { speed: .04 } } },
  C07: { species: "cat", bonus: { statTilt: { calm: .06 } } },
};
const DOG_SIZES: Record<string, Size> = Object.fromEntries([
  ...["B103","B104","B105","B106","B107","B108","B109","B110","B111"].map(id => [id,"small"]),
  ...["B101","B113","B114","B115","B116","B117","B118","B119","B120"].map(id => [id,"large"]),
]);
export function profileFor(species: Species, breedId?: string): BattleProfile {
  const size = breedId ? BREED_BY_ID[breedId]?.size ?? DOG_SIZES[breedId] ?? "medium" : "medium";
  const key = species === "dog" ? `dog_${size}` as const : species;
  if (!Object.hasOwn(BATTLE_PROFILES,key)) throw new Error("전투 성향의 종을 확인해 주세요.");
  const base = BATTLE_PROFILES[key], entry = breedId && Object.hasOwn(BREED_PROFILE_BONUSES,breedId) ? BREED_PROFILE_BONUSES[breedId] : undefined;
  const bonus = entry?.species === species ? entry.bonus : undefined;
  const result = { ...base, statTilt: { ...base.statTilt } };
  if (bonus?.momentumRate) result.momentumRate *= bonus.momentumRate;
  for (const [stat,value] of Object.entries(bonus?.statTilt ?? {}) as [Stat,number][]) result.statTilt[stat] = (result.statTilt[stat] ?? 0) + value;
  return result;
}
export const fighterProfile = (fighter: Fighter): BattleProfile => fighter.battleProfile ?? DEFAULT_PROFILE;

export function tiltStats(base: Stats, tilt: Partial<Stats>): Stats {
  const keys = Object.keys(base) as Stat[], total = keys.reduce((sum,key) => sum + base[key],0);
  const weighted = keys.map(key => base[key] * (1 + (tilt[key] ?? 0)));
  const sum = weighted.reduce((a,b) => a+b,0);
  const deltas = weighted.map((value,i) => value * total / sum - base[keys[i]]);
  // Normalize the budget, then shrink the whole redistribution to keep every stat within 12%.
  const scale = Math.min(1,...deltas.map((delta,i) => delta ? base[keys[i]] * .12 / Math.abs(delta) : 1));
  const exact = keys.map((key,i) => base[key] + deltas[i] * scale), values = exact.map(Math.floor);
  const order = keys.map((_,i) => i).sort((a,b) => (exact[b]-values[b]) - (exact[a]-values[a]) || a-b);
  const remainder = total - values.reduce((a,b) => a+b,0);
  for (let i=0;i<remainder;i++) values[order[i]]++;
  return Object.fromEntries(keys.map((key,i) => [key,values[i]])) as Stats;
}
