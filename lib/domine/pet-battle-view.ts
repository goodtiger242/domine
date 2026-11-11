import { getTodayISO } from "../date/local";
import { opponentFor } from "./battle/engine";
import { ITEM_BY_ID, MOVE_BY_ID } from "./battle/data";
import { seedFor } from "./battle/rng";
import type { Action, BattleEvent, BattleState, Status } from "./battle/types";

export function encounterFor(cellId: string, careLevel: number, day = getTodayISO()) {
  if (cellId === "E5" || cellId === "D5") return null;
  const playerLevel = Number.isFinite(careLevel) ? Math.max(1, Math.min(30, Math.floor(careLevel))) : 1;
  const daySeed = seedFor(day, 0);
  return { ...opponentFor(cellId, daySeed, playerLevel), daySeed, playerLevel };
}
export type Encounter = NonNullable<ReturnType<typeof encounterFor>>;
export const HINT_LABEL = { good: "좋아요", normal: "평범", weak: "잘 안 통해요" };
export const STATUS_LABEL: Record<Status, string> = {
  stagger: "💫 비틀거림", blur: "🌫️ 시야 흐림", slow: "🐢 느려짐",
  tense: "😬 긴장", winded: "💨 숨참", open: "🫧 빈틈",
};
export const STAT_LABEL = { attack: "밀기", defense: "버티기", speed: "빠르기", focus: "집중", calm: "침착" };
export function actionLabel(action: Action) {
  if (action.kind === "move") return MOVE_BY_ID[action.moveId].name;
  if (action.kind === "item") return ITEM_BY_ID[action.itemId].name;
  return { push: "가볍게 밀기", rest: "숨 고르기", quit: "인사하고 마치기" }[action.kind];
}

// Only presentation values change during playback; the engine's next state is committed at the end.
export function showBattleEvent(state: BattleState, event: BattleEvent): BattleState {
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
    if (event.change === "applied") actor.buffs.push({ stat: event.stat, expires: event.round + 1 });
  }
  if (event.type === "shield") actor.shield = event.change === "applied" ? { multiplier: event.multiplier, expires: event.round + 1 } : undefined;
  return { ...state, [event.side]: actor };
}
