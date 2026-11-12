import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { applyFile, count, identity, king, openPetDb, rpc, tableSnapshot } from "./pet-sql-harness.mjs";

const v22 = "supabase/migrations/20261112600000_domine_pet_v22_spawn_profile.sql";
const v23 = "supabase/migrations/20261112700000_domine_pet_v23_per_player.sql";
const rollback = "supabase/rollback/20261112700000_v23_rollback.sql";
const ok = result => { assert.equal(result.code, "OK", JSON.stringify(result)); return result; };
const register = async (db, name) => ok(await rpc(db, "domine_pet_register_v6", identity(name)));
const state = async (db, name) => ok(await king(db, name, "state")).data;
const snapshot = (db, name, pet = 1) => rpc(db, "domine_pet_state_v6", { ...identity(name), p_pet: pet });
const action = (db, name, request = randomUUID(), pet = 1, act = "feed") => rpc(db, "domine_pet_action_v16", {
  ...identity(name), p_request_id: request, p_pet: pet, p_action: act, p_duration_ms: 20000,
});
const purchase = (db, name, item = "061", request = randomUUID()) => rpc(db, "domine_pet_purchase_v10", {
  ...identity(name), p_request_id: request, p_pet: 1, p_item: item,
});
const equip = (db, name, item = "061") => rpc(db, "domine_pet_equip_v6", {
  ...identity(name), p_request_id: randomUUID(), p_pet: 1, p_slot: "wearable", p_item: item,
});
const playerId = async (db, name) => (await db.query("select id from domine_pet_v6.player where nickname=$1", [name])).rows[0].id;
const personal = s => ({ coins: s.coins, version: s.version, pets: s.pets, encyclopedia: s.encyclopedia, certifications: s.certifications, tickets: s.tickets });
const withoutClock = ({ serverNow, ...s }) => s;
const legacyTables = ["public.domine_pet", "public.domine_pet_log", "domine_pet_v7.pool", "domine_pet_v10.pet_xp",
  "domine_pet_v10.inventory", "domine_pet_v7.equipment", "domine_pet_v16.busy", "domine_pet_v17.pet_progress",
  "domine_pet_v17.mastery", "domine_pet_v17.inventory", "domine_pet_v17.certification", "domine_pet_v17.encounter_record"];

async function start(db, name, input = {}, request = randomUUID()) {
  const slot = (await king(db, name, "spawns")).data.slot;
  return king(db, name, "start", { pet: 1, cell: "E1", slot, individualId: "N01", opponentName: "opponent",
    opponentLevel: 10, opponentRank: "boss", ...input }, request);
}
async function finish(db, name, ticket, input = {}, request = randomUUID()) {
  // Advance only the fixture's ticket clock: no wall-clock sleeps or reward spoofing.
  await db.query("update domine_pet_v17.battle_ticket set started_at=now()-interval '60 seconds',seed=20 where id=$1", [ticket]);
  return king(db, name, "finish", { ticket, outcome: "win", rounds: 3, moveCounts: { tackle: 2 }, weaknesses: ["sound"], ...input }, request);
}
async function legacyFixture(t) {
  const db = await openPetDb({ until: "v21" }); t.after(() => db.close());
  await register(db, "alice"); await register(db, "bob");
  await db.exec(`update domine_pet_v7.pool set coins=5000;
    update domine_pet_v17.pet_progress set xp=domine_pet_v17.xp_for_level(10),allocation_mode='manual';
    update domine_pet_v10.pet_xp set xp=120;
    update public.domine_pet set fullness=70,mood=70,clean=80,updated_at=now();`);
  ok(await purchase(db, "alice")); ok(await equip(db, "alice")); ok(await action(db, "alice"));
  ok(await king(db, "alice", "buyItem", { pet: 1, item: "P01", quantity: 3 }));
  const ticket = ok(await start(db, "alice")).data;
  ok(await finish(db, "alice", ticket.id));
  await db.exec("update domine_pet_v16.busy set until=now()-interval '1 second'");
  return db;
}

test("v23: ASCII transaction; rollback file is ASCII too", () => {
  for (const file of [v23, rollback]) {
    const sql = readFileSync(file, "utf8");
    assert.match(sql, /^[\x00-\x7f]*$/);
    assert.doesNotMatch(sql, /\bdrop\s/i);
    assert.match(sql, /^begin;/); assert.match(sql.trimEnd(), /commit;$/);
  }
});

test("v23: real pre-v23 play copied to both owners, reservations refunded once, new player fresh", async t => {
  const db = await legacyFixture(t);
  await db.exec(`insert into domine_pet_v6.album(player_id,entry_id,find_count)
    select id,'061',7 from domine_pet_v6.player where nickname='alice';
    update domine_pet_v6.album set find_count=11
    where player_id='a1b2c3d4-0000-4000-8000-000000000001' and entry_id='061'`);
  const before = await state(db, "alice"), beforeCare = await snapshot(db, "alice");
  const reserved = ok(await start(db, "alice", { cell: "E2", individualId: "N02", items: { P01: 2 } })).data;
  await applyFile(db, v22); await applyFile(db, v23);
  for (const name of ["alice", "bob"]) {
    const s = await state(db, name), care = await snapshot(db, name);
    assert.equal(s.coins, before.coins); assert.equal(s.version, before.version + 1);
    assert.deepEqual(s.pets.map(p => ({ ...p, version: 0 })), before.pets.map(p => ({ ...p, version: 0 })));
    assert.deepEqual(s.certifications, before.certifications);
    assert.equal(s.certifications[0].target, "R01");
    assert.equal(s.encyclopedia.find(e => e.individualId === "N01").wins, 1);
    assert.equal(s.encyclopedia.find(e => e.individualId === "N02").encounters, 1);
    for (const field of ["player", "levels", "inventory", "equipment", "album"]) assert.deepEqual(care[field], beforeCare[field], field);
    for (const field of ["fullness", "mood", "clean", "care_total"]) assert.equal(care.shared.pet[field], beforeCare.shared.pet[field], field);
    assert.equal((await db.query(`select find_count from domine_pet_v6.album
      where player_id=(select id from domine_pet_v6.player where nickname=$1) and entry_id='061'`, [name])).rows[0].find_count, 11);
  }
  assert.equal((await state(db, "alice")).tickets.find(t => t.id === reserved.id).status, "cancelled");
  assert.equal((await db.query("select quantity from domine_pet_v17.inventory where pet_id=1 and item_id='P01'")).rows[0].quantity, before.pets[0].inventory.P01);
  const backup = await tableSnapshot(db, legacyTables);
  ok(await king(db, "alice", "buyItem", { pet: 1, item: "P02", quantity: 1 }));
  const changed = await tableSnapshot(db);
  await applyFile(db, v23); assert.deepEqual(await tableSnapshot(db), changed, "no recopy, reset, refund or version bump");
  await register(db, "charlie");
  const fresh = await state(db, "charlie"), freshCare = await snapshot(db, "charlie");
  assert.equal(fresh.coins, 0); assert.equal(fresh.version, 0);
  for (const p of fresh.pets) { assert.equal(p.level, 1); assert.equal(p.xp, 0); assert.deepEqual(p.inventory, {}); }
  assert.deepEqual(fresh.encyclopedia, []); assert.deepEqual(fresh.certifications, []);
  assert.deepEqual(freshCare.inventory, []); assert.deepEqual(freshCare.equipment, []); assert.deepEqual(freshCare.album, []);
  assert.equal(freshCare.shared.pet.fullness, 70); assert.equal(freshCare.shared.pet.mood, 70); assert.equal(freshCare.shared.pet.clean, 80);
  assert.equal(freshCare.shared.pet.care_total, 0); assert.equal(freshCare.player.xp, 0);
  assert.equal(await count(db, "domine_pet_v22.wallet"), 3, "exclude shared album account");
  assert.deepEqual(await tableSnapshot(db, legacyTables), backup);
});

test("v23: coins, growth, jobs, moves, bags, care/busy, encyclopedia and certifications are isolated", async t => {
  const db = await legacyFixture(t); await applyFile(db, v22); await applyFile(db, v23);
  const before = personal(await state(db, "bob")), beforeCare = withoutClock(await snapshot(db, "bob"));
  const backup = await tableSnapshot(db, legacyTables);
  const a = await playerId(db, "alice"), b = await playerId(db, "bob");
  const bobRows = async () => {
    const rows = await tableSnapshot(db);
    return Object.fromEntries(Object.entries(rows).filter(([name]) => name.startsWith("domine_pet_v22.") || name.startsWith("domine_pet_v6."))
      .map(([name, values]) => [name, values.filter(row => row.player_id === b)]));
  };
  const rowsBefore = await bobRows();
  ok(await king(db, "alice", "buyItem", { pet: 1, item: "P02", quantity: 2 }));
  ok(await purchase(db, "alice", "062")); ok(await equip(db, "alice", "062"));
  const progress = async () => (await state(db, "alice")).pets[0];
  let p = await progress();
  const allocated = ok(await king(db, "alice", "allocate", { pet: 1, expectedVersion: p.version,
    mode: "manual", allocation: { ...p.allocation, attack: p.allocation.attack + 1 } })).data;
  assert.ok(allocated.wallet); assert.equal(allocated.allocation.attack, p.allocation.attack + 1);
  p = await progress();
  const job = ok(await king(db, "alice", "chooseJob", { pet: 1, expectedVersion: p.version, job: "striker", tier: 1 })).data;
  assert.equal(job.job, "striker"); assert.ok(job.wallet);
  p = await progress();
  const moves = ok(await king(db, "alice", "equipMoves", { pet: 1, expectedVersion: p.version, moves: ["tackle", "bark"] })).data;
  assert.deepEqual(moves.moves, ["tackle", "bark"]); assert.ok(moves.wallet);
  // The migrated feed left fullness at 100; walk preserves the legacy effect rules.
  const fed = ok(await action(db, "alice", randomUUID(), 1, "walk"));
  assert.equal(fed.shared.applied, true); assert.equal(fed.shared.pet.fullness, 90);
  assert.equal((await action(db, "alice")).code, "BUSY");
  assert.equal((await snapshot(db, "bob")).busy, null);
  const ticket = ok(await start(db, "alice", { cell: "C1", individualId: "N03", items: { P02: 1 } })).data;
  const won = ok(await finish(db, "alice", ticket.id, { usedItems: { P02: 1 } })).data;
  assert.ok(won.xp > 0); assert.ok(won.coins > 0); assert.equal(won.streak, 2);
  assert.ok(won.progress.mastery.tackle > before.pets[0].mastery.tackle);
  assert.equal((await state(db, "alice")).certifications.some(c => c.target === "R02"), true);
  assert.deepEqual(personal(await state(db, "bob")), before);
  assert.deepEqual(withoutClock(await snapshot(db, "bob")), beforeCare);
  assert.deepEqual(await bobRows(), rowsBefore);
  assert.deepEqual(await tableSnapshot(db, legacyTables), backup);
  ok(await action(db, "bob", randomUUID(), 1, "walk"));
  assert.equal((await db.query("select busy_action from domine_pet_v22.pet where player_id=$1 and pet_id=1", [a])).rows[0].busy_action, "walk");
});

test("v23: departed and deterministic pickup are global, first-win and streak personal", async t => {
  const db = await openPetDb(); t.after(() => db.close()); await register(db, "alice"); await register(db, "bob");
  const input = { opponentLevel: 1, opponentRank: "resident", individualId: "resident:B001:000", cell: "F1" };
  const first = ok(await start(db, "alice", input)).data;
  assert.equal((await start(db, "bob", input)).code, "SPAWN_BUSY");
  const winA = ok(await finish(db, "alice", first.id)).data;
  const b = await state(db, "bob"); assert.equal(b.departed.some(d => d.individualId === input.individualId), true);
  assert.equal((await start(db, "bob", input)).code, "SPAWN_DEPARTED");
  const second = ok(await start(db, "bob", { ...input, cell: "F2" })).data;
  const winB = ok(await finish(db, "bob", second.id)).data;
  assert.equal(winA.xp, winB.xp); assert.equal(winA.coins, winB.coins); assert.equal(winB.streak, 1);
  const slot = b.slot;
  const cells = [..."ABCDEFGHIJ"].flatMap(c => Array.from({ length: 10 }, (_, i) => c + (i + 1)));
  const cell = cells.find(c => createHash("sha256").update(`${slot}:${c}`).digest().readUInt16BE(0) < 7864);
  assert.ok(cell, "fixture contains a pickup");
  assert.equal(ok(await king(db, "alice", "pickup", { cell, slot })).data.found, true);
  assert.deepEqual(ok(await king(db, "bob", "pickup", { cell, slot })).data, { found: false, coins: 0, pouch: false });
  assert.equal(await count(db, "domine_pet_v17.pickup_claim"), 1);
});

test("v23: request replay/conflict and same request UUID independence in both operation tables", async t => {
  const db = await openPetDb(); t.after(() => db.close()); await register(db, "alice"); await register(db, "bob");
  const id = randomUUID(), slot = (await state(db, "alice")).slot, payload = { cell: "A1", slot };
  const first = ok(await king(db, "alice", "pickup", payload, id));
  const rows = await tableSnapshot(db);
  assert.deepEqual(await king(db, "alice", "pickup", payload, id), first);
  assert.deepEqual(await tableSnapshot(db), rows);
  assert.equal((await king(db, "alice", "pickup", { cell: "A2", slot }, id)).code, "REQUEST_CONFLICT");
  ok(await king(db, "bob", "pickup", { cell: "A2", slot }, id));
  assert.equal(await count(db, "domine_pet_v17.operation"), 2);
  const careId = randomUUID(), fed = ok(await action(db, "alice", careId));
  const cared = await tableSnapshot(db);
  assert.deepEqual(await action(db, "alice", careId), fed); assert.deepEqual(await tableSnapshot(db), cared);
  assert.equal((await action(db, "alice", careId, 2)).code, "REQUEST_CONFLICT");
  ok(await action(db, "bob", careId));
  assert.equal(await count(db, "domine_pet_v6.operation"), 2);
  assert.deepEqual(await rpc(db, "domine_pet_operation_v6", { ...identity("alice"), p_request_id: careId }), fed);
});

test("v23: reads execute in a READ ONLY transaction, including missing rows and missing daily profile", async t => {
  const db = await openPetDb(); t.after(() => db.close()); await register(db, "reader");
  const request = randomUUID(); ok(await action(db, "reader", request));
  // A damaged/missing owner never causes read-side repair.
  await db.query(`insert into domine_pet_v6.player(nickname,nickname_key,secret_hash)
    values('missing','missing',extensions.digest($1,'sha256'))`, [identity("missing").p_secret]);
  await db.exec("delete from domine_pet_v22.spawn_profile");
  const before = await tableSnapshot(db);
  await db.exec("begin read only");
  for (const name of ["reader", "missing"]) {
    for (const kind of ["state", "spawns", "watching", "ranking"]) ok(await king(db, name, kind));
    const s = await snapshot(db, name); assert.equal(s.code, "OK");
    await rpc(db, "domine_pet_state_for", { p_pet: 1, p_nickname: name });
    await rpc(db, "domine_pet_state", { p_nickname: name });
    await rpc(db, "domine_pet_operation_v6", { ...identity(name), p_request_id: request });
    if (name === "missing") {
      assert.equal(s.coins, 0); assert.equal(s.player.xp, 0); assert.equal(s.shared.pet.fullness, 70);
      assert.deepEqual((await state(db, name)).pets.map(p => p.xp), [0, 0]);
    }
  }
  await db.exec("commit"); assert.deepEqual(await tableSnapshot(db), before);
  ok(await action(db, "missing"));
  assert.equal((await snapshot(db, "missing")).shared.pet.care_total, 1);
  assert.equal(await count(db, "domine_pet_v22.spawn_profile"), 1);
});

test("v23: legacy defaults, revocations, internal ACLs and RLS", async t => {
  const db = await openPetDb(); t.after(() => db.close()); await register(db, "alice"); ok(await action(db, "alice"));
  const own = await rpc(db, "domine_pet_state_for", { p_pet: 1, p_nickname: "alice" });
  assert.equal(own.care_total, 1); assert.equal(own.fullness, 100); assert.deepEqual(own.today_top, []); assert.deepEqual(own.recent, []);
  for (const pet of [1, 2]) {
    const fresh = await rpc(db, "domine_pet_state_for", { p_pet: pet, p_nickname: "unknown" });
    assert.equal(fresh.name, pet === 1 ? "도미" : "미네"); assert.equal(fresh.fullness, 70);
    assert.equal(fresh.mood, 70); assert.equal(fresh.clean, 80); assert.equal(fresh.care_total, 0);
    assert.deepEqual(fresh.cooldown, own.cooldown);
  }
  const privileges = (await db.query(`select p.proname, pg_catalog.has_function_privilege('anon',p.oid,'execute') as anon,
    pg_catalog.has_function_privilege('authenticated',p.oid,'execute') as authenticated
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='domine_pet_v22' or (n.nspname='public' and p.proname ~ '^domine_pet_care($|_)')`)).rows;
  assert.ok(privileges.length > 4); for (const p of privileges) { assert.equal(p.anon, false, p.proname); assert.equal(p.authenticated, false, p.proname); }
  const tables = (await db.query(`select c.relname,c.relrowsecurity,pg_catalog.has_table_privilege('anon',c.oid,'select,insert,update,delete') as readable
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='domine_pet_v22' and c.relkind='r'`)).rows;
  for (const row of tables) { assert.equal(row.relrowsecurity, true, row.relname); assert.equal(row.readable, false); }
  await db.exec("set role anon");
  assert.equal((await rpc(db, "domine_pet_state_for", { p_pet: 1, p_nickname: "alice" })).care_total, 1);
  assert.equal((await snapshot(db, "alice")).ok, true);
  await assert.rejects(rpc(db, "domine_pet_care_for", { p_pet: 1, p_nickname: "alice", p_action: "walk" }), /permission denied/);
  await db.exec("reset role");
});

test("v23: only caller tickets expire; another player's expired ticket does not block a spawn", async t => {
  const db = await openPetDb(); t.after(() => db.close()); await register(db, "alice"); await register(db, "bob");
  await db.exec("update domine_pet_v22.wallet set coins=100");
  for (const name of ["alice", "bob"]) ok(await king(db, name, "buyItem", { pet: 1, item: "P01", quantity: 2 }));
  const input = { opponentLevel: 1, items: { P01: 1 } };
  const a = ok(await start(db, "alice", input)).data;
  await db.query("update domine_pet_v17.battle_ticket set expires_at=now()-interval '1 second' where id=$1", [a.id]);
  const b = ok(await start(db, "bob", input)).data;
  assert.equal((await state(db, "alice")).tickets.find(t => t.id === a.id).status, "active");
  assert.equal((await state(db, "alice")).pets[0].inventory.P01, 1);
  await db.query("update domine_pet_v17.battle_ticket set expires_at=now()-interval '1 second' where id=$1", [b.id]);
  ok(await king(db, "alice", "buyItem", { pet: 1, item: "P01", quantity: 1 }));
  assert.equal((await state(db, "alice")).pets[0].inventory.P01, 3);
  assert.equal((await state(db, "bob")).pets[0].inventory.P01, 1);
  assert.equal((await state(db, "bob")).tickets.find(t => t.id === b.id).status, "active");
  ok(await king(db, "alice", "buyItem", { pet: 1, item: "P01", quantity: 1 }));
  assert.equal((await state(db, "alice")).pets[0].inventory.P01, 4, "refund was once only");
});

test("v23: profile uses both pets of recent battlers, then XP fallback, and caches only on writes", async t => {
  const db = await openPetDb(); t.after(() => db.close());
  for (const name of ["alice", "bob", "idle"]) await register(db, name);
  await db.exec(`update domine_pet_v22.progress p set xp=domine_pet_v17.xp_for_level(
    case when player_id=(select id from domine_pet_v6.player where nickname='alice') then pet_id*10
      when player_id=(select id from domine_pet_v6.player where nickname='bob') then 20+pet_id*10 else 900 end);
    update domine_pet_v17.pet_progress set xp=domine_pet_v17.xp_for_level(999);`);
  const a = ok(await start(db, "alice", { cell: "E2" })).data;
  const b = ok(await start(db, "bob", { cell: "E3" })).data;
  await db.exec("delete from domine_pet_v22.spawn_profile");
  let profile = (await state(db, "alice")).levelProfile;
  assert.deepEqual(profile.levels, [8, 18, 25, 33, 42]); assert.equal(profile.players, 2);
  assert.equal(await count(db, "domine_pet_v22.spawn_profile"), 0);
  const slot = (await state(db, "alice")).slot;
  ok(await king(db, "alice", "pickup", { cell: "J10", slot }));
  assert.equal(await count(db, "domine_pet_v22.spawn_profile"), 1);
  assert.deepEqual((await state(db, "idle")).levelProfile, profile);
  await db.query("update domine_pet_v17.battle_ticket set started_at=now()-interval '15 days' where id=$1 or id=$2", [a.id, b.id]);
  await db.exec("delete from domine_pet_v22.spawn_profile");
  profile = (await state(db, "alice")).levelProfile;
  assert.deepEqual(profile.levels, [8, 23, 35, 685, 902]); assert.equal(profile.players, 3);
  // With fewer than three sampled pets, all XP-positive pets form the fallback.
  await db.query("update domine_pet_v17.battle_ticket set started_at=now() where id=$1", [a.id]);
  assert.deepEqual((await state(db, "alice")).levelProfile, profile);
  await db.exec("update domine_pet_v22.progress set xp=0");
  assert.deepEqual((await state(db, "alice")).levelProfile.levels, [1, 2, 3, 4, 5]);
});

test("v23: explore, seasonal album and walk commands keep personal limits and ownership", async t => {
  const db = await openPetDb(); t.after(() => db.close()); await register(db, "alice"); await register(db, "bob");
  let before = withoutClock(await snapshot(db, "bob"));
  const call = (name, args = {}, request = randomUUID()) => rpc(db, `domine_pet_${name}_v6`, {
    ...identity("alice"), p_request_id: request, ...args,
  });
  // Force a guaranteed pity discovery without depending on rarity rolls.
  await db.exec("update domine_pet_v6.player set discovery_misses=4 where nickname='alice'");
  const began = ok(await call("explore_begin", { p_map: "church", p_source: "map" }));
  assert.ok(began.ticket?.id);
  assert.equal((await rpc(db, "domine_pet_explore_finish_v6", { ...identity("bob"), p_request_id: randomUUID(), p_ticket: began.ticket.id, p_pet: 1 })).code, "INVALID_INPUT");
  before = withoutClock(await snapshot(db, "bob"));
  assert.equal((await call("explore_finish", { p_ticket: began.ticket.id, p_pet: 1 })).code, "TOO_EARLY");
  await db.query("update domine_pet_v6.exploration set eligible_at=now()-interval '1 second' where id=$1", [began.ticket.id]);
  const finished = ok(await call("explore_finish", { p_ticket: began.ticket.id, p_pet: 1 }));
  assert.equal(finished.reward.xp, 0); assert.equal(finished.reward.coins, 0);
  assert.equal(finished.reward.newEntries.length, 1); assert.equal(finished.album.length, 1);
  assert.equal(finished.daily.explore_finishes, 1);
  const season = (await db.query(`select id from domine_pet_v6.catalog where acquisition='season'
    and domine_pet_v6.season_for_date_v6((now() at time zone 'Asia/Seoul')::date)=any(seasons) limit 1`)).rows[0];
  if (season) {
    const seasonal = ok(await call("record_season", { p_entry: season.id }));
    assert.ok(seasonal.album.includes(season.id));
  } else {
    assert.equal((await call("record_season", { p_entry: "081" })).code, "INVALID_INPUT");
  }
  const walked = ok(await call("walk_begin")); assert.ok(walked.session?.id);
  assert.equal((await call("walk_claim", { p_session: walked.session.id, p_pet: 2 })).code, "TOO_EARLY");
  await db.query("update domine_pet_v6.walk_session set last_claim_at=now()-interval '151 seconds' where id=$1", [walked.session.id]);
  const claimed = ok(await call("walk_claim", { p_session: walked.session.id, p_pet: 2 }));
  assert.equal(claimed.daily.walk_claims, 1); assert.equal(claimed.reward.xp, 0); assert.equal(claimed.reward.coins, 0);
  ok(await call("walk_end", { p_session: walked.session.id }));
  assert.equal((await call("walk_claim", { p_session: walked.session.id, p_pet: 2 })).code, "EXPIRED");
  assert.deepEqual(withoutClock(await snapshot(db, "bob")), before);
});

test("v23: all eight care effects, decay and refusal gates match v21", async t => {
  const old = await openPetDb({ until: "v21" }), current = await openPetDb();
  t.after(() => old.close()); t.after(() => current.close());
  for (const db of [old, current]) await register(db, "care");
  for (const actionName of ["feed", "treat", "pet", "play", "walk", "brush", "bath", "train"]) {
    for (const full of [false, true]) {
      const meters = full ? "fullness=100,mood=100,clean=100" : "fullness=70,mood=70,clean=60";
      await old.exec(`update public.domine_pet set ${meters},care_total=0,updated_at=now()-interval '1 hour' * ${full ? 0 : 1}; delete from domine_pet_v16.busy`);
      await current.exec(`update domine_pet_v22.pet set ${meters},care_total=0,updated_at=now()-interval '1 hour' * ${full ? 0 : 1},busy_until=null`);
      const a = ok(await action(old, "care", randomUUID(), 1, actionName));
      const b = ok(await action(current, "care", randomUUID(), 1, actionName));
      assert.equal(b.shared.applied, a.shared.applied); assert.equal(b.shared.reason, a.shared.reason);
      for (const field of ["fullness", "mood", "clean", "care_total"]) assert.equal(b.shared.pet[field], a.shared.pet[field], `${actionName}: ${field}`);
      assert.deepEqual(b.reward, a.reward);
    }
  }
});

test("v23: fixed battles reproduce v21 XP, coins, caps, mastery, streak and drops", async t => {
  const old = await openPetDb({ until: "v21" }), current = await openPetDb();
  t.after(() => old.close()); t.after(() => current.close());
  for (const db of [old, current]) await register(db, "rewards");
  const cases = [
    ["win", "resident", 1], ["win", "boss", 10], ["draw", "veteran", 5],
    ["lose", "guest", 1], ["quit", "king", 1], ["win", "king", 1],
  ];
  for (let i = 0; i < cases.length; i++) {
    const [outcome, opponentRank, opponentLevel] = cases[i], results = [];
    for (const db of [old, current]) {
      const ticket = ok(await start(db, "rewards", { cell: `F${i + 1}`, individualId: `N0${i + 1}`, opponentRank, opponentLevel })).data;
      const result = ok(await finish(db, "rewards", ticket.id, { outcome, rounds: outcome === "quit" ? 0 : 3,
        moveCounts: outcome === "quit" ? {} : { tackle: 2 }, weaknesses: [] })).data;
      results.push(result);
    }
    for (const field of ["xp", "coins", "streak", "levelBefore", "levelAfter", "eligible", "drop"])
      assert.deepEqual(results[1][field], results[0][field], `${i}: ${field}`);
    assert.deepEqual({ ...results[1].progress, version: 0 }, { ...results[0].progress, version: 0 });
  }
});

test("v23: legacy 20/minute successful-care cap is per player and never writes the legacy log", async t => {
  const db = await openPetDb(); t.after(() => db.close()); await register(db, "alice"); await register(db, "bob");
  const before = await tableSnapshot(db, legacyTables);
  for (let i = 0; i < 21; i++) {
    await db.exec("update domine_pet_v22.pet set busy_until=null");
    const reply = ok(await action(db, "alice", randomUUID(), 1, "walk"));
    assert.equal(reply.shared.applied, i < 20);
    assert.equal(reply.shared.pet.care_total, Math.min(i + 1, 20));
  }
  assert.equal(ok(await action(db, "bob", randomUUID(), 1, "walk")).shared.applied, true);
  assert.deepEqual(await tableSnapshot(db, legacyTables), before);
});

test("v23: rollback restores exact pre-v23 bodies/ACLs and shared values without changing game data", async t => {
  const db = await legacyFixture(t); await applyFile(db, v22);
  const definitions = async () => (await db.query(`select p.oid::regprocedure::text as name,pg_get_functiondef(p.oid) as body,array(select a::text from unnest(p.proacl) a order by a::text) as acl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','domine_pet_v6','domine_pet_v17','domine_pet_v22') and p.prokind='f' order by name`)).rows;
  const originals = await definitions(), originalState = await state(db, "alice"), originalCare = await snapshot(db, "alice");
  await applyFile(db, v23);
  ok(await king(db, "alice", "buyItem", { pet: 1, item: "P02", quantity: 1 }));
  const before = await tableSnapshot(db);
  await applyFile(db, rollback);
  const after = await tableSnapshot(db);
  before["domine_pet_v17.config"][0].reset_epoch = "20261112-v23r";
  assert.deepEqual(after, before);
  const restored = new Map((await definitions()).map(row => [row.name, row]));
  for (const original of originals) assert.deepEqual(restored.get(original.name), original, original.name);
  const returned = await state(db, "alice");
  assert.equal(returned.resetEpoch, "20261112-v23r");
  assert.deepEqual(personal(returned), personal(originalState));
  assert.deepEqual(withoutClock(await snapshot(db, "alice")), withoutClock(originalCare));
  assert.equal((await rpc(db, "domine_pet_capabilities_v6")).perPlayer, undefined);
});
