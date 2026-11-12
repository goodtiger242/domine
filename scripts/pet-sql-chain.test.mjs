import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { count, identity, king, openPetDb, petMigrations, rpc } from "./pet-sql-harness.mjs";

test("모든 마이그레이션이 순서대로 실제 Postgres에서 실행되고 기본 RPC가 동작한다", async () => {
  assert.ok(petMigrations().length >= 21);
  const db = await openPetDb();
  const registered = await rpc(db, "domine_pet_register_v6", identity("tester"));
  assert.equal(registered.code, "OK");
  const state = await king(db, "tester", "state");
  assert.equal(state.ok, true);
  assert.equal(state.data.pets.length, 2);
  const fed = await rpc(db, "domine_pet_action_v16", { ...identity("tester"), p_request_id: randomUUID(), p_pet: 1, p_action: "feed", p_duration_ms: 600 });
  assert.equal(fed.code, "OK");
  const capabilities = await rpc(db, "domine_pet_capabilities_v6");
  assert.equal(capabilities.king, true);
  await db.close();
});

test("상태 조회는 읽기만 한다(같은 응답, 기록 수 그대로)", async () => {
  const db = await openPetDb();
  await rpc(db, "domine_pet_register_v6", identity("reader"));
  const first = await king(db, "reader", "state");
  const before = await count(db, "domine_pet_v17.operation");
  const second = await king(db, "reader", "state");
  assert.equal(await count(db, "domine_pet_v17.operation"), before);
  assert.deepEqual(second.data.pets, first.data.pets);
  assert.equal(second.data.version, first.data.version);
  await db.close();
});

test("잘못된 비밀값은 거절한다", async () => {
  const db = await openPetDb();
  await rpc(db, "domine_pet_register_v6", identity("owner"));
  const forged = await rpc(db, "domine_pet_king_v17", { p_nickname: "owner", p_secret: "0".repeat(64), p_request_id: randomUUID(), p_kind: "pickup", p_input: { cell: "F5", slot: 1 } });
  assert.equal(forged.ok, false);
  await db.close();
});
