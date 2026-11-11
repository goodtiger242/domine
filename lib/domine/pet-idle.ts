import type { TapNeeds } from "./pet-tap";

export function routinePeriod(hour: number) {
  if (hour >= 22 || hour < 6) return "night";
  if (hour < 10) return "morning";
  if (hour >= 12 && hour < 15) return "noon";
  if (hour >= 15 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "day";
}
export type IdleGoal = "food" | "clean" | "company" | "play" | "rest";
export type IdleAction = "food" | "scratch" | "shake" | "company" | "hop" | "roll" | "wag" | "tilt" | "stretch" | "yawn" | "nap" | "snack" | "fetch" | "sleepwalk" | "dream";
export function chooseNeedGoal(needs: TapNeeds, recent: readonly IdleGoal[], noise: readonly number[]): IdleGoal {
  const scores: Record<IdleGoal, number> = {
    food: (100 - needs.fullness) * 1.1, clean: 100 - needs.clean,
    company: 100 - needs.mood, play: 35, rest: 24,
  };
  const goals = Object.keys(scores) as IdleGoal[];
  const blocked = recent.length >= 2 && recent.at(-1) === recent.at(-2) ? recent.at(-1) : null;
  return goals.filter((goal) => goal !== blocked).reduce((best, goal) =>
    scores[goal] + (noise[goals.indexOf(goal)] ?? 0) * 5 > scores[best] + (noise[goals.indexOf(best)] ?? 0) * 5 ? goal : best);
}
export function idleWeights(hour: number, goal: IdleGoal): Partial<Record<IdleAction, number>> {
  if (goal === "food") return { food: 4, snack: routinePeriod(hour) === "afternoon" ? 8 : 1 };
  if (goal === "clean") return { scratch: 1, shake: 1 };
  if (goal === "company") return { company: 1 };
  const weights: Partial<Record<IdleAction, number>> = goal === "play" ? { hop: 3, roll: 3, wag: 1, tilt: 1 } : { wag: 2, tilt: 2, yawn: 1 };
  const routines: Record<ReturnType<typeof routinePeriod>, Partial<Record<IdleAction, number>>> = {
    morning: { stretch: 6, yawn: 6 }, noon: { nap: 12 }, afternoon: { snack: 12 },
    evening: { fetch: 12 }, night: { sleepwalk: 6, dream: 6 }, day: {},
  };
  return { ...weights, ...routines[routinePeriod(hour)] };
}
export function chooseIdleAction(hour: number, goal: IdleGoal, roll: number): IdleAction {
  const entries = Object.entries(idleWeights(hour, goal)) as [IdleAction, number][];
  let remaining = roll * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [action, weight] of entries) { remaining -= weight; if (remaining < 0) return action; }
  return entries[entries.length - 1][0];
}
