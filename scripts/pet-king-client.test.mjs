import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { loadTS } from "./pet-test-loader.mjs";

const { createKingMock, kingXpForLevel } = loadTS("tests/pet/king-mock.ts");
const { createKingApi } = loadTS("lib/domine/pet-king-rpc.ts");
const { createKingBattle, recoverKingBattles, createKingPickup, departedWins, kingProgress, kingRank, kingRewardLine, watchingLine } = loadTS("lib/domine/pet-king-client.ts");
const { spawnsFor } = loadTS("lib/domine/pet-battle-view.ts");
const { NAMED } = loadTS("lib/domine/king/named.ts");
const identity = { nickname: "김경석", secret: "a".repeat(64) };
const memoryStorage = () => {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k), values };
};
function reloadedClient() {
  const exports = {};
  const source = ts.transpileModule(readFileSync("lib/domine/pet-king-client.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "exports", source)(name => loadTS(`lib/domine/${name.slice(2)}.ts`), exports);
  return exports;
}
function fixture(options = {}) {
  const mock = createKingMock(options); mock.register(identity);
  const api = createKingApi(mock.rpc);
  const encounter = Array.from({ length: 100 }, (_, i) => `${String.fromCharCode(65 + i % 10)}${Math.floor(i / 10) + 1}`)
    .flatMap(cell => spawnsFor(cell, 1, mock.slot())).find(e => e.level < 10);
  assert.ok(encounter);
  return { mock, api, encounter };
}

test("server settlement supplies XP, coins, first win, streak and new level", async () => {
  const { mock, api, encounter } = fixture({ xp: { 1: 35 } });
  const session = createKingBattle(api, identity, 1, encounter);
  await session.start(); mock.advance(10000);
  const input = { outcome: "win", rounds: 2, moveCounts: { M001: 1 }, usedItems: {} };
  const result = await session.finish(input);
  assert.ok(result.settlement.xp > 0); assert.ok(result.settlement.coins > 0);
  assert.ok(result.settlement.levelAfter > result.settlement.levelBefore);
  const line = kingRewardLine(result.settlement, true);
  assert.ok(line.includes(`경험치 +${result.settlement.xp}`)); assert.ok(line.includes("첫 승리!")); assert.ok(line.includes("Lv."));
  assert.ok(kingRewardLine({ ...result.settlement, streak: 3 }, true).includes("3연승"));
  assert.equal((await session.finish(input)).settlement, result.settlement, "one settlement per attempt");
  assert.equal(mock.inspect().history.filter(h => h.kind === "battle").length, 1);
  const state = await api.state(identity), pet = state.data.pets[0];
  assert.equal(pet.xp, 35 + result.settlement.xp);
  assert.deepEqual(kingProgress(pet.xp, pet.level), { level: pet.level, value: pet.xp,
    current: pet.xp - kingXpForLevel(pet.level), needed: kingXpForLevel(pet.level + 1) - kingXpForLevel(pet.level) });
});

test("quit earns zero and keeps the opponent; a completed loss earns XP", async () => {
  for (const outcome of ["quit", "lose", "draw"]) {
    const { mock, api, encounter } = fixture();
    const session = createKingBattle(api, identity, 1, encounter);
    await session.start(); mock.advance(10000);
    const { settlement } = await session.finish({ outcome, rounds: outcome === "quit" ? 0 : 2 });
    assert.equal(settlement.coins, 0);
    if (outcome === "quit") { assert.equal(settlement.xp, 0); assert.equal(kingRewardLine(settlement), ""); }
    else assert.ok(settlement.xp > 0);
    assert.equal(mock.inspect().departed.length, 0);
  }
});

test("lost start and finish responses retry the identical request once", async () => {
  const { mock, encounter } = fixture(), calls = [];
  const api = createKingApi(async (name, args) => {
    calls.push(structuredClone(args));
    const reply = await mock.rpc(name, args);
    if (calls.filter(c => c.p_kind === args.p_kind).length === 1) throw Error("lost response");
    return reply;
  });
  const session = createKingBattle(api, identity, 1, encounter);
  await session.start(); mock.advance(10000);
  const result = await session.finish({ outcome: "win", rounds: 2 });
  assert.ok(result.settlement);
  assert.deepEqual(calls[0], calls[1]); assert.deepEqual(calls[2], calls[3]);
  assert.equal(Object.keys(mock.inspect().tickets).length, 1);
  assert.equal(mock.inspect().history.filter(h => h.kind === "battle").length, 1);
});

test("brought items are reserved and only used quantities are consumed", async () => {
  const { mock, api, encounter } = fixture();
  await api.buyItem(identity, crypto.randomUUID(), { pet: 1, item: "P01", quantity: 2 });
  const session = createKingBattle(api, identity, 1, encounter, ["P01", "P01"]);
  const ticket = await session.start(); assert.deepEqual(ticket.data.reserved, { P01: 2 });
  mock.advance(10000);
  const result = await session.finish({ outcome: "lose", rounds: 2, usedItems: { P01: 1 }, moveCounts: { push: 1 } });
  assert.ok(result.settlement); assert.equal(mock.inspect().pets[1].inventory.P01, 1);
});

test("unsupported, offline and TOO_EARLY produce one quiet line", async () => {
  const { api, encounter } = fixture();
  for (const broken of [createKingApi(async () => ({ error: { code: "PGRST202" } })), createKingApi(async () => { throw Error("offline"); })]) {
    const result = await createKingBattle(broken, identity, 1, encounter).finish({ outcome: "win", rounds: 1 });
    assert.equal(result.settlement, undefined); assert.ok(result.notice); assert.equal(result.notice.includes("\n"), false);
  }
  const result = await createKingBattle(api, identity, 1, encounter).finish({ outcome: "win", rounds: 60 });
  assert.equal(result.settlement, undefined); assert.ok(result.notice);
});

test("named ranks follow hierarchy and ordinary intelligence maps to server enum", () => {
  const { encounter } = fixture();
  for (const named of NAMED) assert.equal(kingRank({ ...encounter, individual: named }),
    { "cell-chief": "chief", "region-boss": "boss", gatekeeper: "gatekeeper", king: "king" }[named.rank]);
  for (const [intelligence, rank] of Object.entries({ 순둥이: "resident", 보통: "resident", 노련: "veteran", 대장: "chief" }))
    assert.equal(kingRank({ ...encounter, individual: { ...encounter.individual, intelligence } }), rank);
});

test("pickup once per cell/slot, across remounts and lost responses", async () => {
  const { mock } = fixture(); let calls = 0; const requests = [], saved = new Map();
  const storage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) };
  const api = createKingApi(async (name, args) => {
    calls++; requests.push(args); const result = await mock.rpc(name, args);
    if (calls === 1) throw Error("lost"); return result;
  });
  const claim = createKingPickup();
  const [first, duplicate] = await Promise.all([claim(api, identity, "F5", mock.slot(), storage), claim(api, identity, "F5", mock.slot(), storage)]);
  assert.ok(first); assert.equal(duplicate, null); assert.equal(calls, 2); assert.deepEqual(requests[0], requests[1]);
  assert.equal(await createKingPickup()(api, identity, "F5", mock.slot(), storage), null);
  assert.equal(calls, 2);
  mock.advance(1800000); await claim(api, identity, "F5", mock.slot(), storage); assert.equal(calls, 3);
});

test("watching is one local line, excludes self, expires exactly at three minutes", () => {
  const now = Date.now(), entry = { nickname: "친구", pet: 1, cell: "F5", opponentName: "보리", startedAt: new Date(now).toISOString() };
  assert.ok(watchingLine([entry, entry], "F5", identity.nickname, now + 179999).includes("도미로"));
  assert.equal(watchingLine([entry], "F5", identity.nickname, now + 180000), "");
  assert.equal(watchingLine([entry], "F5", "친구", now), "");
});

test("reload recovers a committed finish whose replies and reconciliation were lost", async () => {
  const { mock, api, encounter } = fixture(), storage = memoryStorage(), requests = [];
  await api.buyItem(identity, crypto.randomUUID(), { pet: 1, item: "P01", quantity: 2 });
  const broken = { ...api, finish: async (...args) => { requests.push(args[1]); await api.finish(...args); throw Error("lost"); }, state: async () => { throw Error("offline"); } };
  const battle = createKingBattle(broken, identity, 1, encounter, ["P01", "P01"], storage);
  await battle.start(); mock.advance(10000);
  assert.equal((await battle.finish({ outcome: "win", rounds: 2, usedItems: { P01: 1 } })).settlement, undefined);
  const committed = mock.inspect();
  const recovered = await reloadedClient().recoverKingBattles(api, identity, (await api.state(identity)).data, storage);
  assert.equal(recovered.results[0].outcome, "win"); assert.equal(recovered.results[0].wallet.coins, committed.coins);
  assert.equal(mock.inspect().pets[1].inventory.P01, 1);
  assert.equal(mock.inspect().history.filter(h => h.kind === "battle").length, 1);
  assert.equal(new Set(requests).size, 1);
  assert.equal(storage.getItem(`domine-pet-battle:${identity.nickname}:1`), null);
  assert.equal((await recoverKingBattles(api, identity, (await api.state(identity)).data, storage)).results.length, 0);
});

test("offline finish is replayed on return with the original ID and payload", async () => {
  const { mock, api, encounter } = fixture(), storage = memoryStorage(), requests = [];
  const broken = { ...api, finish: async (...args) => { requests.push(args); throw Error("offline"); }, state: async () => { throw Error("offline"); } };
  const battle = createKingBattle(broken, identity, 1, encounter, [], storage);
  await battle.start(); mock.advance(10000);
  await battle.finish({ outcome: "win", rounds: 2, moveCounts: { push: 2 } });
  assert.equal(mock.inspect().history.length, 0);
  const recording = { ...api, finish: async (...args) => { requests.push(args); return api.finish(...args); } };
  const recovered = await reloadedClient().recoverKingBattles(recording, identity, (await api.state(identity)).data, storage);
  assert.ok(recovered.results[0].xp > 0); assert.deepEqual(requests[0], requests.at(-1));
  assert.equal(mock.inspect().history.filter(h => h.kind === "battle").length, 1);
});

test("lost start is recovered after reload; abandoned reservation is returned once", async () => {
  const { mock, api, encounter } = fixture(), storage = memoryStorage();
  await api.buyItem(identity, crypto.randomUUID(), { pet: 1, item: "P01", quantity: 2 });
  const broken = { ...api, start: async (...args) => { await api.start(...args); throw Error("lost start"); } };
  await createKingBattle(broken, identity, 1, encounter, ["P01", "P01"], storage).start();
  assert.equal(mock.inspect().pets[1].inventory.P01, 0);
  const recovered = await reloadedClient().recoverKingBattles(api, identity, (await api.state(identity)).data, storage);
  assert.equal(recovered.results[0].outcome, "quit"); assert.equal(mock.inspect().pets[1].inventory.P01, 2);
  await recoverKingBattles(api, identity, (await api.state(identity)).data, storage);
  assert.equal(mock.inspect().pets[1].inventory.P01, 2); assert.equal(Object.keys(mock.inspect().tickets).length, 1);
});

test("lost start followed by a completed battle preserves the win for recovery", async () => {
  const { mock, api, encounter } = fixture(), storage = memoryStorage();
  const broken = { ...api, start: async (...args) => { await api.start(...args); throw Error("lost start"); } };
  const battle = createKingBattle(broken, identity, 1, encounter, [], storage);
  await battle.start(); mock.advance(10000); await battle.finish({ outcome: "win", rounds: 2 });
  const recovered = await reloadedClient().recoverKingBattles(api, identity, (await api.state(identity)).data, storage);
  assert.equal(recovered.results[0].outcome, "win"); assert.equal(Object.keys(mock.inspect().tickets).length, 1);
});

test("expired tickets remain discoverable and release untracked reservations once", async t => {
  const { mock, api, encounter } = fixture();
  await api.buyItem(identity, crypto.randomUUID(), { pet: 1, item: "P01", quantity: 1 });
  await api.start(identity, crypto.randomUUID(), { pet:1, cell:encounter.cellId, individualId:encounter.individual.id,
    slot:mock.slot(), opponentLevel:encounter.level, opponentRank:kingRank(encounter), opponentName:encounter.name, items:{P01:1} });
  mock.advance(1800001);
  const state=(await api.state(identity)).data;
  assert.equal(state.tickets.length,1); assert.equal(state.pets[0].inventory.P01,0,"reads do not mutate reservations");
  t.mock.method(Date,"now",()=>Date.parse(state.tickets[0].expiresAt)+1);
  assert.equal((await reloadedClient().recoverKingBattles(api,identity,state,memoryStorage())).changed,true);
  assert.equal(mock.inspect().pets[1].inventory.P01,1);
  await recoverKingBattles(api,identity,(await api.state(identity)).data,memoryStorage());
  assert.equal(mock.inspect().pets[1].inventory.P01,1);
});

test("failed pickup remains retryable across reload and marks completion only on success", async () => {
  const { mock, api } = fixture(), storage = memoryStorage(), requests = [];
  const offline = { ...api, pickup: async (...args) => { requests.push(args); throw Error("offline"); } };
  assert.equal(await createKingPickup()(offline, identity, "F5", mock.slot(), storage), null);
  assert.ok([...storage.values.values()].every(v => v.startsWith("pending:")));
  const recording = { ...api, pickup: async (...args) => { requests.push(args); return api.pickup(...args); } };
  assert.ok(await createKingPickup()(recording, identity, "F5", mock.slot(), storage));
  assert.deepEqual(requests[0], requests.at(-1));
  assert.equal(mock.inspect().history.filter(h => h.kind === "pickup").length, 1);
  assert.equal(await createKingPickup()(recording, identity, "F5", mock.slot(), storage), null);
});

test("guest species use guest rewards and an epoch change discards old pending battles", async () => {
  const { api, encounter } = fixture(), storage = memoryStorage();
  const { SPECIES } = loadTS("lib/domine/king/species.ts");
  for (const species of SPECIES.filter(s => s.category === "guest"))
    assert.equal(kingRank({ ...encounter, individual: { ...encounter.individual, species: species.id } }), "guest");
  storage.setItem(`domine-pet-epoch:${identity.nickname}`, "old");
  storage.setItem(`domine-pet-battle:${identity.nickname}:1`, JSON.stringify({ startId: "old", finishId: "old", start: { pet: 1 }, epoch: "old" }));
  const recovered = await recoverKingBattles(api, identity, (await api.state(identity)).data, storage);
  assert.equal(recovered.reset, true); assert.equal(storage.getItem(`domine-pet-battle:${identity.nickname}:1`), null);
});

// Run the actual polling/pickup hook with controlled time; all transport is the v18 mock.
test("30s polling hides remote wins on scene/map, refreshes level, and pickup waits for arrival", async t => {
  let now = Date.parse("2026-11-11T03:01:00Z"), cursor = 0, dirty = true, value, timerId = 0;
  const slots = [], effects = [], timers = new Map(), { mock, api, encounter } = fixture({ now });
  const calls = [], wrapped = Object.fromEntries(Object.entries(api).map(([kind, fn]) => [kind, (...args) => { calls.push(kind); return fn(...args); }]));
  const props = { cell: encounter.cellId, arrival: undefined, ready: false, enabled: true }; let wallet = 0;
  const refreshWallet = async () => { wallet++; };
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "setTimeout", (fn, ms) => { timers.set(++timerId, { fn, at: now + ms }); return timerId; });
  t.mock.method(globalThis, "clearTimeout", id => timers.delete(id));
  t.mock.method(globalThis, "setInterval", (fn, ms) => { timers.set(++timerId, { fn, at: now + ms, repeat: ms }); return timerId; });
  t.mock.method(globalThis, "clearInterval", id => timers.delete(id));
  const events = new Map();
  const listeners = { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) };
  for (const [name, object] of Object.entries({ navigator: { onLine: true }, document: { hidden: false, ...listeners }, window: { ...listeners, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } } })) {
    const prior = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value: object, configurable: true });
    t.after(() => prior ? Object.defineProperty(globalThis, name, prior) : delete globalThis[name]);
  }
  const changed = (a, b) => !a || a.some((v, i) => !Object.is(v, b[i]));
  const hooks = {
    useState(initial) { const n = cursor++; if (!slots[n]) { slots[n] = { value: typeof initial === "function" ? initial() : initial }; slots[n].set = v => { const next = typeof v === "function" ? v(slots[n].value) : v; if (!Object.is(next, slots[n].value)) { slots[n].value = next; dirty = true; } }; } return [slots[n].value, slots[n].set]; },
    useRef(current) { return slots[cursor++] ??= { current }; },
    useCallback(fn, deps) { const n = cursor++; if (changed(slots[n]?.deps, deps)) slots[n] = { value: fn, deps }; return slots[n].value; },
    useEffect(fn, deps) { const n = cursor++; if (changed(slots[n]?.deps, deps)) { const old = slots[n]; slots[n] = { deps }; effects.push(() => { old?.cleanup?.(); slots[n].cleanup = fn(); }); } },
  };
  const source = ts.transpileModule(readFileSync("app/games/usePetKing.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", source)(name => name === "react" ? hooks : loadTS(`${name.slice(2)}.ts`), exports);
  async function flush() { for (let i = 0; i < 12; i++) { if (dirty) { dirty = false; cursor = 0; value = exports.usePetKing(wrapped, identity, props.cell, props.arrival, props.ready, refreshWallet, props.enabled); } while (effects.length) effects.shift()(); await nextTurn(); } assert.equal(dirty, false); }
  async function advance(ms) { now += ms; mock.advance(ms); for (const [id, timer] of [...timers]) if (timer.at <= now) { if (timer.repeat) timer.at = now + timer.repeat; else timers.delete(id); timer.fn(); } await flush(); }
  await flush(); assert.equal(calls.filter(k => k === "pickup").length, 0);
  props.ready = true; dirty = true; await flush(); assert.equal(calls.filter(k => k === "pickup").length, 1);
  props.ready = false; dirty = true; await flush(); props.ready = true; dirty = true; await flush();
  assert.equal(calls.filter(k => k === "pickup").length, 1);
  const remote = createKingBattle(api, identity, 1, encounter); await remote.start(); mock.advance(5000);
  await remote.finish({ outcome: "win", rounds: 1 });
  assert.equal(value.departed.length, 0);
  await advance(30000);
  assert.ok(calls.filter(k => k === "state").length >= 2);
  const merged = departedWins([`${mock.slot()}:J10:local`], value.departed, mock.slot());
  assert.ok(merged.includes(encounter.id)); assert.ok(merged.includes(`${mock.slot()}:J10:local`));
  assert.ok(!spawnsFor(encounter.cellId, 1, mock.slot(), merged).some(e => e.id === encounter.id));
  assert.ok(value.state.pets[0].xp > 0);
  const before = calls.filter(k => k === "state").length;
  props.cell = "F5"; props.arrival = 1; props.ready = false; dirty = true; await flush();
  assert.equal(calls.filter(k => k === "state").length, before + 1, "cell move polls immediately");
  const claims = calls.filter(k => k === "pickup").length;
  props.ready = true; dirty = true; await flush(); assert.ok(calls.filter(k => k === "pickup").length <= claims + 1);
  await advance(1800000); props.ready = false; dirty = true; await flush(); props.ready = true; dirty = true; await flush();
  assert.ok(calls.filter(k => k === "pickup").length <= claims + 2, "a new time slot can retry pickup without a move");
  assert.equal(calls.filter(k => k === "spawns" || k === "watching").length, 0, "one combined state call per poll");
  let reads=calls.filter(k=>k==="state").length;
  document.hidden=true; await advance(30000); assert.equal(calls.filter(k=>k==="state").length,reads);
  document.hidden=false; events.get("visibilitychange")(); await flush(); assert.equal(calls.filter(k=>k==="state").length,++reads);
  props.enabled=false; dirty=true; await flush(); await advance(60000); assert.equal(calls.filter(k=>k==="state").length,reads);
  props.enabled=true; dirty=true; await flush(); reads++;
  navigator.onLine=false; await advance(30000); assert.equal(calls.filter(k=>k==="state").length,reads);
  navigator.onLine=true; events.get("online")(); await flush(); assert.equal(calls.filter(k=>k==="state").length,reads+1);
  value.settled({}); await flush(); assert.ok(wallet > 0);
  const savedBuy=wrapped.buyItem, requests=[];
  wrapped.buyItem=async(...args)=>{requests.push(args[1]);await savedBuy(...args);throw Error("lost response");};
  const coinsBefore=mock.inspect().coins;
  await value.buyItem(1,"P01");await flush();
  assert.deepEqual(value.pendingPurchase,{pet:1,item:"P01"});assert.equal(value.state.pets[0].inventory.P01,1);
  wrapped.buyItem=async(...args)=>{requests.push(args[1]);return savedBuy(...args);};
  await value.buyItem(1,"P01");await flush();
  assert.equal(value.pendingPurchase,null);assert.equal(mock.inspect().pets[1].inventory.P01,1);
  assert.equal(value.state.coins,coinsBefore-15);assert.equal(new Set(requests).size,1);
  slots.forEach(s => s.cleanup?.()); assert.equal(timers.size, 0);
});
