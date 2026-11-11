import { CATALOG } from "./pet-catalog";
import { PETS } from "./pet-photos";
import type { PetHistoryEntry } from "./pet-rpc";

const ACTIONS: Record<string, string> = { feed: "밥", treat: "간식", pet: "쓰다듬기", play: "놀이", walk: "산책", brush: "빗질", bath: "목욕", train: "훈련" };
const SESSION = 60 * 60 * 1000;
export type HistoryRow = PetHistoryEntry & { count: number; oldest: number; actions?: Record<string, number>; results?: Record<string, number> };

/** 돌봄·대결·새 도감은 같은 사람·같은 강아지면 1시간 안을 한 줄로 묶는다. 레벨업·구매는 따로 두고, 착용·코인 줍기는 남기지 않는다. */
const MERGED = new Set(["action", "battle", "discover"]);
export function groupHistory(entries: readonly PetHistoryEntry[], limit = 8) {
  const groups: HistoryRow[] = [];
  const open = new Map<string, HistoryRow>();
  for (const row of [...entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))) {
    if (row.kind === "equip" || row.kind === "pickup") continue;
    const time = Date.parse(row.at);
    if (!MERGED.has(row.kind)) { groups.push({ ...row, count: 1, oldest: time }); continue; }
    const key = `${row.kind}|${row.nickname}|${row.pet}`, previous = open.get(key);
    const detail = row.detail ?? "", result = row.kind === "battle" ? (detail.split(" - ").pop() ?? "") : detail;
    if (previous && Date.parse(previous.at) - time <= SESSION) {
      previous.count++; previous.oldest = time;
      const bucket = row.kind === "battle" ? previous.results : row.kind === "action" ? previous.actions : undefined;
      if (bucket) bucket[result] = (bucket[result] ?? 0) + 1;
    } else {
      const group: HistoryRow = { ...row, count: 1, oldest: time, actions: row.kind === "action" ? { [detail]: 1 } : undefined, results: row.kind === "battle" ? { [result]: 1 } : undefined };
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
  const count = "count" in row ? row.count : 1;
  if (row.kind === "battle") {
    const results = "results" in row && row.results ? row.results : { [(row.detail ?? "").split(" - ").pop() ?? ""]: 1 };
    const win = results.win ?? 0, lose = results.lose ?? 0;
    return count > 1 ? `⚔️ ${row.nickname} · ${dog} 대결 ${count}번 (승 ${win}${lose ? ` · 패 ${lose}` : ""})`
      : `⚔️ ${row.nickname} · ${dog} ${(row.detail ?? "").split(" - ")[0]} ${win ? "승리" : lose ? "패배" : "무승부"}`;
  }
  if (row.kind === "pickup") return `🪙 ${row.nickname} · 코인을 주웠어요`;
  if (row.kind === "discover" && count > 1) return `📖 ${row.nickname} · ${dog} 새 도감 ${count}개`;
  const item = CATALOG.find((item) => item.id === row.detail)?.name ?? "물건";
  const detail = row.kind === "purchase" ? `${item} 구매`
    : row.kind === "equip" ? row.detail ? `${item} 착용` : "착용 해제"
    : row.kind === "levelup" ? `Lv.${row.detail} 달성` : `새 도감 ${item}`;
  const icon = row.kind === "levelup" ? "⭐ " : row.kind === "discover" ? "📖 " : row.kind === "purchase" ? "🛍️ " : "👕 ";
  return `${icon}${row.nickname} · ${dog} ${detail}`;
}
