import { CATALOG } from "./pet-catalog";
import { PETS } from "./pet-photos";
import type { PetHistoryEntry } from "./pet-rpc";

export function groupHistory(entries: readonly PetHistoryEntry[]) {
  const groups: (PetHistoryEntry & { count: number; oldest: number })[] = [];
  const latest = new Map<string, (typeof groups)[number]>();
  for (const row of [...entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))) {
    const key = JSON.stringify([row.nickname, row.pet, row.kind, row.detail]);
    const time = Date.parse(row.at), previous = latest.get(key);
    if (previous && previous.oldest - time <= 30 * 60 * 1000) {
      previous.count++;
      previous.oldest = time;
    } else {
      const group = { ...row, count: 1, oldest: time };
      groups.push(group);
      latest.set(key, group);
    }
  }
  return groups.slice(0, 12);
}

export function historyText(row: PetHistoryEntry) {
  const dog = PETS[row.pet].name;
  const item = CATALOG.find((item) => item.id === row.detail)?.name ?? "물건";
  const actions: Record<string, string> = { feed: "밥", treat: "간식", pet: "쓰다듬기", play: "놀이", walk: "산책", brush: "빗질", bath: "목욕", train: "훈련" };
  const detail = row.kind === "action" ? actions[row.detail ?? ""] ?? "돌봄"
    : row.kind === "purchase" ? `${item} 구매`
    : row.kind === "equip" ? row.detail ? `${item} 착용` : "착용 해제"
    : row.kind === "levelup" ? `Lv.${row.detail}` : `새 도감 ${item}`;
  const icon = row.kind === "levelup" ? "⭐ " : row.kind === "discover" ? "📖 " : "";
  return `${icon}${row.nickname} · ${dog}에게 ${detail}`;
}
