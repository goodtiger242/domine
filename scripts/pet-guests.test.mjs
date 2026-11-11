import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import sharp from "sharp";
import { loadTS } from "./pet-test-loader.mjs";

const { INDIVIDUALS, makeIndividual } = loadTS("lib/domine/king/individuals.ts");
const { BREED_BY_ID, SIZE_BUDGET } = loadTS("lib/domine/king/species.ts");
const { NAMED } = loadTS("lib/domine/king/named.ts");
const { HABITAT_WEIGHTS, habitatOf, SAFE_CELLS } = loadTS("lib/domine/king/world.ts");
const { pickSpawns } = loadTS("lib/domine/king/spawn.ts");
const { PET_WORLD } = loadTS("lib/domine/pet-world.ts");
const { spawnsFor, encounterLine, battleCues } = loadTS("lib/domine/pet-battle-view.ts");
const { buildFighter, createBattle, stepRound } = loadTS("lib/domine/battle/engine.ts");
const { chooseAction } = loadTS("lib/domine/battle/ai.ts");
const { GUEST_BREEDS, BREED_BY_ID: ENGINE_BREEDS, MOVES, powerBudget } = loadTS("lib/domine/battle/data.ts");
const { learnset } = loadTS("lib/domine/battle/learnset.ts");
const { RIVAL_LINES } = loadTS("lib/domine/pet-rival-lines.ts");
const guests = INDIVIDUALS.slice(512);
const species = ["goblin", "orc", "slime"];
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("기존 512개체·296기술의 데이터와 ID 보존, 손님 24마리 추가", () => {
  assert.equal(hash(INDIVIDUALS.slice(0, 512)), "a48f49c59e99bf125e9400a506e926d622f15a047037a96618b76aaa75722a7c");
  assert.equal(hash(MOVES.slice(0, 296)), "2ac2833437a514a73d8eaba78c562cbcb90b309ea0b6837136321a8c9f487276");
  assert.equal(guests.length, 24);
  assert.equal(new Set(guests.map(g => g.name)).size, 24);
  assert.deepEqual(GUEST_BREEDS.map(b => b.id), ["G01", "G03", "G05"]);
  for (const guest of guests) {
    const breed = BREED_BY_ID[guest.breedId], engine = ENGINE_BREEDS[guest.breedId];
    assert.deepEqual(guest, makeIndividual(guest.species, guest.seed));
    assert.equal(guest.owner, null);
    assert.ok(["순둥이", "보통"].includes(guest.intelligence));
    for (const key of ["base", "growth", "size", "temperament", "trait"]) assert.deepEqual(breed[key], engine[key]);
    assert.deepEqual([...breed.habitat].sort(), Object.keys(HABITAT_WEIGHTS).sort());
    assert.ok(Math.abs(Object.values(breed.base).reduce((a,b) => a+b, 0) / SIZE_BUDGET[breed.size] - 1) <= .08);
  }
});

test("손님 그림 6장: WebP·투명 배경·480px·총 150KB 이하", async () => {
  let bytes = 0;
  const hashes = new Set();
  for (let i = 1; i <= 6; i++) {
    const path = `public/pet/breed/G0${i}.webp`;
    bytes += statSync(path).size;
    hashes.add(createHash("sha256").update(readFileSync(path)).digest("hex"));
    const metadata = await sharp(path).metadata(), stats = await sharp(path).stats();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 480);
    assert.equal(metadata.height, 480);
    assert.equal(metadata.hasAlpha, true);
    assert.equal(stats.isOpaque, false);
    assert.ok(statSync(path).size <= 31000, path);
  }
  assert.equal(hashes.size, 6);
  assert.ok(bytes <= 150000, `${bytes} bytes`);
  console.log(`손님 그림 6장 ${bytes} bytes`);
});

test("손님 고유 기술은 종당 3개, 타종 학습 불가·기력 예산·기존 비용 분포 유지", () => {
  const added = MOVES.slice(296);
  assert.equal(added.length, 9);
  for (const kind of species) {
    const own = added.filter(m => m.learn.species === kind);
    assert.equal(own.length, 3);
    for (const move of own) {
      assert.equal(move.power, powerBudget(move.energy, move));
      assert.ok(learnset(kind, "wild", "bond", 100).includes(move.id));
      for (const other of ["dog", ...species.filter(s => s !== kind)]) assert.ok(!learnset(other, "wild", "bond", 100).includes(move.id));
    }
  }
  const budgeted = MOVES.filter(m => /^M/.test(m.id) && (Number(m.id.slice(1)) <= 202 || added.includes(m)));
  const counts = [m => m.energy <= 1, m => m.energy >= 2 && m.energy <= 4, m => m.energy >= 5];
  counts.forEach((predicate, i) => assert.ok(Math.abs(budgeted.filter(predicate).length / budgeted.length - [.2,.55,.25][i]) <= .05));
});

test("1000구간×칸: 손님 5~8%, 숲 우대·모든 서식지·24개체·변형 모두 실제 출현", () => {
  const counts = {}, seen = new Set(), art = new Set();
  for (let slot = 0; slot < 1000; slot++) for (const cell of PET_WORLD) {
    const habitat = habitatOf(cell.id);
    const bucket = counts[habitat] ??= { total: 0, guest: 0 };
    for (const spawn of pickSpawns(cell.id, slot, 1)) {
      bucket.total++;
      if (!species.includes(spawn.individual.species)) continue;
      bucket.guest++;
      seen.add(spawn.individual.id);
      art.add(spawn.individual.appearance.art);
      assert.ok(!SAFE_CELLS.includes(cell.id));
    }
  }
  assert.equal(seen.size, 24);
  assert.equal(art.size, 6);
  const total = Object.values(counts).reduce((n,b) => n+b.total, 0);
  const guest = Object.values(counts).reduce((n,b) => n+b.guest, 0);
  assert.ok(guest / total >= .05 && guest / total <= .08);
  for (const [habitat, bucket] of Object.entries(counts)) assert.ok(bucket.guest > 0 && bucket.guest / bucket.total >= .05 && bucket.guest / bucket.total <= .08, habitat);
  const forest = counts.forest;
  assert.ok(forest.guest / forest.total > (guest-forest.guest) / (total-forest.total));
  console.log("손님 서식지별 비율", JSON.stringify(Object.fromEntries(Object.entries(counts).map(([h,b]) => [h, +(100*b.guest/b.total).toFixed(3)]))));
});

test("24개체 spawnsFor→createBattle→종료 3072판: 실제 품종·대사·효과·레벨 경계", () => {
  const fixtures = new Map();
  for (let slot = 0; slot < 1000 && fixtures.size < 24; slot++) for (const cell of PET_WORLD) {
    if (NAMED.some(n => n.cellId === cell.id)) continue;
    if (!pickSpawns(cell.id, slot, 1).some(s => species.includes(s.individual.species))) continue;
    for (const encounter of spawnsFor(cell.id, 1, slot)) if (species.includes(encounter.individual.species) && !fixtures.has(encounter.individual.id)) fixtures.set(encounter.individual.id, encounter);
  }
  assert.equal(fixtures.size, 24);
  let completed = 0;
  const levels = [1, 10, 30, 60, 100, 300, 999];
  for (const fixture of fixtures.values()) {
    for (const moment of Object.keys(RIVAL_LINES[fixture.individual.species])) {
      const line = encounterLine(fixture, moment, fixture.individual.seed);
      assert.equal(Boolean(line), moment !== "owner", `${fixture.name}:${moment}`);
      assert.ok(!/[{}]/.test(line));
    }
    assert.ok(fixture.name.length <= 9);
    assert.equal(fixture.name, `${BREED_BY_ID[fixture.individual.breedId].name} ${fixture.given}`);
    assert.equal(spawnsFor(fixture.cellId, 1, fixture.slot, [fixture.id]).some(e => e.id === fixture.id), false);
    for (let sample = 0; sample < 128; sample++) {
      const level = levels[sample % levels.length];
      const encounter = spawnsFor(fixture.cellId, level, fixture.slot).find(e => e.id === fixture.id);
      assert.ok(encounter);
      assert.equal(encounter.fighter.breedId, encounter.individual.breedId);
      assert.equal(encounter.fighter.species, encounter.individual.species);
      assert.ok(["gentle", "normal"].includes(encounter.fighter.aiTier));
      const player = buildFighter(sample % 2 ? "B001" : "B002", level, [], {species:"dog"});
      let state = createBattle({ seed: 500000 + sample * 101 + fixture.individual.seed, player, opponent: encounter.fighter });
      const initial = structuredClone(state);
      const first = chooseAction({...state, player:state.opponent, opponent:state.player}, "normal");
      if (sample === 0) assert.deepEqual(stepRound({...state, rng:first.rng}, first.action), stepRound({...state, rng:first.rng}, first.action));
      while (!state.outcome) {
        assert.ok(state.round <= 12);
        const pick = chooseAction({...state, player:state.opponent, opponent:state.player}, "normal");
        const next = stepRound({...state, rng:pick.rng}, pick.action);
        if (sample === 0) assert.doesNotThrow(() => battleCues(next.events, {player:"도미", opponent:encounter.name}));
        state = next.state;
        for (const side of ["player","opponent"]) {
          assert.ok(Number.isFinite(state[side].hp) && state[side].hp >= 0);
          assert.ok(state[side].energy >= 0 && state[side].energy <= 10);
        }
      }
      assert.ok(["player","opponent","draw"].includes(state.outcome));
      assert.equal(initial.opponent.breedId, encounter.individual.breedId);
      completed++;
    }
  }
  assert.equal(completed, 3072);
  console.log(`실제 손님 전투 ${completed}판 완료`);
});

test("실제 손님 품종과 도미·미네·다른 손님 동급 대결 35~65%", () => {
  const { ELEMENTS } = loadTS("lib/domine/battle/moves.ts");
  const roster = [["B001","dog"], ["B002","dog"], ["G01","goblin"], ["G03","orc"], ["G05","slime"]];
  const results = [];
  for (let i = 2; i < roster.length; i++) for (let j = 0; j < i; j++) {
    let first = 0, second = 0, total = 0, rounds = 0, limit = 0, short = 0;
    for (let seed = 0; seed < 144; seed++) for (const reverse of [false,true]) {
      const [id, species] = roster[i], [otherId, otherSpecies] = roster[j], element = ELEMENTS[seed % 6];
      const a = buildFighter(id,30,[],{species,element}), b = buildFighter(otherId,30,[],{species:otherSpecies,element});
      let state = createBattle({seed:350000+seed*101,player:reverse?b:a,opponent:reverse?a:b,aiTier:"normal"});
      while (!state.outcome) {
        const pick = chooseAction({...state,player:state.opponent,opponent:state.player},"normal");
        state = stepRound({...state,rng:pick.rng},pick.action).state;
      }
      first += state.outcome === (reverse ? "opponent" : "player");
      second += state.outcome === (reverse ? "player" : "opponent");
      total++; rounds += state.round; limit += state.round === 12; short += state.round <= 3;
    }
    const result = {pair:`${roster[i][0]}/${roster[j][0]}`,first:first/total*100,second:second/total*100,rounds:rounds/total,limit:limit/total*100,short:short/total*100};
    results.push(result);
  }
  console.log("실제 품종 대결",JSON.stringify(results));
  for (const r of results) {
    assert.ok(r.first >= 35 && r.first <= 65 && r.second >= 35 && r.second <= 65,JSON.stringify(r));
    assert.ok(r.rounds >= 6 && r.rounds <= 10 && r.limit <= 15 && r.short <= 5,JSON.stringify(r));
  }
});


