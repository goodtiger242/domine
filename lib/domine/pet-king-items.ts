import { CONSUMABLES, ITEM_BY_ID } from "./battle/data";
import type { Item } from "./battle/types";
import type { KingState } from "./pet-king-rpc";

export function itemEffect(item: Item): string {
  if (item.heal) return `체력 ${Math.round(item.heal * 100)}% 회복`;
  if (item.energy) return `기력 +${item.energy}`;
  if (item.buff) return `${{ attack: "공격", defense: "방어", speed: "민첩", focus: "집중" }[item.buff]} +20% · 3라운드`;
  return ({ cleanse: "상태이상·약화 해제", protect: "다음 피해 −50%", critical: "다음 공격 급소 확정", cancel: "상대 행동 취소 · 대장 제외", survive: "쓰러질 때 체력 1 · 한 판 1회" } as Partial<Record<NonNullable<Item["category"]>, string>>)[item.category!] ?? "";
}
export function selectedItems(ids: unknown, inventory: Record<string, number>): string[] {
  return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === "string" && CONSUMABLES.some(i => i.id === id) && inventory[id] > 0))].slice(0,3) : [];
}
export function purchaseReason(state: KingState | null, pet: number, id: string): string {
  if (!state?.features.items) return "전투 물품을 불러오지 못했어요";
  const price = state.prices[id], held = state.pets.find(p => p.pet === pet)?.inventory[id] ?? 0;
  if (!ITEM_BY_ID[id] || !Number.isFinite(price)) return "판매 준비 중이에요";
  const reserved = state.tickets.filter(t => t.pet === pet && t.status === "active").reduce((n,t) => n + (t.reserved[id] ?? 0),0);
  if (held + reserved >= 9) return "최대 9개까지 보유해요";
  return state.coins < price ? `${price - state.coins}코인 부족해요` : "";
}
