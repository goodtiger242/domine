import type { BattleState } from "./battle/types";
import { CONSUMABLES } from "./battle/data";
import { cumulativeXp } from "./battle/rules";
import { SPECIES } from "./king/species";
import type { Encounter } from "./pet-battle-view";
import type { PetIdentity } from "./pet-identity";
import type { createKingApi, KingFinish, KingPet, KingRank, KingReply, KingSettlement, KingSpawn, KingStart, KingState, KingTicket, KingWatching } from "./pet-king-rpc";

export type KingApi = ReturnType<typeof createKingApi> & { abortSignal?: (signal: AbortSignal) => KingApi };
export const KING_LOCAL_NOTICE = "서버 보상을 확인하지 못했어요. 대결은 이 기기에서 계속해요.";

/** A lost response must reuse both the request ID and the payload. */
export async function retryKing<T>(request: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const attempt = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      // Wait for transport settlement even if an older injected API ignores cancellation.
      const result = await request(controller.signal);
      if (controller.signal.aborted) throw new Error("TIMEOUT");
      return result;
    } finally { clearTimeout(timer); }
  };
  try { return await attempt(); } catch {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return attempt();
  }
}

export function kingRank(encounter: Encounter): KingRank {
  const individual = encounter.individual;
  if ("rank" in individual) return ({ "cell-chief": "chief", "region-boss": "boss", gatekeeper: "gatekeeper", king: "king" } as const)[individual.rank];
  if (SPECIES.some(s => s.id === individual.species && s.category === "guest")) return "guest";
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

type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type PendingBattle = { startId: string; finishId: string; start: KingStart; ticket?: string; finish?: Omit<KingFinish, "ticket">; epoch?: string };
const activeBattles = new Set<string>();
const pendingKey = (identity: PetIdentity, pet: KingPet) => `domine-pet-battle:${identity.nickname.toLowerCase()}:${pet}`;
const epochKey = (identity: PetIdentity) => `domine-pet-epoch:${identity.nickname.toLowerCase()}`;
function browserStorage(): RecoveryStorage | undefined { try { return window.localStorage; } catch { return undefined; } }
function saveBattle(storage: RecoveryStorage | undefined, key: string, pending?: PendingBattle) {
  try { if (pending) storage?.setItem(key, JSON.stringify(pending)); else storage?.removeItem(key); } catch { /* The server still retains active tickets. */ }
}

/** Recover only abandoned sessions; live sheets own their own settlement. */
export async function recoverKingBattles(api: KingApi, identity: PetIdentity, state: KingState, storage = browserStorage()) {
  const results: KingSettlement[] = [], retained = new Set<string>();
  let expired = false;
  let previousEpoch: string | null = null;
  try { previousEpoch = storage?.getItem(epochKey(identity)) ?? null; } catch { /* Optional storage. */ }
  const reset = !!state.resetEpoch && !!previousEpoch && previousEpoch !== state.resetEpoch;
  for (const pet of [1, 2] as const) {
    const key = pendingKey(identity, pet);
    let pending: PendingBattle | undefined;
    try { pending = JSON.parse(storage?.getItem(key) ?? "null") ?? undefined; } catch { saveBattle(storage, key); }
    if (!pending || activeBattles.has(pending.startId)) continue;
    if (reset || (pending.epoch && state.resetEpoch && pending.epoch !== state.resetEpoch)) { saveBattle(storage, key); continue; }
    if (!pending.startId || !pending.finishId || pending.start?.pet !== pet) { saveBattle(storage, key); continue; }
    try {
      if (!pending.ticket) {
        const started = await retryKing(signal => (api.abortSignal?.(signal) ?? api).start(identity, pending!.startId, pending!.start));
        if (!started.supported) continue;
        if (!started.ok || !started.data) { saveBattle(storage, key); continue; }
        pending.ticket = started.data.id; saveBattle(storage, key, pending);
      }
      retained.add(pending.ticket);
      const saved = state.tickets.find(t => t.id === pending!.ticket);
      if (saved?.result) { results.push(saved.result); saveBattle(storage, key); continue; }
      const reply = await retryKing(signal => (api.abortSignal?.(signal) ?? api).finish(identity, pending!.finishId, {
        ...(pending!.finish ?? { outcome: "quit", rounds: 0, usedItems: {} }), ticket: pending!.ticket!,
      }));
      if (reply.supported && reply.ok && reply.data) { results.push(reply.data); saveBattle(storage, key); }
      else if (reply.supported && ["EXPIRED", "TICKET_NOT_FOUND", "INVALID_OPPONENT"].includes(reply.code)) {
        expired ||= reply.code === "EXPIRED"; saveBattle(storage, key);
      }
      else if (reply.supported && reply.code === "TOO_EARLY") {
        pending.finishId = crypto.randomUUID(); saveBattle(storage, key, pending);
      }
    } catch { /* Keep the exact request and payload for the next online refresh. */ }
  }
  // Other devices may own recent tickets. Only expire untracked reservations.
  for (const ticket of state.tickets) {
    if (ticket.status !== "active" || retained.has(ticket.id) || activeBattles.has(ticket.id) || Date.parse(ticket.expiresAt) > Date.now()) continue;
    try {
      const reply = await retryKing(signal => (api.abortSignal?.(signal) ?? api).finish(identity, ticket.id, { ticket: ticket.id, outcome: "quit", rounds: 0, usedItems: {} }));
      if (reply.supported && reply.ok && reply.data) results.push(reply.data);
      expired ||= reply.supported && reply.code === "EXPIRED";
    } catch { /* The next refresh retries with the same ticket-based request ID. */ }
  }
  try { if (state.resetEpoch) storage?.setItem(epochKey(identity), state.resetEpoch); } catch { /* Optional storage. */ }
  return { results, reset, changed: expired || results.length > 0 };
}

export function createKingBattle(api: KingApi | undefined, identity: PetIdentity | null | undefined, pet: KingPet, encounter: Encounter, items: readonly string[] = [], storage = browserStorage()) {
  if (items.length > 3 || items.some(id => !CONSUMABLES.some(i => i.id === id))) throw new Error("반입은 3종까지예요");
  const startId = crypto.randomUUID(), finishId = crypto.randomUUID();
  const reserved: Record<string, number> = {};
  for (const item of items) reserved[item] = (reserved[item] ?? 0) + 1;
  const pending: PendingBattle = { startId, finishId, start: { pet, cell: encounter.cellId, individualId: encounter.individual.id,
    slot: encounter.slot, opponentLevel: encounter.level, opponentRank: kingRank(encounter), opponentName: encounter.name, items: reserved, mode: "normal" } };
  const key = identity ? pendingKey(identity, pet) : "";
  try { pending.epoch = identity ? storage?.getItem(epochKey(identity)) ?? undefined : undefined; } catch { /* Optional storage. */ }
  let started: Promise<KingReply<KingTicket> | null> | undefined;
  let finished: Promise<{ settlement?: KingSettlement; notice: string }> | undefined;
  const start = () => started ??= (async () => {
    if (!api || !identity) return null;
    // Do not overwrite a previous uncertain settlement for this dog.
    try { if (storage?.getItem(key)) return null; } catch { /* Session-only recovery. */ }
    activeBattles.add(startId); saveBattle(storage, key, pending);
    try {
      const reply = await retryKing(signal => (api.abortSignal?.(signal) ?? api).start(identity, startId, pending.start));
      if (reply.supported && reply.ok && reply.data) { pending.ticket = reply.data.id; activeBattles.add(reply.data.id); saveBattle(storage, key, pending); }
      else { activeBattles.delete(startId); saveBattle(storage, key); }
      return reply;
    } catch { return null; }
  })();
  return { start, finish: (input: Omit<KingFinish, "ticket">) => finished ??= (async () => {
    const ticket = await start();
    if (activeBattles.has(startId) || pending.ticket) {
      pending.finish ??= JSON.parse(JSON.stringify(input)); saveBattle(storage, key, pending);
    }
    if (!api || !identity || !ticket?.supported || !ticket.ok || !ticket.data) { activeBattles.delete(startId); return { notice: KING_LOCAL_NOTICE }; }
    const payload = { ...pending.finish!, ticket: ticket.data.id };
    try {
      const reply = await retryKing(signal => (api.abortSignal?.(signal) ?? api).finish(identity, pending.finishId, payload));
      if (reply.supported && reply.ok && reply.data) { saveBattle(storage, key); return { settlement: reply.data, notice: "" }; }
      if (reply.supported && reply.code === "TOO_EARLY") { pending.finishId = crypto.randomUUID(); saveBattle(storage, key, pending); }
    } catch { /* A lost response must not turn a completed win into a quit. */ }
    finally { activeBattles.delete(startId); activeBattles.delete(ticket.data.id); }
    try {
      const state = await retryKing(signal => (api.abortSignal?.(signal) ?? api).state(identity));
      const saved = state.supported && state.ok ? state.data?.tickets.find(t => t.id === ticket.data!.id)?.result : undefined;
      if (saved) { saveBattle(storage, key); return { settlement: saved, notice: "" }; }
    } catch { /* Unsettled reservations expire server-side without consuming items. */ }
    finished = undefined;
    return { notice: "보상 확인을 기다리고 있어요" };

  })() };
}

export function createKingPickup() {
  const seen = new Set<string>();
  const pending = new Map<string, string>(), busy = new Set<string>();
  return async (api: KingApi, identity: PetIdentity, cell: string, slot: number, storage?: Pick<Storage, "getItem" | "setItem">, epoch = "legacy") => {
    const key = `domine-pet-pickup:${epoch}:${identity.nickname.toLowerCase()}:${slot}:${cell}`;
    if (seen.has(key) || busy.has(key)) return null;
    let saved: string | null | undefined;
    try { saved = storage?.getItem(key); } catch { /* Session memory. */ }
    if (saved === "1") return null;
    const requestId = pending.get(key) ?? (saved?.startsWith("pending:") ? saved.slice(8) : crypto.randomUUID());
    pending.set(key, requestId); busy.add(key);
    try { storage?.setItem(key, `pending:${requestId}`); } catch { /* Session memory. */ }
    try {
      const result = await retryKing(signal => (api.abortSignal?.(signal) ?? api).pickup(identity, requestId, { cell, slot }));
      if (!result.supported || !result.ok || !result.data) return null;
      seen.add(key); pending.delete(key);
      try { storage?.setItem(key, "1"); } catch { /* Session memory. */ }
      return result.data;
    } catch { return null; }
    finally { busy.delete(key); }
  };
}
