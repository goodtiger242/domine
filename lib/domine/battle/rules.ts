import { BREED_BY_ID, GROWTH, ITEM_BY_ID, MOVE_BY_ID, PUSH } from "./data";
import type { Action, Actor, BattleState, Fighter, Group, Hint, Move, Side, Size, Stat, Stats, Temperament } from "./types";

export const MAX_ENERGY = 10;
export const MAX_ROUNDS = 12;
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const GROUPS: Group[] = ["rush", "trick", "track", "guard", "bond", "endure"];
const MATCHUPS = [
  [1,1.3,1,.75,1,.75], [1,1,.75,1.3,.75,1.3], [1.3,1.3,1,1,.75,.75],
  [1.3,.75,1,1,1.3,1], [.75,1,1.3,.75,1,1.3], [1,.75,1.3,1.3,1,1],
];
const SIZES: Size[] = ["small", "medium", "large"];
const SIZE_RATES = [[1,1.03,1.05],[.97,1,1.03],[.95,.97,1]];
const TEMPERAMENTS: Temperament[] = ["lively", "careful", "kind", "steady"];
const TEMPERAMENT_RATES = [[0,-5,5,0],[5,0,0,-5],[0,5,0,-5],[-5,0,5,0]];

export function matchup(group: Move["group"], defender: Group): number {
  return group === "neutral" ? 1 : MATCHUPS[GROUPS.indexOf(group)][GROUPS.indexOf(defender)];
}
export function sizeMultiplier(group: Move["group"], attacker: Size, defender: Size): number {
  return group === "track" || group === "bond" ? 1 : SIZE_RATES[SIZES.indexOf(attacker)][SIZES.indexOf(defender)];
}
export function temperamentBonus(attacker: Temperament, defender: Temperament): number {
  return TEMPERAMENT_RATES[TEMPERAMENTS.indexOf(attacker)][TEMPERAMENTS.indexOf(defender)];
}
export function effectHint(move: Move, _attacker: Fighter, defender: Fighter): Hint {
  const rate = move.kind === "attack" ? matchup(move.group, BREED_BY_ID[defender.breedId].group) : 1;
  return rate > 1 ? "good" : rate < 1 ? "weak" : "normal";
}

export function buildFighter(breedId: string, level: number, equipment: readonly string[] = [], options: { moves?: readonly string[]; consumable?: string } = {}): Fighter {
  const breed = BREED_BY_ID[breedId];
  if (!breed || !Number.isInteger(level) || level < 1 || level > 30) throw new Error("견종 또는 레벨이 올바르지 않습니다.");
  const slots = new Set<string>();
  const rates: Partial<Stats> = {};
  for (const id of equipment) {
    const item = ITEM_BY_ID[id];
    if (!item || item.slot === "bag" || slots.has(item.slot)) throw new Error("장비는 슬롯별 한 개만 선택합니다.");
    slots.add(item.slot);
    for (const stat of Object.keys(item.rates ?? {}) as Stat[]) rates[stat] = (rates[stat] ?? 0) + item.rates![stat]!;
  }
  if (options.consumable && ITEM_BY_ID[options.consumable]?.slot !== "bag") throw new Error("올바른 소모품이 아닙니다.");
  const q = Math.min(level - 1, 19) + .8 * Math.max(level - 20, 0);
  const result = {} as Stats;
  for (const stat of Object.keys(breed.base) as Stat[]) {
    const base = breed.base[stat] + Math.floor(GROWTH[breed.growth][stat] * q);
    const rate = Math.min(rates[stat] ?? 0, stat === "hp" ? .10 : .08);
    result[stat] = base + (rate > 0 ? Math.max(1, Math.floor(base * rate)) : 0);
  }
  const learned = breed.learn.filter(entry => entry.level <= level).map(entry => entry.move);
  const moves = options.moves ?? learned.slice(0, 4);
  if (!moves.length || moves.length > 4 || new Set(moves).size !== moves.length || moves.some(id => !learned.includes(id))) throw new Error("배운 기술 중 1~4개를 선택합니다.");
  return { breedId, level, stats: result, equipment: [...equipment], moves: [...moves], ...(options.consumable ? { consumable: options.consumable } : {}) };
}

export function effectiveStat(actor: Fighter | Actor, stat: Exclude<Stat, "hp">, round = 1): number {
  let rate = 1;
  if ("buffs" in actor) {
    if (actor.buffs.some(b => b.stat === stat)) rate *= 1.15;
    const penalty = { attack: ["stagger", .85], defense: ["open", .85], speed: ["slow", .8], focus: ["tense", .8] } as const;
    if (stat !== "calm" && actor.statuses.some(s => s.id === penalty[stat][0])) rate *= penalty[stat][1];
  }
  if (stat === "speed" && round <= 2 && BREED_BY_ID[actor.breedId].trait === "earlySpeed") rate *= 1.05;
  return Math.floor(actor.stats[stat] * rate);
}
export function hitChance(move: Move, attacker: Fighter | Actor, defender: Fighter | Actor, round = 1): number {
  if (move.kind !== "attack") return 100;
  const blur = "statuses" in attacker && attacker.statuses.some(s => s.id === "blur") ? -10 : 0;
  return Math.round(clamp(move.accuracy + .3 * (effectiveStat(attacker,"focus",round) - effectiveStat(defender,"speed",round)) + blur,70,99) * 10) / 10;
}
export function statusChance(move: Move, attacker: Fighter | Actor, defender: Fighter | Actor): number {
  if (!move.status) return 0;
  return clamp((move.chance ?? 0) + .4 * (effectiveStat(attacker,"focus") - effectiveStat(defender,"calm")) + temperamentBonus(BREED_BY_ID[attacker.breedId].temperament, BREED_BY_ID[defender.breedId].temperament),10,65);
}
export function damageAt(move: Move, attacker: Fighter | Actor, defender: Fighter | Actor, roll: number, round = 1): number {
  if (move.kind !== "attack") return 0;
  const a = BREED_BY_ID[attacker.breedId], d = BREED_BY_ID[defender.breedId];
  const offense = effectiveStat(attacker, move.group === "track" || move.group === "bond" ? "focus" : "attack", round);
  const defense = effectiveStat(defender, move.group === "bond" ? "calm" : "defense", round);
  let trait = 1;
  if ("traitUsed" in attacker) {
    if (a.trait === "restDamage" && attacker.rested) trait *= 1.08;
    if (!attacker.traitUsed && ((a.trait === "firstTrack" && move.group === "track") || (a.trait === "firstBond" && move.group === "bond") || (a.trait === "firstRush" && move.group === "rush"))) trait *= 1.08;
  }
  if (a.trait === "trackDamage" && move.group === "track") trait *= 1.04;
  if ("traitUsed" in defender && d.trait === "firstShield" && !defender.traitUsed) trait *= .92;
  const shield = "shield" in defender ? defender.shield?.multiplier ?? 1 : 1;
  return Math.max(1, Math.floor((move.power * (1 + attacker.level / 20) + .45 * offense) * 40 / (40 + defense) * matchup(move.group,d.group) * sizeMultiplier(move.group,a.size,d.size) * trait * shield * roll));
}
// Damage range is conditional on a hit; hitChance is reported separately.
export function previewDamage(move: Move, attacker: Fighter | Actor, defender: Fighter | Actor, round = 1) {
  return { min: damageAt(move,attacker,defender,.95,round), max: damageAt(move,attacker,defender,1.05,round), hitChance: hitChance(move,attacker,defender,round), statusChance: statusChance(move,attacker,defender), multiplier: move.kind === "attack" ? matchup(move.group,BREED_BY_ID[defender.breedId].group) : 1 };
}
export function moveFor(action: Action): Move | undefined {
  return action.kind === "push" ? PUSH : action.kind === "move" ? MOVE_BY_ID[action.moveId] : undefined;
}
export function recoveryLeft(actor: Actor): number {
  return Math.max(0, Math.min(actor.stats.hp - actor.hp, Math.floor(actor.stats.hp * .25) - actor.healed));
}
export function availableActions(state: BattleState, side: Side): Action[] {
  if (state.outcome) return [];
  const actor = state[side];
  const result: Action[] = [{ kind: "push" }, { kind: "rest" }];
  for (const id of actor.moves) {
    const move = MOVE_BY_ID[id];
    if (move.energy <= actor.energy && (!move.heal || recoveryLeft(actor) > 0)) result.push({ kind: "move", moveId: id });
  }
  const item = actor.consumable && ITEM_BY_ID[actor.consumable];
  if (item && !actor.itemUsed && (item.heal ? recoveryLeft(actor) > 0 : actor.energy < MAX_ENERGY)) result.push({ kind: "item", itemId: item.id });
  if (side === "player") result.push({ kind: "quit" });
  return result;
}
export function sameAction(a: Action, b: Action): boolean {
  return a.kind === b.kind && (a.kind !== "move" || b.kind === "move" && a.moveId === b.moveId) && (a.kind !== "item" || b.kind === "item" && a.itemId === b.itemId);
}
