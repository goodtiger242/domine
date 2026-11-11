import type { PetIdentity } from "./pet-identity";

export type KingPet = 1 | 2;
export type KingStat = "hp" | "attack" | "defense" | "speed" | "focus" | "calm";
export type KingAllocation = Record<KingStat, number>;
export type KingRank = "resident" | "veteran" | "guest" | "chief" | "lieutenant" | "boss" | "gatekeeper" | "king";
export type KingJob = "striker" | "defender" | "trickster" | "tracker" | "empath";
export type KingOutcome = "win" | "lose" | "draw" | "quit";
export type KingFeatures = {
  battles: boolean; growth: boolean; items: boolean; jobs: boolean;
  mastery: boolean; encyclopedia: boolean; certifications: boolean; raids: boolean; drops: boolean;
};
export type KingProgress = {
  wallet?: { coins: number; version: number };
  pet: KingPet; xp: number; streak: number; level: number; allocation: KingAllocation; unspent: number;
  allocationMode: "auto" | "manual"; job: KingJob | null; jobTier: number;
  jobChangedAt: string | null; moves: string[]; version: number;
  mastery: Record<string, number>; inventory: Record<string, number>;
};
export type KingSpawn = { slot: number; cell: string; individualId: string };
export type KingWatching = {
  ticket: string; nickname: string; pet: KingPet; opponentName: string; cell: string; startedAt: string;
};
export type KingEncounter = {
  individualId: string; name: string; encounters: number; wins: number; losses: number;
  weaknesses: string[]; resistances: string[];
};
export type KingCertification = { pet: KingPet; kind: string; target: string; at: string };
export type KingRaid = { region: string; week: string; target: number; progress: number; completed: boolean };
export type KingTicket = {
  id: string; pet: KingPet; seed: number; startedAt: string; expiresAt: string;
  snapshot: KingProgress; reserved: Record<string, number>;
};
export type KingSettlement = {
  progress?: KingProgress; wallet?: { coins: number; version: number };
  ticket: string; outcome: KingOutcome; xp: number; coins: number; streak: number;
  levelBefore: number; levelAfter: number; eligible: boolean; contribution: number; drop: string | null;
};
export type KingState = {
  resetEpoch?: string;
  coins: number; version: number; features: KingFeatures; pets: KingProgress[];
  slot: number; departed: KingSpawn[]; watching: KingWatching[];
  encyclopedia: KingEncounter[]; certifications: KingCertification[]; raids: KingRaid[];
  tickets: (KingTicket & { status: string; result: KingSettlement | null })[];
  prices: Record<string, number>;
};
export type KingRanking = { nickname: string; wins: number; raidContribution: number };
export type KingReply<T> = { supported: true; ok: boolean; code: string; requestId: string; serverNow: string; data?: T | null }
  | { supported: false; ok: false; code: "UNSUPPORTED" };
export type KingStart = {
  pet: KingPet; cell: string; individualId: string; slot: number;
  opponentLevel: number; opponentRank: KingRank; opponentName: string;
  items?: Record<string, number>; mode?: "normal" | "raid";
};
export type KingFinish = {
  ticket: string; outcome: KingOutcome; rounds: number;
  usedItems?: Record<string, number>; moveCounts?: Record<string, number>;
  weaknesses?: string[]; resistances?: string[];
  /** Raid contribution is the final depleted HP fraction, never cumulative damage. */
  remainingHp?: number; maxHp?: number;
};
export type KingAllocate = {
  pet: KingPet; expectedVersion: number; allocation: KingAllocation; mode?: "auto" | "manual";
};
export type KingChooseJob = { pet: KingPet; expectedVersion: number; job: KingJob; tier: 1 | 2 | 3 };
export type KingEquipMoves = { pet: KingPet; expectedVersion: number; moves: string[] };
export type KingPickup = { cell: string; slot: number };
export type KingPickupResult = { found: boolean; coins: number; pouch: boolean };
export type KingBuyItem = { pet: KingPet; item: string; quantity: number };
export type KingRpc = (name: string, args: {
  p_nickname: string; p_secret: string; p_request_id: string; p_kind: string; p_input: object;
}) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const count = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
const counts = (v: unknown) => record(v) && Object.values(v).every(count);
const wallet = (v: unknown) => record(v) && count(v.coins) && count(v.version);
const progress = (v: unknown): boolean => record(v) && (v.pet === 1 || v.pet === 2) && count(v.xp)
  && count(v.version) && count(v.level) && Number(v.level) >= 1 && counts(v.allocation)
  && ["hp", "attack", "defense", "speed", "focus", "calm"].every(k => record(v.allocation) && count(v.allocation[k]))
  && counts(v.inventory) && counts(v.mastery) && Array.isArray(v.moves) && v.moves.every(m => typeof m === "string")
  && (!v.wallet || wallet(v.wallet));
const settlement = (v: unknown): boolean => record(v) && typeof v.ticket === "string"
  && ["win", "lose", "draw", "quit"].includes(String(v.outcome)) && count(v.xp) && count(v.coins)
  && count(v.levelBefore) && count(v.levelAfter) && (!v.progress || progress(v.progress)) && (!v.wallet || wallet(v.wallet));
const ticket = (v: unknown): boolean => record(v) && typeof v.id === "string" && progress(v.snapshot)
  && counts(v.reserved) && typeof v.expiresAt === "string" && (!v.result || settlement(v.result));
function validData(kind: string, v: unknown): boolean {
  if (kind === "state") return record(v) && wallet(v) && record(v.features) && counts(v.prices)
    && ["pets", "departed", "watching", "encyclopedia", "certifications", "raids", "tickets"].every(k => Array.isArray(v[k]))
    && (v.pets as unknown[]).every(progress) && (v.tickets as unknown[]).every(ticket)
    && ["departed", "watching", "encyclopedia", "certifications", "raids"].every(k => (v[k] as unknown[]).every(record));
  if (kind === "start") return ticket(v);
  if (kind === "finish") return settlement(v);
  if (["allocate", "chooseJob", "equipMoves", "buyItem"].includes(kind)) return progress(v);
  if (kind === "pickup") return record(v) && typeof v.found === "boolean" && count(v.coins) && typeof v.pouch === "boolean";
  return true;
}

/** Keep requestId for uncertain network retries; a cached rejection needs a new requestId. */
export function createKingApi(rpc: KingRpc) {
  async function call<T>(identity: PetIdentity, requestId: string, kind: string, input: object): Promise<KingReply<T>> {
    const { data, error } = await rpc("domine_pet_king_v17", {
      p_nickname: identity.nickname, p_secret: identity.secret,
      p_request_id: requestId, p_kind: kind, p_input: input,
    });
    if (error?.code === "PGRST202") return { supported: false, ok: false, code: "UNSUPPORTED" };
    if (error) throw new Error(error.code || error.message || "NETWORK_ERROR");
    if (!data || typeof data !== "object" || !("ok" in data) || typeof data.ok !== "boolean"
      || !("code" in data) || typeof data.code !== "string"
      || !("requestId" in data) || data.requestId !== requestId
      || !("serverNow" in data) || typeof data.serverNow !== "string") throw new Error("INVALID_RESPONSE");
    if (data.ok && (!("data" in data) || !validData(kind, data.data))) throw new Error("INVALID_RESPONSE");
    return { ...data, supported: true } as KingReply<T>;
  }
  return {
    state: (identity: PetIdentity, requestId = crypto.randomUUID()) => call<KingState>(identity, requestId, "state", {}),
    start: (identity: PetIdentity, requestId: string, input: KingStart) => call<KingTicket>(identity, requestId, "start", input),
    finish: (identity: PetIdentity, requestId: string, input: KingFinish) => call<KingSettlement>(identity, requestId, "finish", input),
    allocate: (identity: PetIdentity, requestId: string, input: KingAllocate) => call<KingProgress>(identity, requestId, "allocate", input),
    chooseJob: (identity: PetIdentity, requestId: string, input: KingChooseJob) => call<KingProgress>(identity, requestId, "chooseJob", input),
    equipMoves: (identity: PetIdentity, requestId: string, input: KingEquipMoves) => call<KingProgress>(identity, requestId, "equipMoves", input),
    pickup: (identity: PetIdentity, requestId: string, input: KingPickup) => call<KingPickupResult>(identity, requestId, "pickup", input),
    buyItem: (identity: PetIdentity, requestId: string, input: KingBuyItem) => call<KingProgress>(identity, requestId, "buyItem", input),
    spawns: (identity: PetIdentity, requestId = crypto.randomUUID()) => call<{ slot: number; departed: KingSpawn[] }>(identity, requestId, "spawns", {}),
    watching: (identity: PetIdentity, requestId = crypto.randomUUID()) => call<KingWatching[]>(identity, requestId, "watching", {}),
    ranking: (identity: PetIdentity, requestId = crypto.randomUUID()) => call<KingRanking[]>(identity, requestId, "ranking", {}),
  };
}
