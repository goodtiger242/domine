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
const { INDIVIDUALS } = loadTS("lib/domine/king/individuals.ts");
const aliases = new Map();
const startInput = (server, extra = {}) => {
  const alias = extra.individualId ?? "default";
  if (!aliases.has(alias)) aliases.set(alias, INDIVIDUALS[aliases.size].id);
  return { pet: 1, cell: "E1", slot: server.slot(), opponentLevel: 10, opponentRank: "resident", opponentName: "Bongdol",
    ...extra, individualId: aliases.get(alias) };
};
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
  assert.equal(failure.code, "INVALID_INPUT");
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
  assert.equal(s.pets[0].xp, 76); assert.equal(s.coins, 1006);
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
  const oldSlot = server.slot(); server.advance(3600000);
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
  assert.equal((await finish(api, server, t, { outcome: "draw" })).xp, 5);
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
  assert.equal(end.pets[0].xp, xpAfter + 80); assert.equal(end.pets[0].allocation.hp, 1);
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
  assert.equal(results.reduce((sum, r) => sum + ok(r).coins, 0), 130);
  assert.equal((await state(api)).coins, 1130);
  assert.equal((await state(api)).raids[0].completed, true);
  assert.equal((await state(api)).pets[0].xp, 1119);
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

test("v18 reward boundaries, all ranks, loss 30%, draw 40% and quit", async () => {
  for (const [opponentLevel, xp, coins] of [[6, 0, 0], [7, 21, 4], [10, 48, 6], [16, 105, 7], [17, 110, 7]]) {
    const { api, server } = setup({ xp: { 1: kingXpForLevel(10) } });
    const result = await finish(api, server, await start(api, server, { opponentLevel }));
    assert.equal(result.xp, xp, `level ${opponentLevel}`); assert.equal(result.coins, coins);
  }
  for (const [opponentRank, xp, coins] of [
    ["resident", 48, 6], ["veteran", 57, 7], ["lieutenant", 57, 7], ["chief", 72, 12],
    ["boss", 144, 30], ["gatekeeper", 192, 48], ["king", 288, 90], ["guest", 72, 12],
  ]) {
    const { api, server } = setup({ xp: { 1: kingXpForLevel(10) } });
    const result = await finish(api, server, await start(api, server, { opponentLevel: 10, opponentRank }));
    assert.equal(result.xp, xp, opponentRank); assert.equal(result.coins, coins, opponentRank);
  }
  for (const [outcome, xp] of [["lose", 9], ["draw", 12], ["quit", 0]]) {
    const { api, server } = setup({ xp: { 1: kingXpForLevel(10) } });
    const result = await finish(api, server, await start(api, server), { outcome });
    assert.equal(result.xp, xp); assert.equal(result.coins, 0); assert.equal(result.streak, 0);
  }
  for (const outcome of ["win", "draw", "lose", "quit"]) {
    const { api, server } = setup({ xp: { 1: kingXpForLevel(10) } });
    const result = await finish(api, server, await start(api, server, { opponentLevel: 6 }), { outcome });
    assert.equal(result.xp, 0); assert.equal(result.coins, 0);
  }
  const { api, server } = setup({ xp: { 1: kingXpForLevel(4) } });
  assert.equal((await finish(api, server, await start(api, server, { opponentLevel: 1 }), { outcome: "lose" })).xp, 2);
  assert.equal((await api.start(alice, id(), startInput(server, { opponentRank: "invented" }))).code, "INVALID_INPUT");
});

test("v18 first win is shared; streak belongs to each pet, caps at five and resets on loss/quit", async () => {
  const { api, server } = setup({ xp: { 1: kingXpForLevel(100), 2: kingXpForLevel(100) }, features: { encyclopedia: false, drops: false } });
  const fight = async (pet, outcome = "win", who = alice) => {
    server.advance(1800000);
    return finish(api, server, await start(api, server, { pet, opponentLevel: 100 }, who), { outcome }, who);
  };
  for (const [index, xp] of [318, 222, 233, 243, 265, 265].entries()) {
    const result = await fight(1, "win", index % 2 ? bob : alice);
    assert.equal(result.xp, xp); assert.equal(result.streak, index + 1);
    assert.equal(result.coins, index === 0 ? 33 : 22);
  }
  assert.equal((await fight(2, "win", bob)).xp, 212, "first-win bonus is shared across pets and players");
  assert.deepEqual((await state(api)).pets.map(p => p.streak), [6, 1]);
  const draw = await fight(1, "draw");
  assert.equal(draw.streak, 6); assert.equal(draw.xp, 106); assert.equal(draw.coins, 0);
  const loss = await fight(1, "lose");
  assert.equal(loss.streak, 0); assert.equal(loss.xp, 63);
  assert.equal((await fight(1)).xp, 212);
  const quit = await fight(1, "quit");
  assert.equal(quit.streak, 0); assert.equal(quit.xp, 0); assert.equal(quit.coins, 0);
  assert.equal((await state(api)).pets[1].streak, 1);
});

test("v18 pickup distribution over 10,000 intervals and deterministic placement", async t => {
  let found = 0, pouches = 0;
  for (let slot = 1; slot <= 10000; slot++) {
    const { api } = setup({ now: slot * 1800000 });
    const result = ok(await api.pickup(alice, id(), { cell: "E1", slot }));
    if (result.found) {
      found++; pouches += Number(result.pouch);
      assert.ok(result.coins >= (result.pouch ? 10 : 1) && result.coins <= (result.pouch ? 20 : 5));
    } else assert.deepEqual(result, { found: false, coins: 0, pouch: false });
    if (slot <= 20) {
      const other = setup({ now: slot * 1800000 });
      assert.deepEqual(ok(await other.api.pickup(bob, id(), { cell: "E1", slot })), result);
    }
  }
  t.diagnostic(`found=${found}/10000 (${found / 100}%), pouch=${pouches}/${found} (${(pouches / found * 100).toFixed(3)}%)`);
  assert.ok(found >= 1100 && found <= 1300);
  assert.ok(pouches / found >= .015 && pouches / found <= .025);
});

test("v18 pickups serialize across players, cache retries, validate slots and log once per request", async () => {
  const { api, server } = setup();
  let input, first, request;
  for (let i = 0; i < 100; i++) {
    input = { cell: `${String.fromCharCode(65 + Math.floor(i / 10))}${i % 10 + 1}`, slot: server.slot() };
    request = id(); first = await api.pickup(alice, request, input);
    if (ok(first).found) break;
  }
  assert.equal(ok(first).found, true);
  const before = server.inspect();
  assert.deepEqual(await api.pickup(alice, request, input), first);
  assert.deepEqual(server.inspect(), before);
  const repeats = await Promise.all(Array.from({ length: 20 }, () => api.pickup(bob, id(), input)));
  for (const reply of repeats) assert.deepEqual(ok(reply), { found: false, coins: 0, pouch: false });
  assert.equal(server.inspect().coins, before.coins);
  assert.equal(server.inspect().history.length, before.history.length + 20);
  assert.equal((await api.pickup(alice, request, { ...input, slot: input.slot + 1 })).code, "REQUEST_CONFLICT");
  for (const offset of [-1, 1]) ok(await api.pickup(bob, id(), { cell: "J10", slot: server.slot() + offset }));
  for (const slot of [server.slot() - 2, server.slot() + 2]) {
    const request = id(), input = { cell: "A1", slot };
    const rejection = await api.pickup(alice, request, input);
    assert.equal(rejection.code, "PICKUP_EXPIRED");
    assert.deepEqual(await api.pickup(alice, request, input), rejection);
  }
  for (const input of [{ cell: "K1", slot: server.slot() }, { cell: "A0", slot: server.slot() },
    { cell: "A1", slot: -1 }, { cell: "A1", slot: 1.5 }, { cell: "A1", slot: null }]) {
    assert.equal((await api.pickup(alice, id(), input)).code, "INVALID_INPUT");
  }
  assert.equal((await api.pickup({ ...alice, secret: bob.secret }, id(), input)).code, "AUTH_FAILED");
  server.advance(3600000);
  assert.deepEqual(await api.pickup(alice, request, input), first, "replay survives the slot window");
});

test("v18 SQL safety, no care rewards, preserved busy locks and capabilities", () => {
  const sql = readFileSync("supabase/migrations/20261112200000_domine_pet_v18_rewards.sql", "utf8");
  assert.equal((sql.match(/[^\x00-\x7f]/g) ?? []).length, 0);
  assert.doesNotMatch(sql, /#variable_conflict|(?:command_v6|domine_pet_king_v17|cmd)\s*\.\s*\w+/);
  const code = sql.replace(/--[^\n]*/g, "").replace(/'(?:''|[^'])*'/g, "''");
  assert.doesNotMatch(code, /\bdrop\b/i);
  const refs = [...code.replace(/revoke[^;]*;/gi, "").replace(/is distinct from/gi, "<>")
    .replace(/for update/gi, "").matchAll(/\b(?:from|join|into|update|table|references)\s+(?:if\s+not\s+exists\s+|strict\s+)?([a-z_][a-z_0-9.]*)/gi)]
    .map(m => m[1]).filter(ref => !ref.includes(".") && !ref.startsWith("v_") && !["if", "set"].includes(ref));
  assert.deepEqual(refs, [], "unqualified table references");
  for (const declaration of code.matchAll(/\bdeclare\s+([\s\S]*?)\bbegin\b/gi)) {
    for (const variable of declaration[1].split(";").map(x => x.trim()).filter(Boolean))
      assert.match(variable, /^v_\w+\s/, "all local variables use v_");
  }
  const functions = [...sql.matchAll(/create or replace function ([\w.]+)\([\s\S]*?\$\$;/g)];
  assert.deepEqual(functions.map(m => m[1]), ["domine_pet_v6.command_v6", "domine_pet_v17.pet_state", "public.domine_pet_king_v17", "public.domine_pet_capabilities_v6"]);
  for (const [body] of functions) assert.match(body, /set search_path=''/);
  const care = functions[0][0];
  assert.equal((care.match(/v_xp_gain:=0; v_coin_gain:=0;/g) ?? []).length, 3);
  assert.match(care, /v_level_coins:=0;/);
  assert.doesNotMatch(care, /v_coin_gain:=v_coin_gain\+|select x,c into|sum\(10\+2/);
  assert.match(care, /pg_advisory_xact_lock\(20261111,120000\)/);
  assert.match(care, /insert into domine_pet_v16\.busy/);
  assert.match(care, /public\.domine_pet_care_for/);
  assert.match(care, /domine_pet_v10\.log_v10/);
  assert.match(sql, /primary key\(slot,cell\)/);
  assert.match(sql, /on conflict\(slot,cell\) do nothing/);
  assert.match(sql, /pg_get_constraintdef/);
  assert.match(sql, /pg_get_expr/);
  assert.match(sql, /"busyLock":true,"king":true,"rewardsV18":true/);
  assert.match(sql, /begin;[\s\S]*commit;\s*$/);
});

test("v21 rejects fake/Lv999 opponents, caps level at +10 and accepts only adjacent slots", async () => {
  const { api, server } = setup();
  const input = startInput(server);
  for (const extra of [{ individualId: "invented", opponentLevel: 999, opponentRank: "king" },
    { opponentLevel: 999 }, { opponentLevel: 12 }, { individualId: "resident:B001:999" },
    { individualId: "resident:fake:000" }, { individualId: "N36" }]) {
    const reply = await api.start(alice, id(), { ...input, ...extra });
    assert.equal(reply.code, "INVALID_OPPONENT");
  }
  assert.equal((await api.start(alice, id(), { ...input, opponentRank: "fake" })).code, "INVALID_INPUT");
  assert.equal(server.inspect().coins, 1000); assert.equal(server.inspect().pets[1].xp, 0);
  for (const offset of [-1, 0, 1]) {
    const ticket = ok(await api.start(alice, id(), { ...input, slot: server.slot() + offset, opponentLevel: 11 }));
    await finish(api, server, ticket, { outcome: "quit" });
  }
  for (const offset of [-2, 2]) assert.equal((await api.start(alice, id(), { ...input, slot: server.slot() + offset })).code, "SPAWN_EXPIRED");
  const ticket = await start(api, server);
  const result = await finish(api, server, ticket, { xp: 28944, coins: 4522, opponentLevel: 999, opponentRank: "king" });
  assert.equal(result.xp, 76); assert.equal(result.coins, 6, "client reward fields never change the ticket reward");
});

test("v21 polling is read-only and malformed nested responses are rejected", async () => {
  const { api, server } = setup();
  const before = server.inspect(), operations = server.operationCount();
  await Promise.all(Array.from({length:20},()=>api.state(alice)));
  assert.deepEqual(server.inspect(), before); assert.equal(server.operationCount(), operations);
  for (const extra of [{ pets: {} }, { tickets: [null] }, { pets: [{ pet:1, xp:0 }] }, { inventory: null, pets: [{ inventory: null }] }, { watching: [null] }]) {
    const broken = createKingApi(async (name,args) => {
      const reply = await server.rpc(name,args); reply.data.data = { ...reply.data.data, ...extra }; return reply;
    });
    await assert.rejects(broken.state(alice), /INVALID_RESPONSE/);
  }
  const legacy = createKingApi(async (name,args) => {
    const reply = await server.rpc(name,args); delete reply.data.data.resetEpoch; return reply;
  });
  assert.ok((await legacy.state(alice)).ok, "v20 snapshots without an epoch still work");
});

test("v21 SQL validates persisted tickets, bounds rewards, uses battle A30 and does not reset data", () => {
  const sql=readFileSync("supabase/migrations/20261112500000_domine_pet_v21_settlement.sql","utf8");
  assert.equal(/[^\x00-\x7f]/.test(sql),false);
  assert.match(sql,/^begin;[\s\S]*commit;\s*$/);
  assert.doesNotMatch(sql,/\bdrop\s+(?:table|function|schema)|\bdelete\s+from/i);
  assert.doesNotMatch(sql,/(?:domine_pet_king_v17|valid_opponent|badges_v6)[.]v_/);
  assert.match(sql,/p_level not between 1 and least\(999,p_player_level\+10\)/);
  assert.match(sql,/not domine_pet_v17.valid_opponent\(v_ticket.individual_id/);
  assert.match(sql,/v_xp:=least\(v_xp/); assert.match(sql,/v_coins:=least\(v_coins/);
  assert.match(sql,/domine_pet_v17.level_for_xp\(xp\)>=30/);
  assert.match(sql,/perform domine_pet_v6.badges_v6\(v_player.id\)/);
  assert.match(sql,/reset_epoch text not null default/);
  const readPath=sql.slice(sql.indexOf("if p_kind in ('state','spawns','watching')"),sql.indexOf("select w.* into strict v_wallet"));
  assert.ok(readPath.indexOf("return pg_catalog.jsonb_build_object('ok',true")<readPath.indexOf("for update"));
  assert.doesNotMatch(readPath,/expire_tickets|insert into/);
  const { BREEDS } = loadTS("lib/domine/king/species.ts");
  const seeded=sql.match(/v_breeds text\[\]:=array\[([^\]]+)\]/)[1].match(/'[^']+'/g).map(s=>s.slice(1,-1));
  assert.deepEqual(seeded,BREEDS.map(b=>b.id),"server pool seed ranges match the client, including appended guests");
  for (const declaration of sql.matchAll(/\bdeclare\s+([\s\S]*?)\bbegin\b/gi))
    for (const variable of declaration[1].split(';').map(s=>s.trim()).filter(Boolean)) assert.match(variable,/^v_\w+\s/);
  for (const body of sql.matchAll(/create or replace function [\s\S]*?\$\$;/g)) assert.match(body[0],/set search_path=''/);
});
