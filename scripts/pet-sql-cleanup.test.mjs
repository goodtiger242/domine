import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { applyFile, identity, king, openPetDb, rpc } from "./pet-sql-harness.mjs";

const file = "supabase/maintenance/20261112_delete_test_accounts.sql";
const TEST = ["선호", "호호", "확인"];

test("시험 계정 삭제: 세 계정과 딸린 행만 지우고, 다른 계정은 그대로, 다시 돌리면 멈춘다", async () => {
  assert.match(readFileSync(file, "utf8"), /^[\x00-\x7f]*$/);
  const db = await openPetDb();
  for (const name of [...TEST, "최선호"]) await rpc(db, "domine_pet_register_v6", identity(name));
  // Give the test accounts rows in the busiest tables, including a settled battle and a feed line.
  for (const name of TEST) {
    await rpc(db, "domine_pet_action_v16", { ...identity(name), p_request_id: randomUUID(), p_pet: 1, p_action: "feed", p_duration_ms: 600 });
    await king(db, name, "pickup", { cell: "F5", slot: Number((await king(db, name, "spawns")).data.slot) });
  }
  await db.query("update domine_pet_v22.progress set xp=domine_pet_v17.xp_for_level(5)");
  const keeper = await king(db, "최선호", "state");
  const before = Object.fromEntries((await db.query(`select table_schema||'.'||table_name as t from information_schema.columns
    where column_name='player_id' and table_schema like 'domine_pet_%' group by 1`)).rows.map(r => [r.t, 0]));
  await applyFile(db, file);
  const players = (await db.query("select nickname from domine_pet_v6.player order by nickname")).rows.map(r => r.nickname);
  assert.ok(!players.some(n => TEST.includes(n)), players.join());
  assert.ok(players.includes("최선호"));
  for (const table of Object.keys(before)) {
    const left = await db.query(`select count(*)::int as n from ${table} x where not exists(select 1 from domine_pet_v6.player p where p.id=x.player_id)`);
    assert.equal(left.rows[0].n, 0, `${table} keeps no rows of deleted players`);
  }
  assert.equal((await db.query("select count(*)::int as n from domine_pet_v10.history where nickname = any($1)", [TEST])).rows[0].n, 0);
  assert.deepEqual((await king(db, "최선호", "state")).data.pets, keeper.data.pets, "the remaining account is untouched");
  const ranking = await rpc(db, "domine_pet_level_ranking_v24");
  assert.deepEqual(ranking["1"].map(r => r.nickname), ["최선호"]);
  await assert.rejects(() => applyFile(db, file), /EXPECTED_3_TEST_ACCOUNTS/, "a second run stops without touching anything");
  await db.close();
});
