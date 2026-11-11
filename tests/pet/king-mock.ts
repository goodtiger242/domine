import type {
  KingAllocation, KingEncounter, KingFeatures, KingPet, KingProgress, KingRank,
  KingRpc, KingSettlement, KingStart, KingTicket, KingCertification, KingRaid,
} from "../../lib/domine/pet-king-rpc";

const stats = ["hp", "attack", "defense", "speed", "focus", "calm"] as const;
const ranks: KingRank[] = ["resident", "chief", "lieutenant", "boss", "gatekeeper", "king"];
const prices: Record<string, number> = Object.fromEntries([15, 35, 70, 12, 30, 25, 25, 25, 25, 20, 30, 40, 35, 60]
  .map((price, i) => [`P${String(i + 1).padStart(2, "0")}`, price]));
const emptyAllocation = (): KingAllocation => ({ hp: 0, attack: 0, defense: 0, speed: 0, focus: 0, calm: 0 });
export const kingXpForLevel = (level: number) => 6 * (level - 1) * (level + 4) + Math.floor(Math.max(0, level - 10) ** 3 / 25);
export function kingLevelForXp(xp: number) {
  let low = 1, high = 999;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (kingXpForLevel(mid) <= xp) low = mid; else high = mid - 1;
  }
  return low;
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const fail = (code: string): never => { throw new Error(code); };
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_INPUT");
  return value as Record<string, unknown>;
};
const integer = (value: unknown, min = 0, max = 2147483647) => {
  if (!/^[0-9]+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) fail("INVALID_INPUT");
  return Number(value);
};
const text = (value: unknown, pattern: RegExp) => typeof value === "string" && pattern.test(value) ? value : fail("INVALID_INPUT");
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function autoAllocate(pet: KingProgress) {
  const total = 3 * (pet.level - 1), weights = pet.pet === 1 ? [20, 12, 18, 12, 23, 15] : [16, 20, 14, 24, 16, 10];
  let spent = Object.values(pet.allocation).reduce((a, b) => a + b, 0);
  while (spent < total) {
    const key = [...stats].filter(s => pet.allocation[s] < Math.max(1, Math.floor(total * .4)))
      .sort((a, b) => (total * weights[stats.indexOf(b)] / 100 - pet.allocation[b])
        - (total * weights[stats.indexOf(a)] / 100 - pet.allocation[a]) || a.localeCompare(b))[0];
    pet.allocation[key]++; spent++;
  }
}
const regionForCell = (cell: string) => {
  const column = cell[0], base = [5, 5, 2, 2, 1, 1, 3, 3, 4, 4][column.charCodeAt(0) - 65];
  const extra = Number(cell.slice(1)) > 5 ? "CD".includes(column) ? 4 : "EF".includes(column) ? 6 : 5 : 0;
  return `R${String(base + extra).padStart(2, "0")}`;
};
type Ticket = KingTicket & {
  owner: string; nickname: string; input: KingStart; region: string; week: string;
  status: "active" | "settled" | "cancelled" | "expired"; result: KingSettlement | null;
};
type Store = {
  coins: number; version: number; pets: Record<KingPet, KingProgress>; tickets: Record<string, Ticket>;
  departed: { slot: number; cell: string; individualId: string }[]; encounters: Record<string, KingEncounter>;
  certifications: KingCertification[]; wins: Record<string, number>; raids: Record<string, KingRaid>;
  contributions: { ticket: string; nickname: string; week: string; amount: number }[];
  history: { kind: string; pet: KingPet; nickname: string; detail: string }[]; changes: { kind: string; before: KingProgress; after: KingProgress }[];
};

/** Independent, synchronous transaction model; it does not prove PostgreSQL lock behavior. */
export function createKingMock(options: {
  now?: number; coins?: number; xp?: Partial<Record<KingPet, number>>;
  features?: Partial<KingFeatures>; allocationMode?: "auto" | "manual";
} = {}) {
  let now = options.now ?? Date.parse("2026-11-11T03:01:00Z"), sequence = 0;
  const features: KingFeatures = { battles: true, growth: true, items: true, jobs: true, mastery: true,
    encyclopedia: true, certifications: true, raids: false, drops: true, ...options.features };
  const identities = new Map<string, string>();
  const operations = new Map<string, { kind: string; payload: string; result: unknown }>();
  const makePet = (pet: KingPet): KingProgress => {
    const xp = options.xp?.[pet] ?? 0;
    const progress: KingProgress = { pet, xp, level: kingLevelForXp(xp), allocation: emptyAllocation(), unspent: 0,
      allocationMode: options.allocationMode ?? "auto", job: null, jobTier: 0, jobChangedAt: null,
      moves: [], version: 0, mastery: {}, inventory: {} };
    if (progress.allocationMode === "auto") autoAllocate(progress);
    return progress;
  };
  let store: Store = { coins: options.coins ?? 1000, version: 0, pets: { 1: makePet(1), 2: makePet(2) },
    tickets: {}, departed: [], encounters: {}, certifications: [], wins: {}, raids: {}, contributions: [], history: [], changes: [] };
  const slot = () => Math.floor(now / 1800000);
  const week = () => {
    const d = new Date(now + 9 * 3600000);
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
    return d.toISOString().slice(0, 10);
  };
  const petState = (pet: KingPet) => {
    const p = store.pets[pet];
    p.level = kingLevelForXp(p.xp);
    p.unspent = 3 * (p.level - 1) - Object.values(p.allocation).reduce((a, b) => a + b, 0);
    return clone(p);
  };
  const ticketJson = (t: Ticket): KingTicket => ({ id: t.id, pet: t.pet, seed: t.seed, startedAt: t.startedAt,
    expiresAt: t.expiresAt, snapshot: clone(t.snapshot), reserved: clone(t.reserved) });
  const watching = () => Object.values(store.tickets).filter(t => t.status === "active" && Date.parse(t.startedAt) > now - 180000)
    .map(t => ({ ticket: t.id, nickname: t.nickname, pet: t.pet, opponentName: t.input.opponentName, cell: t.input.cell, startedAt: t.startedAt }));
  const spawns = () => ({ slot: slot(), departed: store.departed.filter(d => d.slot === slot()) });
  const enabled = (flag: keyof KingFeatures) => { if (!features[flag]) fail("FEATURE_DISABLED"); };
  const expire = () => {
    for (const t of Object.values(store.tickets)) if (t.status === "active" && Date.parse(t.expiresAt) <= now) {
      for (const [item, quantity] of Object.entries(t.reserved)) store.pets[t.pet].inventory[item] = (store.pets[t.pet].inventory[item] ?? 0) + quantity;
      t.status = "expired"; store.pets[t.pet].version++;
    }
    store.departed = store.departed.filter(d => d.slot >= slot() - 1);
  };
  function dispatch(kind: string, input: Record<string, unknown>, nickname: string): unknown {
    if (kind === "state") return { coins: store.coins, version: store.version, features, pets: [petState(1), petState(2)],
      ...spawns(), watching: watching(), encyclopedia: Object.values(store.encounters), certifications: store.certifications,
      raids: Object.values(store.raids).filter(r => r.week === week()), prices,
      tickets: Object.values(store.tickets).filter(t => t.owner === nickname && Date.parse(t.startedAt) > now - 1800000)
        .map(t => ({ ...ticketJson(t), status: t.status, result: t.result })) };
    if (kind === "spawns") return spawns();
    if (kind === "watching") return watching();
    if (kind === "ranking") return [...new Set([...Object.keys(store.wins), ...store.contributions.filter(c => c.week === week()).map(c => c.nickname)])]
      .map(name => ({ nickname: name, wins: store.wins[name] ?? 0, raidContribution: store.contributions
        .filter(c => c.nickname === name && c.week === week()).reduce((sum, c) => sum + c.amount, 0) }))
      .sort((a, b) => b.wins - a.wins || b.raidContribution - a.raidContribution || a.nickname.localeCompare(b.nickname));
    if (kind === "finish") {
      const id = text(input.ticket, uuidPattern), t = store.tickets[id];
      if (!t || t.owner !== nickname) fail("TICKET_NOT_FOUND");
      if (t.status === "settled" || t.status === "cancelled") return t.result;
      if (t.status === "expired") fail("EXPIRED");
      const outcome = text(input.outcome, /^(win|lose|draw|quit)$/) as KingSettlement["outcome"];
      const rounds = integer(input.rounds, outcome === "quit" ? 0 : 1, 60);
      if (now < Date.parse(t.startedAt) + rounds * 1000) fail("TOO_EARLY");
      const used = object(input.usedItems ?? {}), moves = object(input.moveCounts ?? {});
      let count = 0;
      for (const [item, raw] of Object.entries(used)) {
        const quantity = integer(raw, 0, 3);
        if (quantity > (t.reserved[item] ?? 0)) fail("ITEM_NOT_RESERVED");
        count += quantity;
      }
      for (const [move, raw] of Object.entries(moves)) {
        const quantity = integer(raw, 0, rounds);
        count += quantity;
      }
      if (count > rounds) fail("INVALID_ACTION_COUNT");
      const tags = (raw: unknown): string[] => {
        if (!Array.isArray(raw)) fail("INVALID_INPUT");
        const array = raw as unknown[];
        if (array.length > 1 || array.some(tag => typeof tag !== "string" || !["contact", "sound", "scent", "trick", "combo", "charge", "gaze"].includes(tag))) fail("INVALID_TAGS");
        return array as string[];
      };
      const weaknesses = tags(input.weaknesses ?? []), resistances = tags(input.resistances ?? []);
      if (weaknesses.length && weaknesses[0] === resistances[0]) fail("INVALID_TAGS");
      if (weaknesses.length + resistances.length && !Object.values(moves).some(n => Number(n) > 0)) fail("INVALID_TAGS");
      const known = store.encounters[t.input.individualId];
      if (known && ((known.weaknesses.length && weaknesses.length && known.weaknesses[0] !== weaknesses[0])
        || (known.resistances.length && resistances.length && known.resistances[0] !== resistances[0])
        || known.weaknesses.includes(resistances[0]) || known.resistances.includes(weaknesses[0]))) fail("TAG_CONFLICT");
      const p = store.pets[t.pet], before = petState(t.pet), levelBefore = before.level;
      const eligible = t.input.mode !== "raid" && outcome !== "quit" && t.input.opponentLevel > t.snapshot.level - 4;
      const xp = eligible && features.growth ? outcome === "win" ? (12 + 2 * t.input.opponentLevel) : outcome === "draw" ? 6 : 4 : 0;
      let coins = eligible && outcome === "win" ? Math.min(6, 2 + Math.floor((Number(t.region.slice(1)) - 1) / 2)) : 0;
      let contribution = 0, drop: string | null = null;
      if (eligible && features.mastery) for (const [move, raw] of Object.entries(moves)) p.mastery[move] = (p.mastery[move] ?? 0) + Math.min(3, Number(raw));
      for (const [item, quantity] of Object.entries(t.reserved)) p.inventory[item] = (p.inventory[item] ?? 0) + quantity - Number(used[item] ?? 0);
      if (t.input.mode !== "raid" && outcome === "win") {
        store.departed.push({ slot: t.input.slot, cell: t.input.cell, individualId: t.input.individualId });
        if (features.certifications && t.input.opponentRank !== "resident") {
          const rank = t.input.opponentRank, certKind = rank === "chief" ? "cell" : rank === "boss" ? "region" : rank;
          const target = rank === "chief" ? t.input.cell : rank === "boss" ? t.region : t.input.individualId;
          if (!store.certifications.some(c => c.pet === t.pet && c.kind === certKind && c.target === target))
            store.certifications.push({ pet: t.pet, kind: certKind, target, at: new Date(now).toISOString() });
        }
        if (eligible) {
          store.wins[nickname] = (store.wins[nickname] ?? 0) + 1;
          if (features.items && features.drops && t.seed % 20 === 0) {
            drop = Object.keys(prices).sort()[Math.floor(t.seed / 20) % Object.keys(prices).length];
            p.inventory[drop] = (p.inventory[drop] ?? 0) + 1;
          }
        }
      }
      const encounter = store.encounters[t.input.individualId];
      if (features.encyclopedia && encounter) {
        encounter.wins += outcome === "win" ? 1 : 0; encounter.losses += outcome === "lose" ? 1 : 0;
        encounter.weaknesses = [...new Set([...encounter.weaknesses, ...weaknesses])].sort();
        encounter.resistances = [...new Set([...encounter.resistances, ...resistances])].sort();
      }
      if (t.input.mode === "raid" && outcome !== "quit") {
        const maxHp = integer(input.maxHp, 1, Number.MAX_SAFE_INTEGER), remainingHp = integer(input.remainingHp, 0, maxHp);
        if (outcome === "win" && remainingHp !== 0) fail("INVALID_INPUT");
        const raid = store.raids[`${t.region}:${t.week}`];
        contribution = t.week === week() ? Math.min(raid.target - raid.progress, Math.floor(1000 * (1 - remainingHp / maxHp))) : 0;
        store.contributions.push({ ticket: id, nickname, week: t.week, amount: contribution });
        raid.progress += contribution;
        if (contribution > 0 && !raid.completed && raid.progress === raid.target) coins = 40 + 10 * Number(t.region.slice(1));
        raid.completed = raid.progress === raid.target;
      }
      p.xp += xp; p.level = kingLevelForXp(p.xp); p.version++;
      if (p.allocationMode === "auto") autoAllocate(p);
      store.coins += coins; store.version++;
      if (p.level > levelBefore) {
        store.changes.push({ kind: "levelup", before, after: petState(t.pet) });
        store.history.push({ kind: "levelup", pet: t.pet, nickname, detail: String(p.level) });
      }
      store.history.push({ kind: "battle", pet: t.pet, nickname, detail: `${t.input.opponentName} - ${outcome}` });
      t.result = { ticket: id, outcome, xp, coins, levelBefore, levelAfter: p.level, eligible, contribution, drop };
      t.status = outcome === "quit" ? "cancelled" : "settled";
      return t.result;
    }
    if (!["start", "allocate", "chooseJob", "equipMoves", "buyItem"].includes(kind)) fail("INVALID_INPUT");
    const pet = integer(input.pet, 1, 2) as KingPet, p = store.pets[pet], before = petState(pet);
    if (["allocate", "chooseJob", "equipMoves"].includes(kind) && integer(input.expectedVersion) !== p.version) fail("VERSION_CONFLICT");
    if (kind === "allocate") {
      enabled("growth");
      const allocation = object(input.allocation), total = 3 * (p.level - 1);
      if (Object.keys(allocation).length !== 6 || Object.keys(allocation).some(key => !stats.includes(key as typeof stats[number]))) fail("INVALID_INPUT");
      if (input.mode !== undefined && !["auto", "manual"].includes(String(input.mode))) fail("INVALID_INPUT");
      for (const key of stats) {
        const amount = integer(allocation[key]);
        if (amount < p.allocation[key]) fail("ALLOCATION_IRREVERSIBLE");
        if (amount > Math.max(1, Math.floor(total * .4))) fail("ALLOCATION_CAP");
      }
      if (Object.values(allocation).reduce<number>((sum, n) => sum + Number(n), 0) > total) fail("INSUFFICIENT_POINTS");
      p.allocation = Object.fromEntries(stats.map(key => [key, Number(allocation[key])])) as KingAllocation;
      p.allocationMode = input.mode === "auto" ? "auto" : "manual";
      if (p.allocationMode === "auto") autoAllocate(p);
    } else if (kind === "chooseJob") {
      enabled("jobs");
      const job = text(input.job, /^(striker|defender|trickster|tracker|empath)$/) as NonNullable<KingProgress["job"]>;
      const tier = integer(input.tier, 1, 3); let cost: number;
      if (p.job === null || p.job === job) {
        if (tier !== p.jobTier + 1) fail("INVALID_TIER");
        const marks = store.certifications.filter(c => c.pet === pet && c.kind === "region");
        if (p.level < [0, 10, 30, 60][tier] || (tier === 1 && !marks.some(c => c.target === "R01"))
          || (tier === 2 && marks.length < 3) || (tier === 3 && marks.length < 6)) fail("PROMOTION_LOCKED");
        cost = [0, 0, 120, 300][tier];
      } else {
        if (tier !== p.jobTier) fail("INVALID_TIER");
        if (p.jobChangedAt && Date.parse(p.jobChangedAt) > now - 86400000) fail("JOB_COOLDOWN");
        cost = 300;
      }
      if (store.coins < cost) fail("INSUFFICIENT_COINS");
      store.coins -= cost; store.version++;
      if (p.job !== job) p.jobChangedAt = new Date(now).toISOString();
      p.job = job; p.jobTier = tier;
    } else if (kind === "equipMoves") {
      const moves = input.moves;
      if (!Array.isArray(moves) || moves.length > 24 || new Set(moves).size !== moves.length
        || moves.some(move => typeof move !== "string" || !/^[A-Za-z0-9_:-]{1,64}$/.test(move))) fail("INVALID_INPUT");
      if (Object.values(store.tickets).some(t => t.pet === pet && t.status === "active")) fail("BATTLE_ACTIVE");
      p.moves = clone(moves as string[]);
    } else if (kind === "buyItem") {
      enabled("items");
      const quantity = integer(input.quantity, 1), item = String(input.item), price = prices[item];
      if (!price) fail("INVALID_ITEM");
      if (store.coins < price * quantity) fail("INSUFFICIENT_COINS");
      store.coins -= price * quantity; store.version++;
      p.inventory[item] = (p.inventory[item] ?? 0) + quantity;
    } else if (kind === "start") {
      enabled("battles");
      const cell = text(input.cell, /^[A-J](10|[1-9])$/), individualId = text(input.individualId, /^[A-Za-z0-9_:-]{1,96}$/);
      const opponentName = typeof input.opponentName === "string" ? input.opponentName : "";
      if (!opponentName.trim() || opponentName.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(opponentName)) fail("INVALID_INPUT");
      const opponentRank = input.opponentRank as KingRank, opponentLevel = integer(input.opponentLevel, 1, 999);
      const band = integer(input.slot, 0, Number.MAX_SAFE_INTEGER), mode = input.mode ?? "normal";
      if (!ranks.includes(opponentRank) || !["normal", "raid"].includes(String(mode))) fail("INVALID_INPUT");
      if (band !== slot()) fail("SPAWN_EXPIRED");
      if (mode === "raid") { enabled("raids"); if (opponentRank !== "boss") fail("INVALID_INPUT"); }
      const matches = (entry: { slot: number; cell: string; individualId: string }) => entry.slot === band && entry.cell === cell && entry.individualId === individualId;
      if (mode === "normal" && store.departed.some(matches)) fail("SPAWN_DEPARTED");
      if (mode === "normal" && Object.values(store.tickets).some(t => t.status === "active" && t.input.mode !== "raid" && matches(t.input))) fail("SPAWN_BUSY");
      const items = object(input.items ?? {}), reserved: Record<string, number> = {}; let total = 0;
      for (const [item, raw] of Object.entries(items)) {
        const quantity = integer(raw, 1, 3); total += quantity;
        if (!prices[item]) fail("INVALID_ITEM");
        if ((p.inventory[item] ?? 0) < quantity) fail("INSUFFICIENT_ITEMS");
        reserved[item] = quantity;
      }
      if (total > 3) fail("ITEM_LIMIT");
      if (total > 0) enabled("items");
      for (const [item, quantity] of Object.entries(reserved)) p.inventory[item] -= quantity;
      const region = regionForCell(cell), raidKey = `${region}:${week()}`;
      if (mode === "raid") {
        store.raids[raidKey] ??= { region, week: week(), target: 4000 + 1000 * Number(region.slice(1)), progress: 0, completed: false };
        if (store.raids[raidKey].completed) fail("RAID_COMPLETE");
      }
      const id = uuid(++sequence), t: Ticket = { id, pet, seed: sequence, owner: nickname, nickname,
        input: { pet, cell, individualId, slot: band, opponentLevel, opponentRank, opponentName, mode: mode as "normal" | "raid" },
        region, week: week(), snapshot: before, reserved, status: "active", result: null,
        startedAt: new Date(now).toISOString(), expiresAt: new Date(now + 1800000).toISOString() };
      store.tickets[id] = t; p.version++;
      if (features.encyclopedia) {
        store.encounters[individualId] ??= { individualId, name: opponentName, encounters: 0, wins: 0, losses: 0, weaknesses: [], resistances: [] };
        store.encounters[individualId].encounters++;
      }
      return ticketJson(t);
    }
    p.version++;
    const after = petState(pet); store.changes.push({ kind, before, after });
    return after;
  }
  const rpc: KingRpc = async (name, args) => {
    if (name !== "domine_pet_king_v17") return { data: null, error: { code: "PGRST202", message: "Missing function" } };
    const reply = (code: string, data: unknown = null) => ({ ok: code === "OK", code, requestId: args.p_request_id, serverNow: new Date(now).toISOString(), data });
    const nickname = args.p_nickname.trim().normalize("NFC");
    if (!uuidPattern.test(args.p_request_id) || !/^[가-힣a-zA-Z0-9]{1,8}$/.test(nickname) || !/^[a-f0-9]{64}$/.test(args.p_secret))
      return { data: reply("INVALID_INPUT"), error: null };
    if (identities.get(nickname) !== args.p_secret) return { data: reply("AUTH_FAILED"), error: null };
    const key = `${nickname}:${args.p_request_id}`, payload = canonical(args.p_input), prior = operations.get(key);
    if (prior) return { data: clone(prior.kind === args.p_kind && prior.payload === payload ? prior.result : reply("REQUEST_CONFLICT")), error: null };
    expire();
    const before = clone(store); let result;
    try { result = reply("OK", dispatch(args.p_kind, object(args.p_input), nickname)); }
    catch (error) { store = before; result = reply(error instanceof Error ? error.message : "INVALID_INPUT"); }
    operations.set(key, { kind: args.p_kind, payload, result: clone(result) });
    return { data: clone(result), error: null };
  };
  return { rpc, slot, advance: (ms: number) => { now += ms; }, inspect: () => clone(store),
    register: (identity: { nickname: string; secret: string }) => { identities.set(identity.nickname.normalize("NFC"), identity.secret); } };
}
