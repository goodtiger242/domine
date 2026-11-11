import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTS } from "./pet-test-loader.mjs";

const { createKingApi } = loadTS("lib/domine/pet-king-rpc.ts");
const { createKingMock, kingXpForLevel, kingLevelForXp } = loadTS("tests/pet/king-mock.ts");
const alice = { nickname: "Alice", secret: "a".repeat(64) }, bob = { nickname: "Bob", secret: "b".repeat(64) };
let sequence = 10000;
const id = () => `10000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
const zero = { hp: 0, attack: 0, defense: 0, speed: 0, focus: 0, calm: 0 };
function setup(options = {}) {
  const server = createKingMock({ features: { drops: false }, ...options });
  server.register(alice); server.register(bob);
  return { server, api: createKingApi(server.rpc) };
}
const ok = result => { assert.equal(result.supported, true); assert.equal(result.code, "OK"); assert.equal(result.ok, true); return result.data; };
const startInput = (server, extra = {}) => ({ pet: 1, cell: "E1", individualId: "resident:B001:01",
  slot: server.slot(), opponentLevel: 10, opponentRank: "resident", opponentName: "Bongdol", ...extra });
async function state(api, who = alice) { return ok(await api.state(who, id())); }
async function start(api, server, extra = {}, who = alice) { return ok(await api.start(who, id(), startInput(server, extra))); }
async function finish(api, server, ticket, extra = {}, who = alice) {
  server.advance(12000);
  return ok(await api.finish(who, id(), { ticket: ticket.id, outcome: "win", rounds: 6, ...extra }));
}

test("XP curve: every boundary, cap and excess XP", () => {
  assert.equal(kingXpForLevel(1), 0); assert.equal(kingXpForLevel(10), 756);
  assert.equal(kingXpForLevel(30), 6236); assert.equal(kingXpForLevel(999), 44700430);
  for (let level = 2; level <= 999; level++) {
    assert.equal(kingLevelForXp(kingXpForLevel(level) - 1), level - 1);
    assert.equal(kingLevelForXp(kingXpForLevel(level)), level);
  }
  assert.equal(kingLevelForXp(kingXpForLevel(999) + 1000000), 999);
});

test("allocation is irreversible, capped, versioned and budgeted", async () => {
  const { api } = setup({ xp: { 1: kingXpForLevel(10) }, allocationMode: "manual" });
  const allocation = { ...zero, hp: 10 };
  const first = ok(await api.allocate(alice, id(), { pet: 1, expectedVersion: 0, allocation }));
  assert.equal(first.unspent, 17);
  assert.equal((await api.allocate(bob, id(), { pet: 1, expectedVersion: 0, allocation })).code, "VERSION_CONFLICT");
  assert.equal((await api.allocate(alice, id(), { pet: 1, expectedVersion: 1, allocation: { ...zero, hp: 9 } })).code, "ALLOCATION_IRREVERSIBLE");
  assert.equal((await api.allocate(alice, id(), { pet: 1, expectedVersion: 1, allocation: { ...zero, hp: 11 } })).code, "ALLOCATION_CAP");
  assert.equal((await api.allocate(alice, id(), { pet: 1, expectedVersion: 1, allocation: { ...zero, hp: 10, attack: 10, defense: 10 } })).code, "INSUFFICIENT_POINTS");
  const auto = ok(await api.allocate(alice, id(), { pet: 1, expectedVersion: 1, allocation, mode: "auto" }));
  assert.equal(auto.unspent, 0); assert.equal(auto.allocation.hp, 10);
  assert.ok(Object.values(auto.allocation).every(n => n <= 10));
});

test("request replay, changed payload conflict and missing RPC fallback", async () => {
  const { api, server } = setup();
  const request = id(), input = { pet: 1, item: "P01", quantity: 2 };
  const a = await api.buyItem(alice, request, input);
  assert.deepEqual(await api.buyItem(alice, request, { quantity: 2, item: "P01", pet: 1 }), a);
  assert.equal((await api.buyItem(alice, request, { ...input, quantity: 1 })).code, "REQUEST_CONFLICT");
  assert.equal(server.inspect().coins, 970);
  const rejected = id(), noCoins = { pet: 1, item: "P01", quantity: 999 };
  const failure = await api.buyItem(alice, rejected, noCoins);
  assert.equal(failure.code, "INSUFFICIENT_COINS");
  assert.deepEqual(await api.buyItem(alice, rejected, noCoins), failure);
  const missing = createKingApi(async () => ({ data: null, error: { code: "PGRST202", message: "not installed" } }));
  assert.deepEqual(await missing.state(alice, id()), { supported: false, ok: false, code: "UNSUPPORTED" });
  const broken = createKingApi(async () => ({ data: null, error: { code: "42501", message: "denied" } }));
  await assert.rejects(broken.state(alice, id()), /42501/);
  const invalid = createKingApi(async () => ({ data: {}, error: null }));
  await assert.rejects(invalid.state(alice, id()), /INVALID_RESPONSE/);
});

test("twenty duplicate finishes pay once; ticket ownership and elapsed time", async () => {
  const { server, api } = setup();
  const ticket = await start(api, server), input = { ticket: ticket.id, outcome: "win", rounds: 6, moveCounts: { push: 6 } };
  assert.equal((await api.finish(bob, id(), input)).code, "TICKET_NOT_FOUND");
  const earlyId = id(), early = await api.finish(alice, earlyId, input);
  assert.equal(early.code, "TOO_EARLY");
  server.advance(6000);
  assert.deepEqual(await api.finish(alice, earlyId, input), early);
  const results = await Promise.all(Array.from({ length: 20 }, () => api.finish(alice, id(), input)));
  for (const result of results) assert.deepEqual(ok(result), ok(results[0]));
  const s = await state(api);
  assert.equal(s.pets[0].xp, 32); assert.equal(s.coins, 1002);
  assert.equal(s.pets[0].mastery.push, 3);
  assert.equal(server.inspect().history.filter(h => h.kind === "battle").length, 1);
  assert.equal(ok(await api.ranking(bob, id()))[0].wins, 1);
});

test("spawn claims and departures are shared across people and pets, expire by interval", async () => {
  const { server, api } = setup();
  const ticket = await start(api, server);
  assert.equal((await api.start(bob, id(), startInput(server, { pet: 2 }))).code, "SPAWN_BUSY");
  await finish(api, server, ticket);
  const shared = ok(await api.spawns(bob, id()));
  assert.equal(shared.departed.length, 1);
  assert.equal((await api.start(bob, id(), startInput(server, { pet: 2 }))).code, "SPAWN_DEPARTED");
  const oldSlot = server.slot(); server.advance(1800000);
  assert.deepEqual(ok(await api.spawns(bob, id())).departed, []);
  assert.equal((await api.start(bob, id(), startInput(server, { slot: oldSlot }))).code, "SPAWN_EXPIRED");
  assert.ok((await start(api, server, { pet: 2 }, bob)).id);
});

test("inventory purchase, reservation, consumption, quit and lazy expiration", async () => {
  const { server, api } = setup();
  ok(await api.buyItem(alice, id(), { pet: 1, item: "P01", quantity: 5 }));
  const tooMany = await api.start(alice, id(), startInput(server, { items: { P01: 4 } }));
  assert.equal(tooMany.code, "INVALID_INPUT");
  const ticket = await start(api, server, { items: { P01: 3 } });
  assert.equal((await state(api)).pets[0].inventory.P01, 2);
  assert.equal((await api.start(bob, id(), startInput(server, { individualId: "other", items: { P01: 3 } }))).code, "INSUFFICIENT_ITEMS");
  server.advance(6000);
  assert.equal((await api.finish(alice, id(), { ticket: ticket.id, outcome: "win", rounds: 6, usedItems: { P02: 1 } })).code, "ITEM_NOT_RESERVED");
  assert.equal((await state(api)).pets[0].inventory.P01, 2);
  await finish(api, server, ticket, { usedItems: { P01: 2 } });
  assert.equal((await state(api)).pets[0].inventory.P01, 3);
  const quit = await start(api, server, { individualId: "quit", items: { P01: 2 } });
  const quitResult = await finish(api, server, quit, { outcome: "quit", usedItems: { P01: 1 } });
  assert.equal(quitResult.xp, 0); assert.equal((await state(api)).pets[0].inventory.P01, 2);
  const expires = await start(api, server, { individualId: "expires", items: { P01: 2 } });
  assert.equal((await state(api)).pets[0].inventory.P01, 0);
  server.advance(1800000);
  assert.equal((await api.finish(alice, id(), { ticket: expires.id, outcome: "win", rounds: 6 })).code, "EXPIRED");
  assert.equal((await state(api)).pets[0].inventory.P01, 2);
  assert.equal((await state(api)).pets[0].inventory.P01, 2);
  assert.equal((await state(api)).pets[1].inventory.P01, undefined);
});

test("loss/draw keep spawn, weak opponent gives no rewards or mastery", async () => {
  const { server, api } = setup({ xp: { 1: kingXpForLevel(10) } });
  let t = await start(api, server, { opponentLevel: 6 });
  const weak = await finish(api, server, t, { moveCounts: { push: 6 } });
  assert.equal(weak.xp, 0); assert.equal(weak.coins, 0); assert.equal(weak.eligible, false);
  assert.equal((await state(api)).pets[0].mastery.push, undefined);
  t = await start(api, server, { individualId: "retry", opponentLevel: 7 });
  assert.equal((await finish(api, server, t, { outcome: "lose" })).xp, 4);
  t = await start(api, server, { individualId: "retry", opponentLevel: 7 });
  assert.equal((await finish(api, server, t, { outcome: "draw" })).xp, 6);
  assert.equal(ok(await api.spawns(alice, id())).departed.length, 1);
});

test("starting snapshot remains frozen; independent finishes add to latest XP", async () => {
  const { server, api } = setup({ xp: { 1: kingXpForLevel(2) - 1 }, allocationMode: "manual" });
  ok(await api.equipMoves(alice, id(), { pet: 1, expectedVersion: 0, moves: ["T01"] }));
  const a = await start(api, server), b = await start(api, server, { individualId: "second" }, bob);
  assert.equal((await api.equipMoves(alice, id(), { pet: 1, expectedVersion: 3, moves: [] })).code, "BATTLE_ACTIVE");
  await finish(api, server, a, { moveCounts: { T01: 6 }, weaknesses: ["contact"], resistances: ["sound"] });
  const after = await state(api), xpAfter = after.pets[0].xp;
  ok(await api.allocate(alice, id(), { pet: 1, expectedVersion: after.pets[0].version, allocation: { ...zero, hp: 1 } }));
  await finish(api, server, b, { moveCounts: { T01: 3 } }, bob);
  const end = await state(api);
  assert.equal(end.pets[0].xp, xpAfter + 32); assert.equal(end.pets[0].allocation.hp, 1);
  assert.equal(server.inspect().tickets[b.id].snapshot.level, 1);
  assert.equal(server.inspect().tickets[b.id].snapshot.allocation.hp, 0);
  assert.equal(end.pets[0].mastery.T01, 6);
  assert.deepEqual(end.encyclopedia[0].weaknesses, ["contact"]);
  assert.equal(server.inspect().changes.filter(c => c.kind === "levelup").length >= 1, true);
});

test("watching lasts three minutes; state never discloses other people's tickets", async () => {
  const { server, api } = setup();
  await start(api, server);
  assert.equal(ok(await api.watching(bob, id()))[0].nickname, alice.nickname);
  assert.equal((await state(api, bob)).tickets.length, 0);
  server.advance(180000);
  assert.deepEqual(ok(await api.watching(bob, id())), []);
  assert.equal((await state(api)).tickets.length, 1);
});

test("discovered tags cannot change or contradict previous discoveries", async () => {
  const { server, api } = setup();
  const first = await start(api, server);
  await finish(api, server, first, { outcome: "lose", moveCounts: { push: 1 }, weaknesses: ["contact"] });
  const second = await start(api, server);
  server.advance(6000);
  for (const tags of [{ weaknesses: ["sound"] }, { resistances: ["contact"] }]) {
    assert.equal((await api.finish(alice, id(), { ticket: second.id, outcome: "win", rounds: 6,
      moveCounts: { push: 1 }, ...tags })).code, "TAG_CONFLICT");
  }
  assert.equal(server.inspect().tickets[second.id].status, "active");
});

test("job certifications, costs, cooldown and preserved tier/mastery", async () => {
  const { server, api } = setup({ xp: { 1: kingXpForLevel(60) }, coins: 1000 });
  assert.equal((await api.chooseJob(alice, id(), { pet: 1, expectedVersion: 0, job: "defender", tier: 1 })).code, "PROMOTION_LOCKED");
  for (const cell of ["E1", "C1", "G1", "I1", "A1", "C6"]) {
    const t = await start(api, server, { cell, individualId: `boss:${cell}`, opponentRank: "boss", opponentLevel: 60 });
    await finish(api, server, t, { moveCounts: { push: 3 } });
  }
  const choose = async (job, tier) => api.chooseJob(alice, id(), { pet: 1, expectedVersion: (await state(api)).pets[0].version, job, tier });
  ok(await choose("defender", 1));
  assert.equal((await choose("striker", 1)).code, "JOB_COOLDOWN");
  const coins = (await state(api)).coins;
  ok(await choose("defender", 2)); ok(await choose("defender", 3));
  assert.equal((await state(api)).coins, coins - 420);
  server.advance(86400000);
  const changed = ok(await choose("striker", 3));
  assert.equal(changed.jobTier, 3); assert.equal(changed.mastery.push, 18);
  assert.equal((await state(api)).coins, coins - 720);
});

test("weekly raids off by default, once-only shared completion and no carry into next week", async () => {
  const disabled = setup();
  assert.equal((await disabled.api.start(alice, id(), startInput(disabled.server, { mode: "raid", opponentRank: "boss" }))).code, "FEATURE_DISABLED");
  const { server, api } = setup({ features: { raids: true, drops: false } });
  const tickets = await Promise.all(Array.from({ length: 6 }, () => start(api, server, { mode: "raid", opponentRank: "boss" })));
  server.advance(6000);
  const results = await Promise.all(tickets.map(t => api.finish(alice, id(), { ticket: t.id, outcome: "win", rounds: 6, remainingHp: 0, maxHp: 100 })));
  assert.equal(results.reduce((sum, r) => sum + ok(r).contribution, 0), 5000);
  assert.equal(results.reduce((sum, r) => sum + ok(r).coins, 0), 50);
  assert.equal((await state(api)).coins, 1050);
  assert.equal((await state(api)).raids[0].completed, true);
  assert.equal((await state(api)).pets[0].xp, 0);
  server.advance(7 * 86400000);
  assert.deepEqual((await state(api)).raids, []);
  assert.equal(ok(await api.ranking(alice, id())).length, 0);
  await start(api, server, { mode: "raid", opponentRank: "boss" });
  assert.equal((await state(api)).raids[0].progress, 0);
});

test("invalid numbers, auth, action budgets and transactional rejection", async () => {
  const { server, api } = setup();
  assert.equal((await api.state({ ...alice, secret: bob.secret }, id())).code, "AUTH_FAILED");
  assert.equal((await api.start(alice, id(), startInput(server, { opponentLevel: 1000 }))).code, "INVALID_INPUT");
  assert.equal((await api.buyItem(alice, id(), { pet: 1, item: "061", quantity: 1 })).code, "INVALID_ITEM");
  const t = await start(api, server);
  server.advance(12000);
  for (const extra of [{ rounds: 61 }, { moveCounts: { push: 4, rest: 3 } }, { weaknesses: ["contact"] }]) {
    const result = await api.finish(alice, id(), { ticket: t.id, outcome: "win", rounds: 6, ...extra });
    assert.equal(result.ok, false);
    assert.equal(server.inspect().tickets[t.id].status, "active");
    assert.equal(server.inspect().pets[1].xp, 0); assert.equal(server.inspect().coins, 1000);
  }
});

test("SQL static invariants, seed prices and public dispatch coverage", () => {
  const sql = readFileSync("supabase/migrations/20261112100000_domine_pet_v17_king.sql", "utf8");
  assert.equal((sql.match(/[^\x00-\x7f]/g) ?? []).length, 0, "ASCII only, including comments");
  assert.doesNotMatch(sql, /#variable_conflict|(?:domine_pet_king_v17|command_v6)\s*\.\s*\w+/);
  assert.doesNotMatch(sql, /create or replace function domine_pet_v6\.(command_v6|snapshot_v6)/i);
  assert.doesNotMatch(sql, /\b(?:drop\s+(?:table|schema|function)|rate_v6)\b/i);
  const statements = sql.replace(/--[^\n]*/g, "").replace(/revoke[^;]*;/gi, "")
    .replace(/is distinct from/gi, "<>").replace(/for update/gi, "");
  const refs = [...statements.matchAll(/\b(?:from|join|into|update|table)\s+(?:strict\s+)?([a-z_][a-z_0-9.]*)/gi)]
    .map(m => m[1]).filter(ref => !ref.includes(".") && !ref.startsWith("v_")
      && !["if", "set"].includes(ref.toLowerCase()));
  assert.deepEqual(refs, [], "persistent table references must be qualified");
  assert.match(sql, /begin;[\s\S]*commit;\s*$/);
  assert.match(sql, /'king':?true|"king":true/);
  assert.match(sql, /"busyLock":true/);
  assert.match(sql, /"raids":false/);
  for (const kind of ["state", "start", "finish", "allocate", "chooseJob", "equipMoves", "buyItem", "spawns", "watching", "ranking"])
    assert.ok(sql.includes(`p_kind='${kind}'`), kind);
  assert.match(sql, /return v_result;/);
  assert.match(sql, /grant execute on function public\.domine_pet_king_v17/);
  const seededPrices = [...sql.matchAll(/\('(P\d{2})',(\d+)\)/g)].map(([, item, price]) => [item, Number(price)]);
  assert.deepEqual(seededPrices.map(([, price]) => price), [15, 35, 70, 12, 30, 25, 25, 25, 25, 20, 30, 40, 35, 60]);
});
