import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { applyFile, identity, king, openPetDb, rpc, tableSnapshot } from "./pet-sql-harness.mjs";

const migration = "supabase/migrations/20261112600000_domine_pet_v22_spawn_profile.sql";

test("v22: ASCII transaction and no destructive DDL", () => {
  const sql = readFileSync(migration, "utf8");
  assert.match(sql, /^[\x00-\x7f]*$/);
  assert.doesNotMatch(sql, /\bdrop\s/i);
  assert.match(sql, /^begin;/);
  assert.match(sql.trimEnd(), /commit;$/);
});

test("v22: fallback, one daily insert, read-only repeat/ranking, repeat migration", async t => {
  const db = await openPetDb({ until: "v21" }); t.after(() => db.close());
  await rpc(db, "domine_pet_register_v6", identity("reader"));
  const flags = await rpc(db, "domine_pet_capabilities_v6");
  await applyFile(db, migration);
  const first = await king(db, "reader", "state");
  assert.equal(first.code, "OK");
  assert.deepEqual(first.data.levelProfile.levels, [1, 2, 3, 4, 5]);
  assert.equal(first.data.levelProfile.players, 0);
  assert.equal(first.data.levelProfile.day, (await db.query("select (now() at time zone 'Asia/Seoul')::date::text as day")).rows[0].day);
  const before = await tableSnapshot(db);
  for (const kind of ["state", "state", "spawns", "watching", "ranking"]) {
    const result = await king(db, "reader", kind); assert.equal(result.code, "OK");
    if (["state", "spawns"].includes(kind)) assert.deepEqual(result.data.levelProfile, first.data.levelProfile);
  }
  await applyFile(db, migration);
  assert.deepEqual(await tableSnapshot(db), before);
  assert.deepEqual(await rpc(db, "domine_pet_capabilities_v6"), { ...flags, spawnProfile: true });
});

test("v22: XP fallback percentiles, cached profile and start level bounds (named unchanged)", async t => {
  const db = await openPetDb({ until: "v21" }); t.after(() => db.close());
  await rpc(db, "domine_pet_register_v6", identity("bounds"));
  await db.exec("update domine_pet_v17.pet_progress set xp=domine_pet_v17.xp_for_level(case pet_id when 1 then 10 else 30 end)");
  await applyFile(db, migration);
  const profile = (await king(db, "bounds", "spawns")).data.levelProfile;
  assert.deepEqual(profile.levels, [8, 15, 20, 25, 32]);
  assert.equal(profile.players, 1);
  await db.exec("update domine_pet_v17.pet_progress set xp=0");
  assert.deepEqual((await king(db, "bounds", "state")).data.levelProfile, profile);
  const slot = (await king(db, "bounds", "spawns")).data.slot;
  const start = (level, individualId = "resident:B001:000", cell = "E1") => king(db, "bounds", "start", {
    pet: 1, cell, individualId, slot, opponentLevel: level, opponentRank: "resident", opponentName: "opponent",
  });
  assert.equal((await start(37)).code, "OK");
  assert.equal((await start(38, "resident:B001:001")).code, "INVALID_OPPONENT");
  assert.equal((await start(0)).code, "INVALID_INPUT");
  assert.equal((await start(12, "N01")).code, "INVALID_OPPONENT");
  assert.equal((await start(11, "N01", "E2")).code, "OK");
  assert.equal((await start(1, "invented")).code, "INVALID_OPPONENT");
  await applyFile(db, migration);
  assert.deepEqual((await king(db, "bounds", "spawns")).data.levelProfile, profile);
});
