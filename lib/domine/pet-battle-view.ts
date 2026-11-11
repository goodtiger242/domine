import { buildFighter, opponentFor } from "./battle/engine";
import { ITEM_BY_ID, MOVE_BY_ID } from "./battle/data";
import { random, seedFor } from "./battle/rng";
import { previewDamage, moveFor, REST_ENERGY } from "./battle/rules";
import { BATTLE_MOVE_FX, battleFxId } from "./pet-battle-fx";
import type { Action, BattleEvent, BattleState, Move, Outcome, Side, Status } from "./battle/types";

export const encounterSlot = () => Math.floor(Date.now() / 1800000);
export const ENCOUNTER_STORAGE = "domine-pet-encounter-wins";
export function readEncounterWins(storage: Pick<Storage, "getItem">, slot: number): string[] {
  try {
    const saved: unknown = JSON.parse(storage.getItem(ENCOUNTER_STORAGE) ?? "[]");
    return Array.isArray(saved) ? saved.filter((key): key is string => typeof key === "string" && new RegExp(`^${slot}:[A-J](?:[1-9]|10)$`).test(key)) : [];
  } catch { return []; }
}
export function encounterFor(cellId: string, careLevel: number, slot = encounterSlot(), wins: readonly string[] = []) {
  if (cellId === "E5" || cellId === "D5" || wins.includes(`${slot}:${cellId}`)) return null;
  const daySeed = seedFor(String(slot), 0), cellSeed = seedFor(cellId, daySeed);
  if (random(seedFor("presence", cellSeed)).value >= .3) return null;
  const playerLevel = Number.isFinite(careLevel) ? Math.max(1, Math.min(30, Math.floor(careLevel))) : 1;
  const opponent = opponentFor(cellId, daySeed, playerLevel);
  const level = Math.max(1, Math.min(30, opponent.fighter.level + Math.floor(random(seedFor("level", cellSeed)).value * 5) - 2));
  const fighter = buildFighter(opponent.fighter.breedId, level, opponent.fighter.equipment, { consumable: opponent.fighter.consumable });
  return { ...opponent, fighter, levelDifference: level - playerLevel, daySeed, playerLevel, slot };
}
export type Encounter = NonNullable<ReturnType<typeof encounterFor>>;
export const HINT_LABEL = { good: "좋아요", normal: "평범", weak: "잘 안 통해요" };
export const HINT_ICON = { good: "▲", normal: "", weak: "▼" };
export const GROUP_LABEL: Record<Move["group"], string> = { rush: "돌진", trick: "기교", track: "추적", guard: "수호", bond: "교감", endure: "지구", neutral: "중립" };
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
  if (move.kind === "defense") return `이번 라운드 받는 피해를 줄여요${move.buff ? ` · ${STAT_LABEL[move.buff]}↑` : ""}`;
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
export const MOVE_PAGE_SIZE = 6;
export type MoveFilter = "all" | Move["kind"];
export const costBadge = (cost: number) => `⚡${cost}`;
export const actionCost = (action: Action, state: BattleState) => action.kind === "move" && state.player.charging === action.moveId ? 0 : moveFor(action)?.energy ?? 0;
export function movePages(actions: readonly Action[], filter: MoveFilter) {
  const filtered = actions.filter(action => filter === "all" || (action.kind === "rest" ? "support" : moveFor(action)?.kind) === filter);
  return Array.from({ length: Math.max(1, Math.ceil(filtered.length / MOVE_PAGE_SIZE)) }, (_, i) => filtered.slice(i * MOVE_PAGE_SIZE, (i + 1) * MOVE_PAGE_SIZE));
}
export function compactEffect(move: Move, state: BattleState) {
  if (move.kind === "attack") { const d = previewDamage(move, state.player, state.opponent, state.round); return `피해 ${d.min}~${d.max}`; }
  if (move.kind === "defense") return move.defense === "evade" ? "회피↑" : move.defense === "counter" ? "피해 감소·반격" : "피해 감소";
  return move.heal ? `회복 ${Math.round(move.heal * 100)}%` : `${move.buff ? STAT_LABEL[move.buff] : "집중"}↑`;
}
export function moveDetail(action: Action, state: BattleState) {
  if (action.kind === "rest") return `숨 고르기 · 기력 +${REST_ENERGY}`;
  const move = moveFor(action)!;
  const d = previewDamage(move, state.player, state.opponent, state.round);
  return [move.name, `${GROUP_LABEL[move.group]} · ${MOVE_KIND[move.kind].label} · 기력 ${actionCost(action, state)}`, moveEffect(move, state),
    BATTLE_MOVE_FX[move.id]?.suffix, `명중 ${d.hitChance}%`, move.kind === "attack" ? `예상 피해 ${d.min}~${d.max} (명중 시) · 상성 ×${d.multiplier}` : "",
    move.defense ? { guard: "받아내면 기력 회복", counter: "접촉 공격에 반격, 상대가 공격하지 않으면 빈틈", evade: "충전·연속·결정기를 흘려 상대 기력 감소", stance: "다음 라운드까지 방어 자세 유지" }[move.defense] : "",
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
  motion?: "intro" | "skill" | "hit" | "weak-hit" | "heal" | "effective" | "finish";
  moveFx?: string; target?: Side; missed?: boolean;
  seenMove?: string; critical?: boolean;
  fx?: "hit" | "hit-good" | "heal" | "buff" | "debuff" | "dizzy" | "sleepy" | "shield";
  side?: Side; amount?: number; outcome?: Outcome;
};

// Unknown engine IDs retain the existing fallback until their move data is available.
export const battleEffectId = (id: string) => BATTLE_MOVE_FX[id] ? id : "push";

// The engine emits effectiveness before damage; only the presentation order changes.
export function battleCues(events: readonly BattleEvent[], names: Record<Side, string>): BattleCue[] {
  const cues: BattleCue[] = [];
  let effectiveness: Extract<BattleEvent, { type: "effectiveness" }> | undefined;
  for (const event of events) {
    const who = "side" in event ? names[event.side] : "";
    switch (event.type) {
      case "action": {
        const rawId = battleFxId(event.action), id = rawId ? battleEffectId(rawId) : undefined, fx = id ? BATTLE_MOVE_FX[id] : undefined;
        cues.push({ text: event.action.kind === "quit" ? `${who}, 인사해요.` : `${who}의 ${actionLabel(event.action)}!`, side: event.side, seenMove: rawId });
        if (fx && (event.action.kind === "rest" || event.action.kind === "move" && (MOVE_BY_ID[event.action.moveId].kind !== "attack" || MOVE_BY_ID[event.action.moveId].mode === "charge" && event.action.phase !== "release"))) {
          cues.push({ motion: "skill", moveFx: id, side: event.side, duration: fx.duration });
        }
        break;
      }
      case "hit": case "miss": {
        const id = battleEffectId(event.moveId);
        cues.push({ motion: "skill", moveFx: id, side: event.side, target: event.target, missed: event.type === "miss", duration: BATTLE_MOVE_FX[id].duration });
        if (event.type === "miss") cues.push({ text: `${names[event.target]}, 가볍게 피했어요!` });
        break;
      }
      case "effectiveness": effectiveness = event; break;
      case "damage":
        cues.push({ motion: effectiveness?.hint === "weak" ? "weak-hit" : "hit", fx: effectiveness?.hint === "good" ? "hit-good" : "hit", side: event.target, amount: event.amount, critical: event.critical, duration: 500 });
        cues.push({ event, duration: 900 });
        if (effectiveness) {
          if (effectiveness.hint !== "normal") cues.push({ text: effectiveness.hint === "good" ? "효과가 좋아요!" : "잘 안 통해요…", motion: effectiveness.hint === "good" ? "effective" : undefined });
          effectiveness = undefined;
        }
        break;
      case "energy":
        cues.push({ event, duration: event.amount > 0 ? 300 : 0 });
        break;
      case "heal": cues.push({ event, motion: "heal", fx: "heal", side: event.side, amount: event.amount, duration: 900 }); break;
      case "status": cues.push({ event, side: event.side, fx: event.change === "blocked" ? "shield" : event.change === "removed" ? undefined : event.status === "stagger" || event.status === "blur" ? "dizzy" : event.status === "slow" || event.status === "winded" ? "sleepy" : "debuff", duration: 500 }); break;
      case "buff": cues.push({ event, side: event.side, fx: event.change === "applied" ? "buff" : "debuff", duration: 500 }); break;
      case "shield": cues.push({ event, side: event.side, fx: event.change === "applied" ? "shield" : undefined, duration: 500 }); break;
      case "end": cues.push({ motion: "finish", outcome: event.outcome, duration: 600 }); break;
    }
  }
  return cues;
}
