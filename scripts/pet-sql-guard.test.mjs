// Independent checks of v22/v23 written apart from the migration's own tests:
// what an attacker, the anon role and the real client parser see.
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { identity, king, openPetDb, rpc, tableSnapshot } from "./pet-sql-harness.mjs";
import { loadTS } from "./pet-test-loader.mjs";

const { createKingApi } = loadTS("lib/domine/pet-king-rpc.ts");
const { validProfile } = loadTS("lib/domine/king/spawn.ts");
const { jobPlan } = loadTS("lib/domine/pet-job-rules.ts");
const register = (db, name) => rpc(db, "domine_pet_register_v6", identity(name));
const forged = name => ({ p_nickname: name, p_secret: "f".repeat(64) });
/** The client's own API object on top of the SQL database, so its response validation runs too. */
const clientApi = db => createKingApi(async (name, args) => ({ data: await rpc(db, name, args), error: null }));
const me = name => ({ nickname: name, secret: identity(name).p_secret });
const setLevel = (db, name, level) => db.query(`update domine_pet_v22.progress set xp=domine_pet_v17.xp_for_level($2)
  where player_id=(select id from domine_pet_v6.player where nickname=$1)`, [name, level]);
async function win(db, api, name, input) {
  const state = (await api.state(me(name))).data;
  const ticket = await api.start(me(name), randomUUID(), { pet: 1, slot: state.slot, opponentName: "x", ...input });
  assert.equal(ticket.code, "OK", JSON.stringify(ticket));
  await db.query("update domine_pet_v17.battle_ticket set started_at=now()-interval '60 seconds' where id=$1", [ticket.data.id]);
  const result = await api.finish(me(name), randomUUID(), { ticket: ticket.data.id, outcome: "win", rounds: 4 });
  assert.equal(result.code, "OK", JSON.stringify(result));
  return result.data;
}

test("위조한 비밀값으로는 어떤 쓰기도 되지 않고 표가 그대로다", async () => {
  const db = await openPetDb(); await register(db, "alice");
  const before = await tableSnapshot(db);
  const tries = [
    ["domine_pet_king_v17", { ...forged("alice"), p_request_id: randomUUID(), p_kind: "buyItem", p_input: { pet: 1, item: "P01", quantity: 1 } }],
    ["domine_pet_king_v17", { ...forged("alice"), p_request_id: randomUUID(), p_kind: "chooseJob", p_input: { pet: 1, expectedVersion: 0, job: "striker", tier: 1 } }],
    ["domine_pet_king_v17", { ...forged("alice"), p_request_id: randomUUID(), p_kind: "pickup", p_input: { cell: "F5", slot: 1 } }],
    ["domine_pet_action_v16", { ...forged("alice"), p_request_id: randomUUID(), p_pet: 1, p_action: "feed", p_duration_ms: 600 }],
    ["domine_pet_purchase_v10", { ...forged("alice"), p_request_id: randomUUID(), p_pet: 1, p_item: "061" }],
    ["domine_pet_state_v6", { ...forged("alice"), p_pet: 1 }],
  ];
  for (const [name, args] of tries) {
    const reply = await rpc(db, name, args);
    assert.ok(reply.ok === false || reply.code === "AUTH_FAILED", `${name}: ${JSON.stringify(reply).slice(0, 120)}`);
    assert.ok(!JSON.stringify(reply).includes('"coins"'), `${name} leaks no state`);
  }
  assert.equal((await register(db, "alice2")).code, "OK");
  assert.equal((await rpc(db, "domine_pet_register_v6", forged("alice"))).code, "NICKNAME_TAKEN");
  const after = await tableSnapshot(db);
  for (const table of Object.keys(before)) if (!["domine_pet_v6.player", "domine_pet_v6.rate_bucket", "domine_pet_v22.wallet", "domine_pet_v22.pet", "domine_pet_v22.progress", "domine_pet_v22.spawn_profile"].includes(table))
    assert.deepEqual(after[table], before[table], table);
  const mine = rows => rows.filter(row => row.player_id === before["domine_pet_v22.wallet"][0].player_id);
  for (const table of ["domine_pet_v22.wallet", "domine_pet_v22.pet", "domine_pet_v22.progress"]) assert.deepEqual(mine(after[table]), mine(before[table]), `${table}: alice untouched`);
  await db.close();
});

test("anon 역할: 공개 함수만 되고 새 표·내부 함수·이름만 받는 옛 쓰기 함수는 막힌다", async () => {
  const db = await openPetDb(); await register(db, "alice");
  const player = (await db.query("select id from domine_pet_v6.player where nickname='alice'")).rows[0].id;
  await db.exec("set role anon");
  const denied = async sql => { await assert.rejects(() => db.query(sql), /permission denied/, sql); };
  for (const table of ["wallet", "pet", "progress", "mastery", "battle_inventory", "certification", "encounter_record", "cosmetic_inventory", "equipment", "spawn_profile"])
    await denied(`select * from domine_pet_v22.${table}`);
  await denied(`update domine_pet_v22.wallet set coins=99999`);
  await denied(`select domine_pet_v22.ensure_player('${player}')`);
  await denied(`select domine_pet_v22.care('${player}',1,'feed')`);
  await denied(`select domine_pet_v17.pet_state('${player}',1)`);
  await denied(`select domine_pet_v6.command_v6('alice','x','${randomUUID()}','action','{}')`);
  await denied(`select public.domine_pet_care_for(1,'alice','feed')`);
  await denied(`select public.domine_pet_care('alice','feed')`);
  assert.equal((await king(db, "alice", "state")).ok, true, "the public RPC still works for anon");
  assert.equal((await rpc(db, "domine_pet_state_for", { p_pet: 1, p_nickname: "alice" })).fullness, 70);
  assert.equal((await rpc(db, "domine_pet_capabilities_v6")).perPlayer, true);
  await db.exec("reset role"); await db.close();
});

test("앱이 실제로 읽는 응답: 상태·레벨 분포·직업 얻기와 전직이 클라이언트 검증을 통과한다", async () => {
  const db = await openPetDb(), api = clientApi(db);
  await register(db, "alice"); await register(db, "bob");
  await setLevel(db, "alice", 12);
  let state = (await api.state(me("alice"))).data;
  assert.ok(validProfile(state.levelProfile), JSON.stringify(state.levelProfile));
  assert.equal(state.pets.find(p => p.pet === 1).level, 12);
  const regions = s => s.certifications.filter(c => c.pet === 1 && c.kind === "region").map(c => c.target);
  assert.deepEqual(jobPlan(state.pets[0], "striker", { coins: state.coins, regions: regions(state) }).blocks, [{ kind: "boss" }]);
  const locked = await api.chooseJob(me("alice"), randomUUID(), { pet: 1, expectedVersion: state.pets[0].version, job: "striker", tier: 1 });
  assert.equal(locked.code, "PROMOTION_LOCKED");

  await win(db, api, "alice", { cell: "E1", individualId: "N03", opponentLevel: 10, opponentRank: "boss" });
  state = (await api.state(me("alice"))).data;
  assert.deepEqual(regions(state), ["R01"]);
  assert.deepEqual(jobPlan(state.pets[0], "striker", { coins: state.coins, regions: regions(state) }), { tier: 1, step: "start", cost: 0, blocks: [] });
  const chosen = await api.chooseJob(me("alice"), randomUUID(), { pet: 1, expectedVersion: state.pets[0].version, job: "striker", tier: 1 });
  assert.equal(chosen.code, "OK", JSON.stringify(chosen));
  assert.equal(chosen.data.job, "striker"); assert.equal(chosen.data.jobTier, 1);
  assert.deepEqual(Object.keys(chosen.data.wallet).sort(), ["coins", "version"]);

  // The other dog and the other player are untouched, and the animal is gone for everyone.
  state = (await api.state(me("alice"))).data;
  assert.equal(state.pets.find(p => p.pet === 2).job, null);
  const bob = (await api.state(me("bob"))).data;
  assert.equal(bob.pets[0].job, null); assert.equal(bob.pets[0].level, 1); assert.deepEqual(regions(bob), []);
  assert.ok(bob.departed.some(d => d.individualId === "N03" && d.cell === "E1"), "bob sees the boss as beaten in this slot");
  const again = await api.start(me("bob"), randomUUID(), { pet: 1, cell: "E1", slot: bob.slot, individualId: "N03", opponentLevel: 10, opponentRank: "boss", opponentName: "x" });
  assert.equal(again.ok, false, "a beaten animal cannot be fought again in the same slot");

  // Switching within a day is refused by the server exactly as the sheet predicts.
  const plan = jobPlan(state.pets[0], "defender", { coins: 1000, regions: regions(state) });
  assert.equal(plan.blocks[0].kind, "cooldown");
  const swap = await api.chooseJob(me("alice"), randomUUID(), { pet: 1, expectedVersion: state.pets[0].version, job: "defender", tier: 1 });
  assert.equal(swap.code, "JOB_COOLDOWN");
  await db.close();
});

test("상대 레벨: 분포 밖 레벨은 거절하고, 높은 상대를 이겨도 경험치는 내 레벨 기준 상한을 넘지 않는다", async () => {
  const db = await openPetDb(), api = clientApi(db);
  await register(db, "alice"); await register(db, "vet"); await setLevel(db, "vet", 40);
  // Real animals of this slot, as the client would list them.
  const { pickSpawns } = loadTS("lib/domine/king/spawn.ts"), { PET_WORLD } = loadTS("lib/domine/pet-world.ts");
  const slot = (await api.state(me("alice"))).data.slot;
  const animals = PET_WORLD.flatMap(cell => pickSpawns(cell.id, slot, 1).filter(s => s.kind === "resident" && !s.individual.breedId.startsWith("G")).map(s => ({ cell: cell.id, individualId: s.individual.id })));
  assert.ok(animals.length >= 3);
  await win(db, api, "vet", { ...animals[0], opponentLevel: 40, opponentRank: "resident" });
  await db.exec("delete from domine_pet_v22.spawn_profile");
  const state = (await api.state(me("alice"))).data, top = state.levelProfile.levels[4];
  assert.ok(top >= 40, JSON.stringify(state.levelProfile));
  const base = { pet: 1, slot: state.slot, opponentRank: "resident", opponentName: "x" };
  await api.pickup(me("alice"), randomUUID(), { cell: animals[1].cell, slot: state.slot });   // any write freezes today's profile
  assert.equal((await api.start(me("alice"), randomUUID(), { ...base, ...animals[1], opponentLevel: top + 50 })).ok, false);
  const reward = await win(db, api, "alice", { ...animals[2], opponentLevel: top, opponentRank: "resident" });
  const cap = Math.floor((12 + 2 * 11) * 6 * 1.6 * 1.5 * 1.25);
  assert.ok(reward.xp > 0 && reward.xp <= cap, `xp ${reward.xp} within ${cap}`);
  await db.close();
});
