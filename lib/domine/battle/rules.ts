import { BREED_BY_ID, FINISHERS, ITEM_BY_ID, MOVE_BY_ID, MOVES, PUSH } from "./data";
import { random } from "./rng";
import type { Action, Actor, BattleState, Condition, Fighter, FighterOptions, Group, Hint, Move, MovementType, Side, Size, Stat, Stats, Temperament } from "./types";

export const MAX_ENERGY = 10;
export const START_ENERGY = 10;
export const REST_ENERGY = 5;
export const MAX_ROUNDS = 12;
export const MAX_LEVEL = 999;
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const STATS: Stat[] = ["hp", "attack", "defense", "speed", "focus", "calm"];
function checkLevel(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) throw new Error("레벨은 1~999 정수입니다.");
}
export function cumulativeXp(level: number): number {
  checkLevel(level);
  return 6 * (level - 1) * (level + 4) + Math.floor(Math.max(0, level - 10) ** 3 / 25);
}
export function levelFromXp(xp: number): number {
  if (!Number.isSafeInteger(xp) || xp < 0) throw new Error("XP는 0 이상의 안전한 정수입니다.");
  let low = 1, high = MAX_LEVEL;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (cumulativeXp(mid) <= xp) low = mid; else high = mid - 1;
  }
  return low;
}
export function xpToNext(xp: number): number {
  const level = levelFromXp(xp);
  return level === MAX_LEVEL ? 0 : cumulativeXp(level + 1) - xp;
}
export function growthQ(level: number): number {
  checkLevel(level);
  return Math.min(level - 1, 19) + .8 * Math.min(Math.max(level - 20, 0), 30) + 16 * Math.log1p(Math.max(level - 50, 0) / 50);
}
export const growthScale = (level: number) => 1 + growthQ(level) / 20;
export function conditionPenalty(condition: Condition): number {
  const values = [condition.fullness, condition.mood, condition.clean];
  if (values.some(v => !Number.isFinite(v) || v < 0 || v > 100)) throw new Error("컨디션은 0~100입니다.");
  return Math.min(30, values.reduce((sum, v) => sum + (v >= 60 ? 0 : v >= 40 ? 5 : v >= 20 ? 10 : 15), 0)) / 100;
}
export function recommendedAllocation(breedId: string, level: number): Stats {
  checkLevel(level);
  const breed = BREED_BY_ID[breedId];
  if (!breed) throw new Error("올바른 견종이 아닙니다.");
  const weights = breedId === "B001" ? [.20,.12,.18,.12,.23,.15] : breedId === "B002" ? [.16,.20,.14,.24,.16,.10] : STATS.map(s => breed.base[s] / (s === "hp" ? 4 : 1));
  const sum = weights.reduce((a,b) => a+b,0), total = 3 * (level - 1), cap = Math.max(1,Math.floor(total * .4));
  const points: Stats = { hp: 0, attack: 0, defense: 0, speed: 0, focus: 0, calm: 0 };
  for (let n = 1; n <= total; n++) {
    let best = -1, deficit = -Infinity;
    STATS.forEach((s,i) => { const d = weights[i] / sum * n - points[s]; if (points[s] < cap && d > deficit) { best = i; deficit = d; } });
    points[STATS[best]]++;
  }
  return points;
}
const GROUPS: Group[] = ["rush", "trick", "track", "guard", "bond", "endure"];
const MATCHUPS = [
  [1,1.3,1,.75,1,.75], [1,1,.75,1.3,.75,1.3], [1.3,1.3,1,1,.75,.75],
  [1.3,.75,1,1,1.3,1], [.75,1,1.3,.75,1,1.3], [1,.75,1.3,1.3,1,1],
];
const SIZES: Size[] = ["small", "medium", "large"];
const SIZE_RATES = [[1,1.03,1.05],[.97,1,1.03],[.95,.97,1]];
const TEMPERAMENTS: Temperament[] = ["lively", "careful", "kind", "steady"];
const TEMPERAMENT_RATES = [[0,-5,5,0],[5,0,0,-5],[0,5,0,-5],[-5,0,5,0]];

const MOVEMENTS: MovementType[] = ["companion", "agile", "flying", "runner", "heavy", "waterside"];
const MOVEMENT_RATES = [[1,1.04,.96,1,.96,1.04],[.96,1,1.04,.96,1.06,1],[1.04,.96,1,1.04,1,.96],[1,1.04,.96,1,.96,1.04],[1.04,.94,1,1.04,1,.96],[.96,1,1.04,.96,1.04,1]];
export function matchup(group: Move["group"], defender: Group, attacker?: Fighter, target?: Fighter): number {
  const primary = group === "neutral" ? 1 : MATCHUPS[GROUPS.indexOf(group)][GROUPS.indexOf(defender)];
  if (!attacker || !target) return primary;
  const movement = attacker.movementType && target.movementType ? MOVEMENT_RATES[MOVEMENTS.indexOf(attacker.movementType)][MOVEMENTS.indexOf(target.movementType)] : 1;
  const environment = attacker.environment;
  const habitat = environment?.habitat && attacker.habitats?.includes(environment.habitat) ? 1.03 : 1;
  let weather = 1;
  if (environment?.weather === "rain") weather = attacker.movementType === "waterside" ? 1.03 : attacker.movementType === "flying" ? .97 : 1;
  if (environment?.weather === "wind") weather = attacker.movementType === "flying" ? 1.03 : attacker.movementType === "agile" ? .97 : 1;
  if (environment?.weather === "snow") weather = group === "endure" ? 1.03 : group === "rush" ? .97 : 1;
  return primary * clamp(movement * habitat * weather * sizeMultiplier(group,BREED_BY_ID[attacker.breedId].size,BREED_BY_ID[target.breedId].size),.88,1.12);
}
export function sizeMultiplier(group: Move["group"], attacker: Size, defender: Size): number {
  return group === "track" || group === "bond" ? 1 : SIZE_RATES[SIZES.indexOf(attacker)][SIZES.indexOf(defender)];
}
export function temperamentBonus(attacker: Temperament, defender: Temperament): number {
  return TEMPERAMENT_RATES[TEMPERAMENTS.indexOf(attacker)][TEMPERAMENTS.indexOf(defender)];
}
export function effectHint(move: Move, attacker: Fighter, defender: Fighter): Hint {
  const rate = move.kind === "attack" ? matchup(move.group, BREED_BY_ID[defender.breedId].group,attacker,defender) : 1;
  return rate >= 1.10 ? "good" : rate <= .90 ? "weak" : "normal";
}

export function buildFighter(breedId: string, level: number, equipment: readonly string[] = [], options: FighterOptions = {}): Fighter {
  const breed = BREED_BY_ID[breedId];
  checkLevel(level);
  if (!breed) throw new Error("견종이 올바르지 않습니다.");
  for (const flag of [options.owned,options.boss,options.equipmentStats]) if (flag !== undefined && typeof flag !== "boolean") throw new Error("전투 옵션은 참/거짓입니다.");
  if (options.finisher !== undefined && !FINISHERS.some(m => m.id === options.finisher)) throw new Error("올바른 결정기가 아닙니다.");
  const items = options.items ?? (options.consumable ? [options.consumable] : []);
  if (!Array.isArray(items) || items.length > 3 || items.some(id => ITEM_BY_ID[id]?.slot !== "bag")) throw new Error("소모품은 한 판에 3개까지입니다.");
  if (options.items && options.consumable) throw new Error("items와 consumable은 함께 지정할 수 없습니다.");
  const allocation = options.allocation ?? recommendedAllocation(breedId,level), total = 3 * (level - 1);
  for (const [stat,value] of Object.entries(allocation)) if (!STATS.includes(stat as Stat) || !Number.isInteger(value) || value < 0 || value > (total ? Math.max(1,Math.floor(total*.4)) : 0)) throw new Error("분배 포인트 상한을 확인해 주세요.");
  if (Object.values(allocation).reduce((s,v) => s+v,0) > total) throw new Error("분배 포인트가 부족합니다.");
  for (const [stat,rate] of Object.entries(options.job ?? {})) if (!STATS.includes(stat as Stat) || !Number.isFinite(rate) || Math.abs(rate) > .08) throw new Error("직업 보정은 스탯별 ±8% 이내입니다.");
  for (const [id,rank] of Object.entries(options.mastery ?? {})) if (!(MOVE_BY_ID[id] || id === PUSH.id) || !Number.isInteger(rank) || rank < 1 || rank > 5) throw new Error("기술 숙련도는 1~5입니다.");
  if (options.movementType && !MOVEMENTS.includes(options.movementType)) throw new Error("움직임 유형을 확인해 주세요.");
  if (options.habitats?.some(h => !["H","U","G","F","W"].includes(h)) || options.activeBands?.some(t => !["morning","day","evening","night"].includes(t))) throw new Error("서식지·활동 시간을 확인해 주세요.");
  const env = options.environment;
  if (env && ((env.habitat !== undefined && !["H","U","G","F","W"].includes(env.habitat)) || (env.time !== undefined && !["morning","day","evening","night"].includes(env.time)) || (env.weather !== undefined && !["clear","rain","wind","snow"].includes(env.weather)))) throw new Error("전투 환경을 확인해 주세요.");
  const penalty = options.condition ? conditionPenalty(options.condition) : 0;
  const slots = new Set<string>();
  const rates: Partial<Stats> = {};
  for (const id of equipment) {
    const item = ITEM_BY_ID[id];
    if (!item || item.slot === "bag" || slots.has(item.slot)) throw new Error("장비는 슬롯별 한 개만 선택합니다.");
    slots.add(item.slot);
    if (options.equipmentStats === true) for (const stat of Object.keys(item.rates ?? {}) as Stat[]) rates[stat] = (rates[stat] ?? 0) + item.rates![stat]!;
  }
  if (options.consumable && ITEM_BY_ID[options.consumable]?.slot !== "bag") throw new Error("올바른 소모품이 아닙니다.");
  const q = growthQ(level);
  const result = {} as Stats;
  for (const stat of Object.keys(breed.base) as Stat[]) {
    const base = Math.floor(breed.base[stat] * (1 + q / 20 * (.8 + 1.2 * (total ? (allocation[stat] ?? 0) / total : 0))));
    const rate = Math.min(rates[stat] ?? 0, stat === "hp" ? .10 : .08);
    result[stat] = Math.max(1,Math.floor((base + (rate > 0 ? Math.max(1, Math.floor(base * rate)) : 0)) * (1 + (options.job?.[stat] ?? 0)) * (stat === "hp" ? 1 : 1 - penalty)));
  }
  const learned = breed.learn.filter(entry => entry.level <= level).map(entry => entry.move);
  const moves = options.moves ?? learned.slice(0, 4);
  if (!moves.length || moves.length > 4 || new Set(moves).size !== moves.length || moves.some(id => !learned.includes(id) && !MOVES.some(m => m.id === id && m.common))) throw new Error("배운 기술 중 1~4개를 선택합니다.");
  return { ...structuredClone(options), finisher: options.finisher ?? FINISHERS.find(m => m.group === breed.group)!.id, allocation: { ...allocation }, breedId, level, stats: result, equipment: [...equipment], moves: [...moves] };
}

export function effectiveStat(actor: Fighter | Actor, stat: Exclude<Stat, "hp">, round = 1): number {
  let rate = 1;
  if ("buffs" in actor) {
    if (actor.recoil?.stat === stat && actor.recoil.expires >= round) rate *= 1 - (actor.recoil.rate ?? 0);
    rate *= 1 + Math.max(0,...actor.buffs.filter(b => b.stat === stat && b.expires >= round).map(b => b.rate ?? .15));
    const penalty = { attack: ["stagger", .85], defense: ["open", .85], speed: ["slow", .8], focus: ["tense", .8] } as const;
    if (stat !== "calm" && actor.statuses.some(s => s.id === penalty[stat][0])) rate *= penalty[stat][1];
  }
  if (stat === "speed" && round <= 2 && BREED_BY_ID[actor.breedId].trait === "earlySpeed") rate *= 1.05;
  if (stat === "focus" && actor.environment?.time && actor.activeBands?.includes(actor.environment.time)) rate *= 1.03;
  return Math.floor(actor.stats[stat] * rate);
}
export function normalizedStat(actor: Fighter | Actor, stat: Exclude<Stat,"hp">, round = 1): number {
  return effectiveStat(actor,stat,round) / growthScale(actor.level);
}
export function critChance(attacker: Fighter | Actor): number {
  return clamp(5 + normalizedStat(attacker,"focus") * .2,5,25);
}
export function hitChance(move: Move, attacker: Fighter | Actor, defender: Fighter | Actor, round = 1): number {
  if (move.kind !== "attack") return 100;
  const blur = "statuses" in attacker && attacker.statuses.some(s => s.id === "blur") ? -10 : 0;
  return Math.round(clamp(move.accuracy + .3 * (normalizedStat(attacker,"focus",round) - normalizedStat(defender,"speed",round)) + blur,70,99) * 10) / 10;
}
export function statusChance(move: Move, attacker: Fighter | Actor, defender: Fighter | Actor): number {
  if (!move.status) return 0;
  return clamp((move.chance ?? 0) + .4 * (normalizedStat(attacker,"focus") - normalizedStat(defender,"calm")) + temperamentBonus(BREED_BY_ID[attacker.breedId].temperament, BREED_BY_ID[defender.breedId].temperament),10,65);
}
export function damageAt(move: Move, attacker: Fighter | Actor, defender: Fighter | Actor, roll: number, round = 1): number {
  if (move.kind !== "attack") return 0;
  const a = BREED_BY_ID[attacker.breedId], d = BREED_BY_ID[defender.breedId];
  const offense = normalizedStat(attacker, move.group === "track" || move.group === "bond" ? "focus" : "attack", round);
  const defense = normalizedStat(defender, move.group === "bond" ? "calm" : "defense", round);
  let trait = 1;
  if ("traitUsed" in attacker) {
    if (a.trait === "restDamage" && attacker.rested) trait *= 1.08;
    if (!attacker.traitUsed && ((a.trait === "firstTrack" && move.group === "track") || (a.trait === "firstBond" && move.group === "bond") || (a.trait === "firstRush" && move.group === "rush"))) trait *= 1.08;
  }
  if (a.trait === "trackDamage" && move.group === "track") trait *= 1.04;
  if ("traitUsed" in defender && d.trait === "firstShield" && !defender.traitUsed) trait *= .92;
  const defending = "defense" in defender && defender.defense && defender.defense.expires >= round ? defender.defense : undefined;
  const shield = move.breaksDefense && defending ? 1 : ("shield" in defender ? defender.shield?.multiplier ?? 1 : 1) * defenseMultiplier(move,defender,round);
  const exposed = "exposedUntil" in defender && defender.exposedUntil === round ? 1.25 : 1;
  const breakRate = move.breaksDefense && !defending ? .6 : 1;
  const hits = move.mode === "multi" ? move.hits ?? 2 : 1;
  const power = move.power * (1 + .04 * ((attacker.mastery?.[move.id] ?? 1) - 1));
  const levelRate = clamp(1 + .02 * (growthQ(attacker.level) - growthQ(defender.level)),.85,1.15);
  if (shield === 0) return 0;
  return Math.max(1, Math.floor((1.5 * power + .45 * offense) / hits * 40 / (40 + defense) * growthScale(attacker.level) * levelRate * matchup(move.group,d.group,attacker,defender) * trait * shield * exposed * breakRate * roll));
}
export function defenseMultiplier(move: Move, defender: Fighter | Actor, round = 1): number {
  const defense = "defense" in defender ? defender.defense : undefined;
  if (!defense || defense.expires < round || move.breaksDefense) return 1;
  const reduction = defense.kind === "guard" ? .6 : defense.kind === "stance" ? .3
    : defense.kind === "counter" ? (move.contact ? 1 : 0)
    : move.mode === "multi" ? .5 : move.mode === "charge" || move.finisher ? 1 : 0;
  return 1 - reduction * defense.strength;
}
// Damage range is conditional on a hit; hitChance is reported separately.
export function previewDamage(move: Move, attacker: Fighter | Actor, defender: Fighter | Actor, round = 1) {
  const hits = move.mode === "multi" ? move.hits ?? 2 : 1;
  const min = damageAt(move,attacker,defender,.95,round), max = damageAt(move,attacker,defender,1.05,round);
  let followMin = min, followMax = max;
  if (hits > 1) {
    const trait = BREED_BY_ID[attacker.breedId].trait;
    const consumesTrait = (trait === "firstTrack" && move.group === "track") || (trait === "firstBond" && move.group === "bond") || (trait === "firstRush" && move.group === "rush");
    const nextAttacker = "traitUsed" in attacker ? { ...attacker, rested: false, traitUsed: attacker.traitUsed || consumesTrait } : attacker;
    const nextDefender = "traitUsed" in defender ? { ...defender, shield: undefined, traitUsed: defender.traitUsed || BREED_BY_ID[defender.breedId].trait === "firstShield" } : defender;
    followMin = damageAt(move,nextAttacker,nextDefender,.95,round);
    followMax = damageAt(move,nextAttacker,nextDefender,1.05,round);
  }
  return { min: min + followMin * (hits - 1), max: max + followMax * (hits - 1), hitChance: hitChance(move,attacker,defender,round), statusChance: statusChance(move,attacker,defender), multiplier: move.kind === "attack" ? matchup(move.group,BREED_BY_ID[defender.breedId].group,attacker,defender) : 1,
    hits, perHit: { min, max }, preparationRounds: move.mode === "charge" && !("charging" in attacker && attacker.charging === move.id) ? 1 : 0,
    criticalChance: move.kind === "attack" ? critChance(attacker) : 0, criticalMax: Math.floor(max * 1.5) + Math.floor(followMax * 1.5) * (hits - 1), recoil: move.recoil && { ...move.recoil } };
}
export function moveFor(action: Action): Move | undefined {
  return action.kind === "push" ? PUSH : action.kind === "move" ? MOVE_BY_ID[action.moveId] : undefined;
}
export function recoveryLeft(actor: Actor): number {
  return Math.max(0, Math.min(actor.stats.hp - actor.hp, Math.floor(actor.stats.hp * .60) - actor.healed));
}
export function availableActions(state: BattleState, side: Side): Action[] {
  if (state.outcome) return [];
  const actor = state[side];
  if (actor.charging) return [{ kind: "move", moveId: actor.charging, phase: "release" }, ...(side === "player" ? [{ kind: "quit" } as Action] : [])];
  const result: Action[] = [{ kind: "push" }, { kind: "rest" }];
  for (const id of actor.moves) {
    const move = MOVE_BY_ID[id];
    if (move.energy <= actor.energy && !(move.kind === "defense" && actor.statuses.some(s => s.id === "stagger" && s.expires >= state.round)) && (!move.heal || recoveryLeft(actor) > 0)) result.push({ kind: "move", moveId: id, ...(move.mode === "charge" ? { phase: "prepare" as const } : {}) });
  }
  if ((actor.momentum ?? 0) >= 100 && actor.finisher) result.push({ kind: "move", moveId: actor.finisher });
  const items = actor.items ?? (actor.consumable ? [actor.consumable] : []);
  for (const id of new Set(items)) {
    const item = ITEM_BY_ID[id];
    if ((actor.usedItems?.filter(i => i === id).length ?? (actor.itemUsed ? 1 : 0)) >= items.filter(i => i === id).length) continue;
    if (item.heal && !recoveryLeft(actor) || item.energy && actor.energy >= MAX_ENERGY || item.buff && actor.buffs.some(b => b.stat === item.buff && b.expires >= state.round)
      || item.category === "cleanse" && !actor.statuses.length && !actor.exposedUntil
      || item.category === "protect" && actor.shield || item.category === "critical" && actor.guaranteedCritical
      || item.category === "survive" && (actor.survival || actor.survivalUsed)) continue;
    result.push({ kind: "item", itemId: id });
  }
  if (side === "player") result.push({ kind: "quit" });
  return result;
}
export function actionOrder(state: BattleState, playerAction: Action): number {
  const priority = (a: Action) => a.kind === "quit" ? 3 : a.kind === "item" ? 2 : moveFor(a)?.priority ?? 0;
  return priority(playerAction) - priority(state.opponentAction) || effectiveStat(state.player,"speed",state.round) - effectiveStat(state.opponent,"speed",state.round);
}
export function turnOrder(state: BattleState, playerAction: Action): [Side,Side] {
  const order = actionOrder(state,playerAction);
  return order > 0 || order === 0 && random(state.rng).value < .5 ? ["player","opponent"] : ["opponent","player"];
}
export function sameAction(a: Action, b: Action): boolean {
  return a.kind === b.kind && (a.kind !== "move" || b.kind === "move" && a.moveId === b.moveId) && (a.kind !== "item" || b.kind === "item" && a.itemId === b.itemId);
}
