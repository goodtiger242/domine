import { getTodayISO } from "../date/local";
import { opponentFor } from "./battle/engine";
import { ITEM_BY_ID, MOVE_BY_ID } from "./battle/data";
import { seedFor } from "./battle/rng";
import type { Action, BattleEvent, BattleState, Move, Outcome, Side, Status } from "./battle/types";

export function encounterFor(cellId: string, careLevel: number, day = getTodayISO()) {
  if (cellId === "E5" || cellId === "D5") return null;
  const playerLevel = Number.isFinite(careLevel) ? Math.max(1, Math.min(30, Math.floor(careLevel))) : 1;
  const daySeed = seedFor(day, 0);
  return { ...opponentFor(cellId, daySeed, playerLevel), daySeed, playerLevel };
}
export type Encounter = NonNullable<ReturnType<typeof encounterFor>>;
export const HINT_LABEL = { good: "좋아요", normal: "평범", weak: "잘 안 통해요" };
export const HINT_ICON = { good: "▲", normal: "■", weak: "▼" };
export const GROUP_LABEL: Record<Move["group"], string> = { rush: "돌진", trick: "기교", track: "추적", guard: "수호", bond: "교감", endure: "지구", neutral: "중립" };
export function hpColor(hp: number, max: number) {
  const ratio = max > 0 ? hp / max : 0;
  return ratio <= .2 ? "red" : ratio <= .5 ? "yellow" : "green";
}
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

export type BattleCue = {
  text?: string; duration?: number; event?: BattleEvent;
  motion?: "intro" | "attack" | "hit" | "heal" | "effective" | "finish";
  side?: Side; amount?: number; outcome?: Outcome;
};

// The engine emits effectiveness before damage; only the presentation order changes.
export function battleCues(events: readonly BattleEvent[], names: Record<Side, string>): BattleCue[] {
  const cues: BattleCue[] = [];
  let effectiveness: Extract<BattleEvent, { type: "effectiveness" }> | undefined;
  for (const event of events) {
    const who = "side" in event ? names[event.side] : "";
    switch (event.type) {
      case "action":
        cues.push({ text: event.action.kind === "rest" ? `${who}, 잠깐 숨을 골라요.` : event.action.kind === "quit" ? `${who}, 친구에게 인사하고 돌아가요.` : `${who}의 ${actionLabel(event.action)}!` });
        break;
      case "hit": case "miss":
        cues.push({ motion: "attack", side: event.side, duration: 450 });
        if (event.type === "miss") cues.push({ text: `${names[event.target]}, 가볍게 피했어요!` });
        break;
      case "effectiveness": effectiveness = event; break;
      case "damage":
        cues.push({ motion: "hit", side: event.target, amount: event.amount, duration: 450 });
        cues.push({ event, duration: 900 });
        if (effectiveness) {
          if (effectiveness.hint !== "normal") cues.push({ text: effectiveness.hint === "good" ? "효과가 좋아요!" : "잘 안 통해요…", motion: effectiveness.hint === "good" ? "effective" : undefined });
          effectiveness = undefined;
        }
        break;
      case "energy":
        if (event.amount > 0) {
          if (event.reason !== "round") cues.push({ text: `${who}, 기력이 돌아와요!` });
          for (let energy = event.energy - event.amount + 1; energy <= event.energy; energy++) cues.push({ event: { ...event, energy, amount: 1 }, duration: 140 });
        } else cues.push({ event, duration: 0 });
        break;
      case "heal": cues.push({ event, motion: "heal", side: event.side, amount: event.amount, text: `${who}, 버틸 힘을 ${event.amount} 되찾았어요!` }); break;
      case "status": cues.push({ event, text: `${who} · ${STATUS_LABEL[event.status]}${event.change === "applied" ? " 상태가 됐어요." : event.change === "blocked" ? " 상태를 막았어요!" : " 상태가 풀렸어요."}` }); break;
      case "buff": cues.push({ event, text: `${who}의 ${STAT_LABEL[event.stat]}${event.change === "applied" ? " 능력이 올랐어요!" : " 능력이 원래대로 돌아왔어요."}` }); break;
      case "shield": cues.push({ event, text: event.change === "applied" ? `${who}, 단단히 버틸 준비를 해요!` : `${who}, 방어 자세를 풀어요.` }); break;
      case "end": cues.push({ motion: "finish", outcome: event.outcome, text: event.outcome === "quit" ? "다음에 또 함께 놀아요!" : event.outcome === "draw" ? "둘 다 끝까지 버텼어요. 멋진 무승부!" : `${names[event.outcome === "player" ? "opponent" : "player"]}, 지쳐서 앉아 버렸어요…` }); break;
    }
  }
  return cues;
}
