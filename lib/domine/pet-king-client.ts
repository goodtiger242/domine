import type { BattleState } from "./battle/types";
import { cumulativeXp } from "./battle/rules";
import type { Encounter } from "./pet-battle-view";
import type { PetIdentity } from "./pet-identity";
import type { createKingApi, KingFinish, KingPet, KingRank, KingReply, KingSettlement, KingSpawn, KingTicket, KingWatching } from "./pet-king-rpc";

export type KingApi = ReturnType<typeof createKingApi>;
export const KING_LOCAL_NOTICE = "서버 보상을 확인하지 못했어요. 대결은 이 기기에서 계속해요.";

/** A lost response must reuse both the request ID and the payload. */
export async function retryKing<T>(request: () => Promise<T>): Promise<T> {
  const attempt = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([request(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("TIMEOUT")), 8000);
      })]);
    } finally { clearTimeout(timer); }
  };
  try { return await attempt(); } catch { return attempt(); }
}

export function kingRank(encounter: Encounter): KingRank {
  const individual = encounter.individual;
  if ("rank" in individual) return ({ "cell-chief": "chief", "region-boss": "boss", gatekeeper: "gatekeeper", king: "king" } as const)[individual.rank];
  return ({ 순둥이: "resident", 보통: "resident", 노련: "veteran", 대장: "chief", 싸움왕: "king" } as const)[individual.intelligence];
}

export function kingProgress(xp: number, level: number) {
  const base = cumulativeXp(level), needed = level >= 999 ? 0 : cumulativeXp(level + 1) - base;
  return { level, value: xp, current: Math.max(0, Math.min(needed, xp - base)), needed };
}

export function kingRewardLine(result: KingSettlement, firstWin = false) {
  if (result.outcome === "quit" || !result.xp && !result.coins) return "";
  return [result.xp ? `경험치 +${result.xp}` : "", result.coins ? `🪙 +${result.coins}` : "",
    result.levelAfter > result.levelBefore ? `Lv.${result.levelAfter}!` : "",
    result.streak > 1 ? `${result.streak}연승` : "", firstWin && result.outcome === "win" ? "첫 승리!" : ""].filter(Boolean).join(" · ");
}

export function departedWins(local: readonly string[], departed: readonly KingSpawn[], slot: number) {
  return [...new Set([...local.filter(key => key.startsWith(`${slot}:`)),
    ...departed.filter(spawn => spawn.slot === slot).map(spawn => `${slot}:${spawn.cell}:${spawn.individualId}`)])];
}

export function watchingLine(watching: readonly KingWatching[], cell: string, nickname: string, now: number) {
  const entry = watching.find(w => w.cell === cell && w.nickname !== nickname && now - Date.parse(w.startedAt) < 180000);
  return entry ? `${entry.nickname}님이 ${entry.pet === 1 ? "도미" : "미네"}로 ${entry.opponentName}와 겨루는 중` : "";
}

export function battleFinish(state: BattleState, rounds: number, moveCounts: Record<string, number>): Omit<KingFinish, "ticket"> {
  const usedItems: Record<string, number> = {};
  for (const id of state.player.usedItems ?? []) usedItems[id] = (usedItems[id] ?? 0) + 1;
  return { outcome: state.outcome === "player" ? "win" : state.outcome === "opponent" ? "lose" : state.outcome ?? "quit", rounds, usedItems, moveCounts: { ...moveCounts } };
}

export function createKingBattle(api: KingApi | undefined, identity: PetIdentity | null | undefined, pet: KingPet, encounter: Encounter, items: readonly string[] = []) {
  const startId = crypto.randomUUID(), finishId = crypto.randomUUID();
  const reserved: Record<string, number> = {};
  for (const item of items) reserved[item] = (reserved[item] ?? 0) + 1;
  let started: Promise<KingReply<KingTicket> | null> | undefined;
  let finished: Promise<{ settlement?: KingSettlement; notice: string }> | undefined;
  const start = () => started ??= (async () => {
    if (!api || !identity) return null;
    try {
      return await retryKing(() => api.start(identity, startId, { pet, cell: encounter.cellId, individualId: encounter.individual.id,
        slot: encounter.slot, opponentLevel: encounter.level, opponentRank: kingRank(encounter), opponentName: encounter.name, items: reserved, mode: "normal" }));
    } catch { return null; }
  })();
  return { start, finish: (input: Omit<KingFinish, "ticket">) => finished ??= (async () => {
    const ticket = await start();
    if (!api || !identity || !ticket?.supported || !ticket.ok || !ticket.data) return { notice: KING_LOCAL_NOTICE };
    const payload = { ...input, ticket: ticket.data.id };
    try {
      const reply = await retryKing(() => api.finish(identity, finishId, payload));
      if (reply.supported && reply.ok && reply.data) return { settlement: reply.data, notice: "" };
      return { notice: reply.supported ? "서버에서 이번 보상을 지급하지 않았어요." : KING_LOCAL_NOTICE };
    } catch { return { notice: KING_LOCAL_NOTICE }; }
  })() };
}

export function createKingPickup() {
  const seen = new Set<string>();
  return async (api: KingApi, identity: PetIdentity, cell: string, slot: number, storage?: Pick<Storage, "getItem" | "setItem">) => {
    const key = `domine-pet-pickup:${slot}:${cell}`;
    if (seen.has(key)) return null;
    seen.add(key);
    try { if (storage?.getItem(key)) return null; storage?.setItem(key, "1"); } catch { /* Session memory still prevents duplicates. */ }
    const requestId = crypto.randomUUID();
    try {
      const result = await retryKing(() => api.pickup(identity, requestId, { cell, slot }));
      return result.supported && result.ok ? result.data ?? null : null;
    } catch { return null; }
  };
}
