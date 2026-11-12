import { moveFor, previewDamage } from "./battle/rules";
import type { Fighter } from "./battle/types";

/** 쉬움 · 보통 · 조금 어려움 · 어려움. 색은 화면에서 정하고, 여기서는 단계만 정한다. */
export type Difficulty = "easy" | "normal" | "hard" | "deadly";
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "쉬움", normal: "보통", hard: "조금 어려움", deadly: "어려움" };
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard", "deadly"];

/** Expected damage per round of an attacker's three strongest attacks (energy limits what a fighter can chain). */
function output(attacker: Fighter, defender: Fighter): number {
  const hits = attacker.moves.map(id => moveFor({ kind: "move", moveId: id })).filter(move => move?.kind === "attack")
    .map(move => { const p = previewDamage(move!, attacker, defender); return (p.min + p.max) / 2 * p.hitChance / 100 / (1 + p.preparationRounds); })
    .sort((a, b) => b - a).slice(0, 3);
  return hits.length ? hits.reduce((sum, value) => sum + value, 0) / hits.length : 0;
}
/** How many times faster I take the foe down than it takes me down; level, stats, condition, element and size all feed in. */
export function powerRatio(me: Fighter, foe: Fighter): number {
  const mine = output(me, foe) / Math.max(1, foe.stats.hp), theirs = output(foe, me) / Math.max(1, me.stats.hp);
  return mine / Math.max(theirs, 1e-6);
}
// Cut points measured against simulated fights (scripts/pet-difficulty-report.mjs): about 95% / 70% / 30% win chance.
export const DIFFICULTY_CUTS = { easy: 1.2, normal: .75, hard: .5 } as const;
export function foeDifficulty(me: Fighter, foe: Fighter): Difficulty {
  const ratio = powerRatio(me, foe);
  return ratio >= DIFFICULTY_CUTS.easy ? "easy" : ratio >= DIFFICULTY_CUTS.normal ? "normal" : ratio >= DIFFICULTY_CUTS.hard ? "hard" : "deadly";
}
