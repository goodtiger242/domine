export const MAX_XP = 9280;
export const levelXP = (level: number) => 10 * (level - 1) * (level + 2);
export function levelOf(xp: number) {
  return Math.min(30, Math.max(1, Math.floor((Math.sqrt(9 + Math.max(0, xp) * 0.4) - 1) / 2)));
}
export function progressOf(xp: number) {
  const value = Math.min(MAX_XP, Math.max(0, xp));
  const level = levelOf(value);
  return { level, value, current: value - levelXP(level), needed: level === 30 ? 0 : 20 * level + 20 };
}
export const ACTION_REWARDS = {
  feed: [8, 4], treat: [6, 3], pet: [5, 2], play: [10, 5],
  walk: [10, 6], brush: [8, 4], bath: [10, 5], train: [10, 5],
} as const;
export function rewardEligible(now: number, lastAction: number | null, lastAny: number | null, daily: number) {
  return daily < 40 && (lastAction === null || now - lastAction >= 60000) && (lastAny === null || now - lastAny >= 10000);
}
export type Reward = { xp: number; coins: number; levelCoins: number; newEntries: string[]; newBadges: string[] };
export function rewardDisplay(reward?: Reward) {
  const coins = (reward?.coins ?? 0) + (reward?.levelCoins ?? 0);
  return { coins, xp: reward?.xp ?? 0, quiet: coins === 0 && !reward?.xp };
}
