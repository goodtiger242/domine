import { buildFighter } from "./battle/engine";
import { BREED_BY_ID as ENGINE_BREEDS, ITEM_BY_ID, MOVE_BY_ID } from "./battle/data";
import { seedFor } from "./battle/rng";
import { previewDamage, moveFor, REST_ENERGY, matchup } from "./battle/rules";
import { pickSpawns } from "./king/spawn";
import { shortBreedName } from "./breed-short";
import { BREED_BY_ID } from "./king/species";
import { RIVAL_LINES, rivalLine, shouldSpeak, type RivalMoment, type RivalSpecies } from "./pet-rival-lines";
import { BATTLE_MOVE_FX, battleFxId } from "./pet-battle-fx";
import type { Action, AiTier, BattleEvent, BattleState, Move, Outcome, Side, Species, Status } from "./battle/types";

export const encounterSlot = () => Math.floor(Date.now() / 1800000);
export const ENCOUNTER_STORAGE = "domine-pet-encounter-wins";
export function readEncounterWins(storage: Pick<Storage, "getItem">, slot: number): string[] {
  try {
    const saved: unknown = JSON.parse(storage.getItem(ENCOUNTER_STORAGE) ?? "[]");
    return Array.isArray(saved) ? saved.filter((key): key is string => typeof key === "string" && new RegExp(`^${slot}:[A-J](?:[1-9]|10)(?::[A-Za-z0-9_-]+){0,3}$`).test(key)) : [];
  } catch { return []; }
}
export function spawnsFor(cellId: string, careLevel: number, slot = encounterSlot(), wins: readonly string[] = []) {
  if (wins.includes(`${slot}:${cellId}`)) return [];
  const playerLevel = Number.isFinite(careLevel) ? Math.max(1, Math.min(999, Math.floor(careLevel))) : 1;
  // Fixed named residents keep their place when the random quota would exceed three.
  return pickSpawns(cellId, slot, playerLevel).sort((a, b) => Number(b.kind === "named") - Number(a.kind === "named")).slice(0, 3)
    .filter(s => !wins.includes(`${slot}:${cellId}:${s.individual.id}`)).map(spawn => {
      const individual = spawn.individual, breed = BREED_BY_ID[individual.breedId];
      const art = breed.variants.some(v => v.art === individual.appearance.art) ? individual.appearance.art
        : breed.variants[individual.seed % breed.variants.length]?.art ?? individual.appearance.art;
      // shortcut: use the existing size template until the engine exports all king breeds.
      const breedId = ENGINE_BREEDS[breed.id] ? breed.id : { small: "B002", medium: "B003", large: "B001" }[breed.size];
      const species = individual.species === "waterdeer" ? "deer" : individual.species;
      const aiTier: AiTier = ({ 순둥이: "gentle", 보통: "normal", 노련: "veteran", 대장: "boss", 싸움왕: "king" } as const)[individual.intelligence];
      const fighter = buildFighter(breedId, spawn.level, [], {
        species: species as Species, signatureBreedId: breed.id, element: individual.group,
        weakTag: individual.weakness, resistTag: individual.resistance, aiTier,
        condition: individual.condition, owned: !!individual.owner, boss: spawn.kind === "named",
      });
      return { ...spawn, id: `${slot}:${cellId}:${individual.id}`, name: `${shortBreedName(breed.id, breed.name)} ${individual.name}`, given: individual.name, art,
        fighter, npc: individual.owner, difficulty: "normal" as const, levelDifference: spawn.level - playerLevel,
        playerLevel, daySeed: seedFor(String(slot), 0) };
    });
}
export function encounterFor(cellId: string, careLevel: number, slot = encounterSlot(), wins: readonly string[] = []) {
  return spawnsFor(cellId, careLevel, slot, wins)[0] ?? null;
}
export type Encounter = NonNullable<ReturnType<typeof encounterFor>>;
export const encounterChoice = (spawns: readonly Encounter[]) => spawns.length === 0 ? "empty" : spawns.length === 1 ? "confirm" : "list";
export function encounterMatchup(encounter: Encounter, petId: number) {
  const rate = matchup(petId === 1 ? "bond" : "trick", encounter.individual.group);
  return rate > 1 ? "▲ 유리" : rate < 1 ? "▼ 불리" : "";
}
export function encounterLine(encounter: Encounter, moment: string, seed: number, last = "", occasional = false) {
  const individual = encounter.individual;
  const species = (individual.species === "chipmunk" ? "squirrel" : individual.species === "bulbul" ? "sparrow" : individual.species) as RivalSpecies;
  if (!Object.hasOwn(RIVAL_LINES[species] ?? {}, moment)) return "";
  const key = moment as RivalMoment;
  if (occasional && !shouldSpeak(key, seed)) return "";
  const opts = { seed, last, name: individual.name, owner: individual.owner?.name,
    variant: individual.species === "cat" ? individual.owner ? "house" : "stray" : BREED_BY_ID[individual.breedId].size,
    tone: (["polite", "cocky", "grumpy", "shy", "playful"] as const)[individual.seed % 5] };
  return rivalLine(species, key, opts);
}
export function opponentClue(state: BattleState) {
  if (state.opponent.boss || state.aiTier === "boss" || state.aiTier === "king" || state.opponent.aiTier === "boss" || state.opponent.aiTier === "king") return "";
  const move = moveFor(state.opponentAction);
  return move?.mode === "charge" ? "숨을 크게 들이쉰다" : move?.kind === "defense" ? "몸을 낮추고 발을 모은다" : move?.kind === "attack" ? "앞발에 무게를 싣는다" : "호흡을 가다듬는다";
}
export function speciesBadges(encounter: Encounter) {
  const species = encounter.individual.species, size = BREED_BY_ID[encounter.individual.breedId].size;
  if (species === "dog") return size === "small" ? ["크리티컬 높음", "잘 피함", "체력 약함"] : size === "large" ? ["체력 좋음", "상태이상에 강함", "움직임 느림"] : ["기세 빨리 참", "상태이상에 강함", "크리티컬 낮음"];
  return ({ cat: ["크리티컬 높음", "급소 피해 큼", "체력 약함"], pigeon: ["기력 회복 좋음", "기세 빨리 참", "공격 약함"], magpie: ["기세 빨리 참", "방어 약함"], sparrow: ["잘 피함", "민첩함", "체력 약함"], bulbul: ["잘 피함", "민첩함", "체력 약함"], duck: ["상태이상에 강함", "침착함", "움직임 느림"], squirrel: ["민첩함", "크리티컬 높음", "방어 약함"], chipmunk: ["민첩함", "크리티컬 높음", "방어 약함"], raccoon: ["잘 피함", "교란에 능함", "공격 약함"], waterdeer: ["민첩함", "기세 빨리 참", "침착함 부족"], boar: ["공격 강함", "체력 좋음", "움직임 느림"], goblin: ["크리티컬 높음", "체력 약함"], orc: ["체력 좋음", "움직임 느림"], slime: ["상태이상에 강함", "움직임 느림"] })[species];
}
export const HINT_LABEL = { good: "효과 좋음", normal: "평범", weak: "효과 약함" };
export const HINT_ICON = { good: "▲", normal: "", weak: "▼" };
export const GROUP_LABEL: Record<Move["group"], string> = { rush: "돌진", trick: "기교", track: "추적", guard: "수호", bond: "교감", endure: "지구", neutral: "중립" };
export const TAG_LABEL = { contact: "접촉", sound: "소리", scent: "냄새", trick: "속임", multi: "연속", charge: "충전", gaze: "시선" };
export const MOVE_KIND = {
  attack: { label: "공격", icon: "⚔", order: 0 },
  defense: { label: "방어", icon: "🛡", order: 1 },
  support: { label: "보조", icon: "✨", order: 2 },
};
export function moveEffect(move: Move, state: BattleState) {
  if (move.kind === "attack") {
    const damage = previewDamage(move, state.player, state.opponent, state.round);
    const extra = move.status ? ` · ${Math.round(damage.statusChance)}% ${STATUS_LABEL[move.status].split(" ")[1]}` : move.buff ? ` · ${STAT_LABEL[move.buff]}↑` : "";
    return `상대에게 피해 약 ${damage.min}~${damage.max}${extra}`;
  }
  if (move.kind === "defense") return { guard: "받는 피해 −60% · 기력 +1", counter: "몸싸움 공격이면 피해 0 + 되받아치기", evade: "큰 기술(충전·결정기) 완전 회피 · 상대 기력 −2", stance: "2라운드 피해 −30% · 상태이상 막음" }[move.defense ?? "guard"];
  return move.heal ? `체력 ${Math.round(move.heal * 100)}% 회복` : `${move.buff ? STAT_LABEL[move.buff] : "집중"}이 올라가요`;
}
export function hpColor(hp: number, max: number) {
  const ratio = max > 0 ? hp / max : 0;
  return ratio <= .2 ? "red" : ratio <= .5 ? "yellow" : "green";
}
export const STATUS_LABEL: Record<Status, string> = {
  stagger: "💫 비틀거림", blur: "🌫️ 시야 흐림", slow: "🐢 느려짐",
  tense: "😬 긴장", winded: "💨 숨참", open: "🫧 빈틈",
};
export const STAT_LABEL = { hp: "체력", attack: "공격력", defense: "방어력", speed: "민첩", focus: "집중", calm: "침착" };
export const MOVE_PAGE_SIZE = 3;
export type MoveFilter = "all" | Move["kind"];
export const costBadge = (cost: number) => `⚡${cost}`;
export const actionCost = (action: Action, state: BattleState) => moveFor(action)?.finisher || action.kind === "move" && state.player.charging === action.moveId ? 0 : moveFor(action)?.energy ?? 0;
export function movePages(actions: readonly Action[], filter: MoveFilter) {
  const filtered = actions.filter(action => filter === "all" || (action.kind === "rest" ? "support" : moveFor(action)?.kind) === filter);
  return Array.from({ length: Math.max(1, Math.ceil(filtered.length / MOVE_PAGE_SIZE)) }, (_, i) => filtered.slice(i * MOVE_PAGE_SIZE, (i + 1) * MOVE_PAGE_SIZE));
}
export function compactEffect(move: Move, state: BattleState) {
  if (move.kind === "attack") { const d = moveDamage(move, state); return `피해 ${d.base}${d.delta ? ` ${d.delta > 0 ? "↑+" : "↓−"}${Math.abs(d.delta)}` : ""}`; }
  if (move.kind === "defense") return { guard: "피해 −60% · 기력 +1", counter: "접촉 피해 0 · 되받아치기", evade: "큰 기술 회피 · 상대 기력 −2", stance: "2턴 피해 −30% · 상태이상 막음" }[move.defense ?? "guard"];
  return move.heal ? `회복 ${Math.round(move.heal * 100)}%` : `${move.buff ? STAT_LABEL[move.buff] : "집중"}↑`;
}
export function moveDamage(move: Move, state: BattleState) {
  const clean = (actor: BattleState["player"]) => ({ ...actor, stats: actor.baseStats ?? actor.stats, condition: undefined, buffs: [], statuses: [], shield: undefined, defense: undefined, recoil: undefined, exposedUntil: undefined, weakTag: undefined, resistTag: undefined });
  const player = clean(state.player), opponent = clean(state.opponent);
  player.element = move.group === "rush" ? "bond" : "rush";
  if (move.group !== "neutral") opponent.element = move.group;
  const baseline = previewDamage(move, player, opponent, state.round);
  const actual = previewDamage(move, { ...state.player, weakTag: undefined, resistTag: undefined }, { ...state.opponent, weakTag: undefined, resistTag: undefined }, state.round);
  const base = Math.round((baseline.min + baseline.max) / 2);
  return { base, delta: Math.round((actual.min + actual.max) / 2) - base };
}
export function moveDetail(action: Action, state: BattleState) {
  if (action.kind === "rest") return `숨 고르기 · 기력 +${REST_ENERGY}`;
  const move = moveFor(action)!;
  const d = previewDamage(move, state.player, state.opponent, state.round);
  return [move.name, `${GROUP_LABEL[move.group]} · ${MOVE_KIND[move.kind].label} · 기력 ${actionCost(action, state)}`, moveEffect(move, state),
    BATTLE_MOVE_FX[move.id]?.suffix, `명중 ${d.hitChance}%`, move.kind === "attack" ? `예상 피해 ${d.min}~${d.max} (명중 시) · 상성 ×${d.multiplier} · 크리티컬 ${Math.round(d.criticalChance)}%` : "",
    move.defense ? { guard: "연속 방어는 효과 감소", counter: "접촉 공격에 반격, 상대가 공격하지 않으면 빈틈", evade: "충전·결정기를 흘려 상대 기력 감소, 연속 공격에는 약함", stance: "다음 라운드까지 방어 자세 유지" }[move.defense] : "",
    move.mode === "charge" ? state.player.charging === move.id ? "충전 완료" : "한 라운드 충전 후 공격" : move.mode === "multi" ? `${move.hits}회 연속 공격` : "",
    move.recoil?.energy ? `반동 기력 −${move.recoil.energy}` : "", move.recoil?.stat ? `반동 ${STAT_LABEL[move.recoil.stat]} −${Math.round((move.recoil.rate ?? 0) * 100)}%` : "",
    move.breaksDefense ? "방어 무너뜨리기" : "", move.finisher ? `결정기 · 기세 ${state.player.momentum ?? 0}/100` : ""].filter(Boolean).join(" · ");
}
export function actionLabel(action: Action) {
  if (action.kind === "move") return MOVE_BY_ID[action.moveId].name;
  if (action.kind === "item") return ITEM_BY_ID[action.itemId].name;
  return { push: "가볍게 밀기", rest: "숨 고르기", quit: "인사하고 마치기" }[action.kind];
}

// Only presentation values change during playback; the engine's next state is committed at the end.
export function showBattleEvent(state: BattleState, event: BattleEvent, resolved?: BattleState): BattleState {
  if (event.type === "damage") return { ...state, [event.target]: { ...state[event.target], hp: event.hp } };
  if (!("side" in event)) return state;
  const actor = { ...state[event.side] };
  if (event.type === "energy") actor.energy = event.energy;
  if (event.type === "momentum") actor.momentum = event.momentum;
  if (event.type === "reveal") {
    if (event.affinity === "weak") actor.knownWeakTag = true;
    else actor.knownResistTag = true;
  }
  if (event.type === "heal") actor.hp = event.hp;
  if (event.type === "status" && event.change !== "blocked") {
    actor.statuses = actor.statuses.filter(s => s.id !== event.status);
    if (event.change === "applied") actor.statuses.push({ id: event.status, applied: event.round, expires: event.round + 1 });
  }
  if (event.type === "buff") {
    actor.buffs = actor.buffs.filter(b => b.stat !== event.stat);
    if (event.change === "applied") actor.buffs.push({ ...(resolved?.[event.side].buffs.find(b => b.stat === event.stat) ?? { stat: event.stat, expires: event.round + 1 }) });
  }
  if (event.type === "shield") actor.shield = event.change === "applied" ? { multiplier: event.multiplier, expires: event.round + 1 } : undefined;
  return { ...state, [event.side]: actor };
}

export type BattleCue = {
  text?: string; duration?: number; event?: BattleEvent;
  moveName?: string; result?: string; rivalMoment?: string; rivalText?: string; cutin?: boolean;
  motion?: "intro" | "skill" | "hit" | "weak-hit" | "heal" | "effective" | "finish";
  moveFx?: string; target?: Side; missed?: boolean;
  seenMove?: string; critical?: boolean;
  fx?: "hit" | "hit-good" | "heal" | "buff" | "debuff" | "dizzy" | "sleepy" | "shield";
  side?: Side; amount?: number; outcome?: Outcome;
};

// Unknown engine IDs retain the existing fallback until their move data is available.
export const battleEffectId = (id: string) => BATTLE_MOVE_FX[id] ? id : "push";

export function rivalCues(cues: BattleCue[], encounter: Encounter, next: BattleState, last: string) {
  if (next.outcome === "quit") return { cues, last };
  const candidates = cues.map((cue, index) => ({ moment: cue.rivalMoment, index }));
  if (next.opponent.hp > 0 && next.opponent.hp <= next.opponent.stats.hp * .25) candidates.unshift({ moment: "low", index: Math.max(0, cues.length - 2) });
  candidates.sort((a, b) => Number(["crit_deal", "crit_take", "finisher", "low"].includes(b.moment ?? "")) - Number(["crit_deal", "crit_take", "finisher", "low"].includes(a.moment ?? "")));
  candidates.push({ moment: "round", index: Math.max(0, cues.length - 2) });
  for (const { moment, index } of candidates) {
    if (!moment) continue;
    const line = encounterLine(encounter, moment, seedFor(`${next.round}:${moment}`, encounter.individual.seed), last, true);
    if (line) return { cues: [...cues.slice(0, index + 1), { rivalText: line, duration: 1600 }, ...cues.slice(index + 1)], last: line };
  }
  return { cues, last };
}

// The engine emits effectiveness before damage; only the presentation order changes.
export function battleCues(events: readonly BattleEvent[], names: Record<Side, string>): BattleCue[] {
  const cues: BattleCue[] = [];
  let effectiveness: Extract<BattleEvent, { type: "effectiveness" }> | undefined;
  for (const event of events) {
    switch (event.type) {
      case "action": {
        const rawId = battleFxId(event.action), id = rawId ? battleEffectId(rawId) : undefined, fx = id ? BATTLE_MOVE_FX[id] : undefined;
        const move = moveFor(event.action);
        cues.push({ moveName: event.action.kind === "quit" ? undefined : actionLabel(event.action), side: event.side, seenMove: rawId, duration: event.action.kind === "quit" ? 0 : 1200,
          rivalMoment: event.side === "opponent" ? move?.finisher ? "finisher" : move?.kind === "defense" ? "defend" : move?.kind === "attack" ? "attack" : "round" : undefined });
        if (fx && (event.action.kind === "rest" || event.action.kind === "move" && (MOVE_BY_ID[event.action.moveId].kind !== "attack" || MOVE_BY_ID[event.action.moveId].mode === "charge" && event.action.phase !== "release"))) {
          cues.push({ motion: "skill", moveFx: id, side: event.side, duration: fx.duration });
        }
        break;
      }
      case "hit": case "miss": {
        const id = battleEffectId(event.moveId);
        cues.push({ motion: "skill", moveFx: id, side: event.side, target: event.target, missed: event.type === "miss", duration: BATTLE_MOVE_FX[id].duration });
        if (event.type === "miss") cues.push({ result: "빗나갔다!", duration: 1200, rivalMoment: event.side === "opponent" ? "miss" : undefined });
        break;
      }
      case "effectiveness": effectiveness = event; break;
      case "damage":
        cues.push({ motion: effectiveness?.hint === "weak" ? "weak-hit" : "hit", fx: event.critical || effectiveness?.hint === "good" ? "hit-good" : "hit", side: event.target, amount: event.amount, critical: event.critical, duration: 500,
          rivalMoment: event.critical ? event.side === "opponent" ? "crit_deal" : "crit_take" : event.target === "opponent" ? "hit" : undefined });
        cues.push({ event, duration: 900 });
        if (event.critical) cues.push({ result: "크리티컬!", duration: 1200 });
        if (effectiveness) {
          if (effectiveness.hint !== "normal") cues.push({ result: effectiveness.hint === "good" ? "효과가 컸다!" : "효과가 미미했다…", motion: effectiveness.hint === "good" ? "effective" : undefined, duration: 1200, rivalMoment: event.side === "opponent" ? effectiveness.hint === "good" ? "effective" : "ineffective" : undefined });
          effectiveness = undefined;
        }
        break;
      case "energy":
        cues.push({ event, duration: event.amount > 0 ? 300 : 0 });
        if (event.reason === "trait" && event.amount === 1) cues.push({ result: "막아 냈다! 기력 +1", duration: 1200, rivalMoment: event.side === "opponent" ? "defend" : undefined });
        break;
      case "reveal": cues.push({ event, result: event.affinity === "weak" ? "유독 잘 통했다!" : "잘 버텨 낸다…", duration: 1200 }); break;
      case "counter": cues.push({ result: "되받아쳤다!", duration: 1200, rivalMoment: event.side === "opponent" ? "defend" : undefined }); break;
      case "evade": cues.push({ result: "큰 기술을 흘려 냈다! 상대 기력 −2", duration: 1200, rivalMoment: event.side === "opponent" ? "defend" : undefined }); break;
      case "momentum": cues.push({ event, duration: 300, rivalMoment: event.side === "opponent" && event.amount > 0 ? "momentum" : undefined }); break;
      case "finisher": cues.push({ side: event.side, cutin: true, duration: 1200, rivalMoment: event.side === "opponent" ? "finisher" : undefined }); break;
      case "heal": cues.push({ event, motion: "heal", fx: "heal", side: event.side, amount: event.amount, duration: 900 }); break;
      case "status": cues.push({ event, side: event.side, fx: event.change === "blocked" ? "shield" : event.change === "removed" ? undefined : event.status === "stagger" || event.status === "blur" ? "dizzy" : event.status === "slow" || event.status === "winded" ? "sleepy" : "debuff", duration: 500 }); if (event.status === "open" && event.change === "applied") cues.push({ result: "빈틈을 보였다…", duration: 1200 }); break;
      case "buff": cues.push({ event, side: event.side, fx: event.change === "applied" ? "buff" : "debuff", duration: 500 }); break;
      case "shield": cues.push({ event, side: event.side, fx: event.change === "applied" ? "shield" : undefined, duration: 500 }); break;
      case "end": cues.push({ motion: "finish", outcome: event.outcome, duration: 600 }); break;
    }
  }
  return cues;
}
