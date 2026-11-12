import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { applyFile, identity, openPetDb, rpc, count } from "./pet-sql-harness.mjs";

const v24 = "supabase/migrations/20261112800000_domine_pet_v24_level_ranking.sql";
const setXp = (db, name, pet, level) => db.query(`update domine_pet_v22.progress set xp=domine_pet_v17.xp_for_level($3)
  where pet_id=$2 and player_id=(select id from domine_pet_v6.player where nickname=$1)`, [name, pet, level]);

test("v24 랭킹: 강아지별로 레벨 순, Lv.1은 빠지고, 읽기만 하며 anon이 부를 수 있다", async () => {
  const sql = readFileSync(v24, "utf8");
  assert.match(sql, /^[\x00-\x7f]*$/); assert.doesNotMatch(sql, /\bdrop\s/i); assert.match(sql, /^begin;/); assert.match(sql.trimEnd(), /commit;$/);
  const db = await openPetDb();
  for (const name of ["alice", "bob", "carol", "dave"]) await rpc(db, "domine_pet_register_v6", identity(name));
  await setXp(db, "alice", 1, 12); await setXp(db, "bob", 1, 20); await setXp(db, "carol", 1, 2);
  await setXp(db, "alice", 2, 5); await setXp(db, "dave", 2, 1);
  const before = await count(db, "domine_pet_v17.operation");
  await db.exec("set role anon");
  const ranking = await rpc(db, "domine_pet_level_ranking_v24");
  await assert.rejects(() => db.query("select domine_pet_v22.level_ranking_rows(1)"), /permission denied/);
  await db.exec("reset role");
  assert.deepEqual(ranking["1"].map(r => [r.nickname, r.level]), [["bob", 20], ["alice", 12], ["carol", 2]]);
  assert.deepEqual(ranking["2"].map(r => [r.nickname, r.level]), [["alice", 5]], "level 1 dogs are not ranked");
  assert.equal(await count(db, "domine_pet_v17.operation"), before);
  await applyFile(db, v24);   // re-applying is harmless
  assert.deepEqual(await rpc(db, "domine_pet_level_ranking_v24"), ranking);
  await db.close();
});
