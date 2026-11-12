import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { applyFile, identity, king, openPetDb, rpc } from "./pet-sql-harness.mjs";

const file = "supabase/maintenance/20261112_reset_players.sql";
const level = async (db, name) => (await king(db, name, "state")).data;

test("각자 초기화: 모든 강아지가 처음으로, 백업이 남고, 계정·업적은 그대로, 다시 돌리면 멈춘다", async () => {
  assert.match(readFileSync(file, "utf8"), /^[\x00-\x7f]*$/);
  const db = await openPetDb();
  for (const name of ["최선호", "최비호"]) await rpc(db, "domine_pet_register_v6", identity(name));
  await db.query("update domine_pet_v22.progress set xp=domine_pet_v17.xp_for_level(16)");
  await db.query("update domine_pet_v22.wallet set coins=500");
  assert.equal((await king(db, "최선호", "buyItem", { pet: 1, item: "P01", quantity: 1 })).code, "OK");
  await rpc(db, "domine_pet_action_v16", { ...identity("최선호"), p_request_id: randomUUID(), p_pet: 1, p_action: "feed", p_duration_ms: 600 });
  const badges = (await db.query("select count(*)::int as n from domine_pet_v6.counter")).rows[0].n;
  const before = await level(db, "최선호");
  await applyFile(db, file);
  for (const name of ["최선호", "최비호"]) {
    const state = await level(db, name);
    assert.equal(state.coins, 0);
    assert.deepEqual(state.pets.map(p => [p.level, p.xp, p.job, Object.keys(p.inventory).length]), [[1, 0, null, 0], [1, 0, null, 0]]);
    assert.deepEqual(state.certifications, []); assert.deepEqual(state.encyclopedia, []);
    assert.equal(state.resetEpoch, "20261112-reset");
  }
  assert.ok((await level(db, "최선호")).version > before.version, "wallet version moves forward so devices accept the reset");
  const ranking = await rpc(db, "domine_pet_level_ranking_v24");
  assert.deepEqual([ranking["1"].length, ranking["2"].length], [0, 0], "Lv.1 dogs are not ranked");
  assert.equal((await db.query("select count(*)::int as n from domine_pet_v6.counter")).rows[0].n, badges, "counters (badges) are kept");
  const backup = (await db.query("select max(xp)::int as xp from domine_pet_backup.r20261112_progress")).rows[0].xp;
  assert.ok(backup > 0, "the old progress is kept in the backup schema");
  await db.exec("set role anon");
  await assert.rejects(() => db.query("select * from domine_pet_backup.r20261112_progress"), /permission denied/);
  await db.exec("reset role");
  assert.equal((await king(db, "최선호", "buyItem", { pet: 1, item: "P01", quantity: 1 })).code, "INSUFFICIENT_COINS", "play continues from zero");
  await assert.rejects(() => applyFile(db, file), /ALREADY_RESET/);
  await db.close();
});
