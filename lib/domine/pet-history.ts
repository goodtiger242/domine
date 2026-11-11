import { CATALOG } from "./pet-catalog";
import { PETS } from "./pet-photos";
import type { PetHistoryEntry } from "./pet-rpc";

const ACTIONS: Record<string, string> = { feed: "밥", treat: "간식", pet: "쓰다듬기", play: "놀이", walk: "산책", brush: "빗질", bath: "목욕", train: "훈련" };
const SESSION = 60 * 60 * 1000;
export type HistoryRow = PetHistoryEntry & { count: number; oldest: number; actions?: Record<string, number> };

/** 돌봄(행동)은 같은 사람·같은 강아지면 종류와 상관없이 1시간 안을 한 줄로 묶고, 레벨업·구매·착용·새 도감은 따로 둔다. */
export function groupHistory(entries: readonly PetHistoryEntry[], limit = 10) {
  const groups: HistoryRow[] = [];
  const open = new Map<string, HistoryRow>();
  for (const row of [...entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))) {
    const time = Date.parse(row.at);
    if (row.kind !== "action") { groups.push({ ...row, count: 1, oldest: time }); continue; }
    const key = `${row.nickname}|${row.pet}`, previous = open.get(key);
    const action = row.detail ?? "";
    if (previous && Date.parse(previous.at) - time <= SESSION) {
      previous.count++; previous.oldest = time;
      previous.actions![action] = (previous.actions![action] ?? 0) + 1;
    } else {
      const group: HistoryRow = { ...row, count: 1, oldest: time, actions: { [action]: 1 } };
      groups.push(group); open.set(key, group);
    }
  }
  return groups.slice(0, limit);
}

export function historyText(row: PetHistoryEntry | HistoryRow) {
  const dog = PETS[row.pet].name;
  if (row.kind === "action") {
    const counts = "actions" in row && row.actions ? row.actions : { [row.detail ?? ""]: 1 };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a, n]) => `${ACTIONS[a] ?? "돌봄"}${n > 1 ? n : ""}`).join(" ");
    return total > 1 ? `${row.nickname} · ${dog} 돌봄 ${total}번 (${top})` : `${row.nickname} · ${dog}에게 ${top}`;
  }
  const item = CATALOG.find((item) => item.id === row.detail)?.name ?? "물건";
  const detail = row.kind === "purchase" ? `${item} 구매`
    : row.kind === "equip" ? row.detail ? `${item} 착용` : "착용 해제"
    : row.kind === "levelup" ? `Lv.${row.detail} 달성` : `새 도감 ${item}`;
  const icon = row.kind === "levelup" ? "⭐ " : row.kind === "discover" ? "📖 " : row.kind === "purchase" ? "🛍️ " : "👕 ";
  return `${icon}${row.nickname} · ${dog} ${detail}`;
}
