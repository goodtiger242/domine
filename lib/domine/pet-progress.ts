import { SHOP } from "./pet-catalog";
export const MAX_XP = 9280;

export function nextGoal(xp: number, coins: number, owned: readonly string[]) {
  const p = progressOf(xp);
  const item = SHOP.filter((item) => !owned.includes(item.id)).sort((a, b) => a.price! - b.price!)[0];
  if (item) return coins < item.price! ? `${item.name}까지 ${item.price! - coins}코인` : `${item.name}을(를) 살 수 있어요`;
  return p.needed ? `다음 레벨까지 ${p.needed - p.current} XP` : "";
}
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
export function rewardEligible(now: number, lastAny: number | null, daily: number) {
  return daily < 120 && (lastAny === null || now - lastAny >= 3000);
}
export type Reward = { xp: number; coins: number; levelCoins: number; newEntries: string[]; newBadges: string[]; skipped?: "TOO_FAST" | "DAILY_CAP"; retryAfterSeconds?: number };
export function rewardDisplay(reward?: Reward) {
  const coins = (reward?.coins ?? 0) + (reward?.levelCoins ?? 0);
  const notice = reward?.skipped === "TOO_FAST" ? (reward.retryAfterSeconds !== undefined ? `${Math.ceil(reward.retryAfterSeconds)}초 뒤에 코인이 들어와요` : "조금 천천히 눌러 주세요") : reward?.skipped === "DAILY_CAP" ? "오늘 보상 한도를 채웠어요(내일 다시)" : "";
  return { coins, xp: reward?.xp ?? 0, quiet: coins === 0 && !reward?.xp, notice };
}

export function rewardText(reward?: Reward) {
  const r = rewardDisplay(reward);
  return r.notice || [r.coins ? `+${r.coins} 코인` : "", r.xp ? `+${r.xp} XP` : ""].filter(Boolean).join(" · ");
}

/** 한 줄에 맞으면 합치고, 넘치면 각 안내를 읽을 수 있는 길이로 나눈다. */
export function noticePages(parts: string[], fits: (text: string) => boolean) {
  const messages = parts.filter(Boolean);
  if (!messages.length) return [""];
  const combined = messages.join(" · ");
  if (fits(combined)) return [combined];
  return messages.flatMap((message) => {
    const pages: string[] = [];
    let page = "";
    for (const char of message) {
      if (page && !fits(page + char)) { pages.push(page); page = ""; }
      page += char;
    }
    if (page) pages.push(page);
    return pages;
  });
}
