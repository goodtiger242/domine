import type { PetAction } from "./pet";
import type { PetId } from "./pet-photos";
import type { PetIdentity } from "./pet-identity";
import type { PetMap } from "./pet-maps";
import type { PetState } from "./pet";
import type { Reward } from "./pet-progress";

type Result = { data: unknown; error: { code?: string; message: string } | null; status?: number };
type Rpc = (name: string, args: Record<string, string | number>) => PromiseLike<Result>;

/** 없는 함수에 한해서만 구버전으로 돌아간다. 미네 돌봄을 도미에게 보내지 않는다. */
export async function petRequest(rpc: Rpc, petId: PetId, nickname: string, action?: PetAction, legacy = false) {
  const name = action ? "domine_pet_care" : "domine_pet_state";
  const args = { p_nickname: nickname, ...(action ? { p_action: action } : {}) };
  if (!legacy) {
    const result = await rpc(`${name}_for`, { ...args, p_pet: petId });
    if (result.error?.code !== "PGRST202") return { ...result, petId, legacy: false };
  }
  if (action && petId !== 1) {
    return { data: null, error: { message: "미네는 아직 준비 중이에요." }, petId: 1 as const, legacy: true };
  }
  return { ...await rpc(name, args), petId: 1 as const, legacy: true };
}

export type PetCommand = { requestId: string } & (
  | { kind: "action"; pet: PetId; action: PetAction }
  | { kind: "purchase"; pet: PetId; item: string }
  | { kind: "equip"; pet: PetId; slot: "wearable" | "toy"; item: string | null }
  | { kind: "explore_begin"; map: PetMap; source: "map" | "walk" }
  | { kind: "explore_finish"; pet?: PetId; ticket: string }
  | { kind: "record_season"; entry: string }
  | { kind: "walk_begin" }
  | { kind: "walk_claim" | "walk_end"; pet?: PetId; session: string }
);
export type V6Result = {
  ok: boolean; code: string; serverNow: string; requestId?: string; version?: number;
  player?: { xp: number; level: number; coins: number };
  pet?: PetId; levels?: Record<PetId, number>; coins?: number;
  reward?: Reward;
  shared?: { applied: boolean; reason: string | null; pet: PetState };
  inventory?: string[]; album?: string[]; badges?: string[];
  equipment?: { pet_id: PetId; slot: "wearable" | "toy"; item_id: string | null }[];
  daily?: { reward_actions: number; explore_finishes: number; walk_claims: number };
  ticket?: { id: string; map_id: PetMap; eligible_at: string; expires_at: string } | null;
  season?: string; retryAfterSeconds?: number;
};
export type PetCapabilities = { version: 6; sharedEconomy: boolean; explorationThemes: number; v9: boolean; v10: boolean; perPetShop: boolean; history: boolean };
export type PetHistoryEntry = { nickname: string; pet: PetId; kind: "action" | "purchase" | "equip" | "levelup" | "discover"; detail: string | null; at: string };
export class PetRpcError extends Error {
  definitive: boolean;
  constructor(code: string, definitive: boolean) { super(code); this.definitive = definitive; }
}
export const supportsExploration = (v9: boolean, map: PetMap) => v9 || ["church", "field", "street", "park", "home"].includes(map);
export interface PetApi {
  legacy(pet: PetId, nickname: string, action?: PetAction, legacy?: boolean): ReturnType<typeof petRequest>;
  capabilities(): Promise<PetCapabilities | false>;
  register(identity: PetIdentity, signal?: AbortSignal): Promise<V6Result>;
  state(identity: PetIdentity, pet: PetId, signal?: AbortSignal): Promise<V6Result>;
  execute(identity: PetIdentity, command: PetCommand, signal?: AbortSignal): Promise<V6Result>;
  operation(identity: PetIdentity, requestId: string): Promise<V6Result>;
  history(): Promise<PetHistoryEntry[]>;
}
type V6Rpc = (name: string, args: Record<string, string | number | null>, signal?: AbortSignal) => PromiseLike<Result>;
export function createPetApi(rpc: V6Rpc): PetApi {
  let v9 = false, v10 = false;
  const call = async (name: string, args: Record<string, string | number | null>, signal?: AbortSignal, version = 6) => {
    const { data, error, status } = await rpc(`domine_pet_${name}_v${version}`, args, signal);
    if (error) throw new PetRpcError(error.code || "NETWORK_ERROR", (status ?? 0) >= 400 || /^(?:[0-9A-Z]{5}|PGRST\d{3}|[45]\d{2})$/.test(error.code ?? ""));
    if (!data || typeof data !== "object" || !("ok" in data)) throw new Error("INVALID_RESPONSE");
    return data as V6Result;
  };
  const auth = (i: PetIdentity) => ({ p_nickname: i.nickname, p_secret: i.secret });
  return {
    legacy: (pet, nickname, action, legacy) => petRequest((name, args) => rpc(name, args), pet, nickname, action, legacy),
    async capabilities() {
      v9 = false;
      v10 = false;
      const { data, error } = await rpc("domine_pet_capabilities_v6", {});
      if (error?.code === "PGRST202") return false;
      if (error) throw new Error(error.code ?? "NETWORK_ERROR");
      if (!data || (data as { version?: number }).version !== 6) throw new Error("INVALID_RESPONSE");
      const flags = data as Partial<PetCapabilities>;
      v9 = flags.v9 === true;
      v10 = flags.v10 === true;
      return { version: 6, sharedEconomy: flags.sharedEconomy === true, explorationThemes: flags.explorationThemes ?? 5, v9, v10, perPetShop: flags.perPetShop === true, history: flags.history === true };
    },
    register: (i, signal) => call("register", auth(i), signal),
    state: (i, pet, signal) => call("state", { ...auth(i), p_pet: pet }, signal),
    operation: (i, id) => call("operation", { ...auth(i), p_request_id: id }),
    async history() {
      const { data, error, status } = await rpc("domine_pet_history_v10", { p_limit: 30 });
      if (error) throw new PetRpcError(error.code || "NETWORK_ERROR", (status ?? 0) >= 400);
      if (!Array.isArray(data)) throw new Error("INVALID_RESPONSE");
      return data as PetHistoryEntry[];
    },
    async execute(i, command, signal) {
      if (command.kind === "explore_begin" && !supportsExploration(v9, command.map)) {
        return Promise.resolve({ ok: false, code: "SERVER_UPDATE_REQUIRED", serverNow: new Date().toISOString() });
      }
      const args: Record<string, string | number | null> = { ...auth(i), p_request_id: command.requestId };
      switch (command.kind) {
        case "action": Object.assign(args, { p_pet: command.pet, p_action: command.action }); break;
        case "purchase": {
          args.p_item = command.item;
          try { return await call("purchase", { ...args, p_pet: command.pet ?? 1 }, signal, 10); }
          catch (error) { if (!(error instanceof PetRpcError) || error.message !== "PGRST202") throw error; }
          return call("purchase", args, signal);
        }
        case "equip": Object.assign(args, { p_pet: command.pet, p_slot: command.slot, p_item: command.item }); break;
        case "explore_begin": Object.assign(args, { p_map: command.map, p_source: command.source }); break;
        case "explore_finish": args.p_ticket = command.ticket; if (v10) args.p_pet = command.pet ?? 1; break;
        case "record_season": args.p_entry = command.entry; break;
        case "walk_claim": case "walk_end": args.p_session = command.session; if (v10 && command.kind === "walk_claim") args.p_pet = command.pet ?? 1; break;
      }
      return call(command.kind, args, signal);
    },
  };
}
export function acceptsResult(current: V6Result | null, next: V6Result) {
  return next.player !== undefined && (next.version ?? -1) >= (current?.version ?? -1);
}
