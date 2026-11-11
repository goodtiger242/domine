import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTS } from "./pet-test-loader.mjs";

const { createPetMock } = loadTS("tests/pet/rpc-mock.ts");
const { createPetApi } = loadTS("lib/domine/pet-rpc.ts");
const first = { nickname: "김경석", secret: "a".repeat(64) };
const second = { nickname: "김보영", secret: "b".repeat(64) };
const server = createPetMock({ busyLock: true });
await server.api.register(first); await server.api.register(second);
const command = { kind: "action", pet: 1, action: "treat", durationMs: 2200, requestId: "first" };
const [ok, blocked] = await Promise.all([
  server.api.execute(first, command),
  server.api.execute(second, { ...command, requestId: "overlap" }),
]);
assert.equal(ok.code, "OK"); assert.equal(blocked.code, "BUSY");
assert.deepEqual(blocked.busy, { nickname: first.nickname, action: "treat", remainingMs: 2200 });
assert.equal(blocked.version, ok.version); assert.equal(blocked.coins, ok.coins);
assert.deepEqual(blocked.player, ok.player); assert.equal(server.historyCount(), 1, "only the first action is recorded");
assert.equal((await server.api.execute(first, { ...command, requestId: "self-overlap" })).code, "BUSY");
assert.equal((await server.api.execute(second, { ...command, pet: 2, requestId: "other-pet" })).code, "OK");
assert.equal((await server.api.execute(first, { kind: "purchase", pet: 1, item: "061", requestId: "shop" })).code, "OK");
assert.equal((await server.api.execute(first, { kind: "equip", pet: 1, slot: "wearable", item: "061", requestId: "bag" })).code, "OK");
assert.equal((await server.api.execute(first, { kind: "explore_begin", map: "church", source: "map", requestId: "map" })).code, "OK");
assert.equal((await server.api.execute(first, { kind: "record_season", entry: "081", requestId: "album" })).code, "OK");
assert.equal((await server.api.state(second, 1)).busy.remainingMs, 2200);
server.advance(2199);
assert.equal((await server.api.state(second, 1)).busy.remainingMs, 1);
server.advance(1);
assert.equal((await server.api.state(second, 1)).busy, null);
assert.deepEqual(await server.api.operation(second, "overlap"), blocked, "BUSY replay stays frozen after expiry");
assert.deepEqual(await server.api.execute(second, { ...command, requestId: "overlap" }), blocked);
assert.equal((await server.api.execute(second, { ...command, requestId: "after-expiry" })).code, "OK");
for (const [durationMs, expected] of [[undefined, 6000], [-1, 500], [1, 500], [99999, 20000]]) {
  server.advance(20000);
  const result = await server.api.execute(first, { ...command, durationMs, requestId: `duration-${durationMs}` });
  assert.equal(result.busy.remainingMs, expected);
}

let flags = { version: 6, busyLock: true }, calls = [];
const api = createPetApi(async (name, args) => {
  calls.push({ name, args });
  return { data: name === "domine_pet_capabilities_v6" ? flags : ok, error: null };
});
assert.equal((await api.capabilities()).busyLock, true);
await api.execute(first, command);
assert.equal(calls.at(-1).name, "domine_pet_action_v16");
assert.equal(calls.at(-1).args.p_duration_ms, 2200);
await api.execute(first, { ...command, durationMs: undefined });
assert.equal(calls.at(-1).args.p_duration_ms, 6000);
flags = { version: 6 };
assert.equal((await api.capabilities()).busyLock, false);
await api.execute(first, command);
assert.equal(calls.at(-1).name, "domine_pet_action_v6");
assert.ok(!("p_duration_ms" in calls.at(-1).args));

const sql = readFileSync("supabase/migrations/20261111390000_domine_pet_v16_busy.sql", "utf8");
const body = sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, "");
assert.ok(/^[\x00-\x7f]*$/.test(body), "SQL body must be ASCII");
assert.match(body, /^\s*begin;/); assert.match(body, /commit;\s*$/);
assert.doesNotMatch(body, /\b(drop|truncate|delete)\b/i);
assert.match(body, /create schema if not exists domine_pet_v16/);
assert.match(body, /create table if not exists domine_pet_v16\.busy/);
assert.match(body, /pet_id int primary key check \(pet_id in \(1,2\)\)/);
assert.match(body, /alter table domine_pet_v16\.busy enable row level security/);
assert.match(body, /revoke all on schema domine_pet_v16 from public,anon,authenticated/);
assert.match(body, /revoke all on all tables in schema domine_pet_v16 from public,anon,authenticated/);
assert.match(body, /least\(20000,greatest\(500,coalesce\(\(p_input->>'durationMs'\)::numeric,6000\)\)\)::int/);
assert.match(body, /where pet_id=pet;\s+if found and busy_row.until>now\(\) then/);
assert.match(body, /where b.pet_id=p_pet and b.until>now\(\)/);
const lock = body.indexOf("select * into strict wallet"), gate = body.indexOf("select * into busy_row");
assert.ok(lock < gate && gate < body.indexOf("rate_v6('change:'") && gate < body.indexOf("shared:=public.domine_pet_care_for"));
assert.match(body, /result_v6\('BUSY'\)[\s\S]*?insert into domine_pet_v6.operation[\s\S]*?return result;/);
assert.equal((body.match(/if op.result->>'code'='BUSY' then return op.result; end if;/g) ?? []).length, 2);
assert.match(body, /on conflict\(pet_id\) do update set until=excluded.until/);
assert.doesNotMatch(body, /create or replace function public.domine_pet_action_v6\(/);
assert.match(body, /grant execute on function public.domine_pet_action_v16\(text,text,uuid,int,text,int\) to anon,authenticated/);
const flagsSQL = JSON.parse(body.match(/select '(\{"version":6[^']+)+'/)[1]);
assert.deepEqual(flagsSQL, { version: 6, sharedEconomy: true, explorationThemes: 24, v9: true, v10: true, perPetShop: true, history: true, busyLock: true });
const v14 = readFileSync("supabase/migrations/20261111350000_domine_pet_v14_shared_album.sql", "utf8");
const badges = text => text.slice(text.indexOf("create or replace function domine_pet_v6.badges_v6"), text.indexOf("create or replace function domine_pet_v6.command_v6"));
assert.equal(badges(sql).replaceAll("\r\n", "\n"), badges(v14).replaceAll("\r\n", "\n"), "preserve v14 shared-album badges");
for (const fragment of ["a1b2c3d4-0000-4000-8000-000000000001", "#variable_conflict use_column", "end cmd $$", "day.reward_actions>=1000000"]) assert.ok(sql.includes(fragment));
console.log("Pet busy: concurrent requests, self lock, per-pet isolation, expiry, replay, non-care access, RPC compatibility and ASCII SQL passed.");
