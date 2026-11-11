export type Reward = { xp: number; coins: number; levelCoins: number; newEntries: string[]; newBadges: string[]; skipped?: "TOO_FAST" | "DAILY_CAP"; retryAfterSeconds?: number };
export function rewardDisplay(reward?: Reward) {
  const coins = (reward?.coins ?? 0) + (reward?.levelCoins ?? 0);
  const notice = reward?.skipped === "TOO_FAST" ? "조금 천천히 눌러 주세요" : "";
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
