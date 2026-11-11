import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";

// The existing TS test loader cannot load the catalog's JSON manifests.
const require = createRequire(import.meta.url), cache = new Map();
function load(path) {
  const absolute = resolve(path);
  if (cache.has(absolute)) return cache.get(absolute);
  if (absolute.endsWith(".json")) return JSON.parse(readFileSync(absolute, "utf8"));
  const exports = {}; cache.set(absolute, exports);
  const source = ts.transpileModule(readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "exports", source)(name => name.startsWith(".") ? load(resolve(dirname(absolute), name + (name.endsWith(".json") ? "" : ".ts"))) : require(name), exports);
  return exports;
}
const { SPECIES, BREEDS, BREED_BY_ID, GROUPS, SIZE_BUDGET, asBattleBreed } = load("lib/domine/king/species.ts");
const { INDIVIDUALS, makeIndividual, FORM_TAGS, INTELLIGENCE, OWNER_TITLES, NAME_POOLS, SINGLE_NAMES, RESERVED_NAMES, intelligenceFor } = load("lib/domine/king/individuals.ts");
const { REGIONS, habitatOf, levelRange, regionOf, HABITAT_WEIGHTS, SAFE_CELLS } = load("lib/domine/king/world.ts");
const { NAMED } = load("lib/domine/king/named.ts");
const { pickSpawns, GUEST_RATE } = load("lib/domine/king/spawn.ts");
const { PET_WORLD } = load("lib/domine/pet-world.ts");
const engine = load("lib/domine/battle/data.ts");
const { BATTLE_PROFILES, BREED_PROFILE_BONUSES, DEFAULT_PROFILE, profileFor } = load("lib/domine/battle/profiles.ts");

test("종 성향 점수 0±1·품종 한 가지 ±1점·체급 연결·기운 독립", () => {
  // Status dealt uses the same 15% step as status taken, with the opposite sign.
  const score = p => p.critBonus / 2 + (p.critMultiplier - 1.5) / .08 + (p.momentumRate - 1) / .1
    + p.evade / 2 + (p.restEnergy - 5) * 2 + (1 - p.statusTaken) / .15 + (p.statusDealt - 1) / .15
    + Object.values(p.statTilt).reduce((sum,value) => sum + value / .06,0);
  assert.equal(Object.keys(BATTLE_PROFILES).length,14);
  for (const [id,p] of Object.entries(BATTLE_PROFILES)) {
    assert.ok(Math.abs(score(p)) <= 1 + 1e-9,`${id}: ${score(p)}`);
    assert.ok(p.critBonus >= -2 && p.critBonus <= 4 && p.critMultiplier >= 1.4 && p.critMultiplier <= 1.65);
    assert.ok(p.momentumRate >= .85 && p.momentumRate <= 1.25 && p.evade >= 0 && p.evade <= 4);
    assert.ok([5,6].includes(p.restEnergy) && p.statusTaken >= .7 && p.statusTaken <= 1.2);
    assert.ok(Object.values(p.statTilt).every(value => Math.abs(value) <= .12));
  }
  for (const { bonus } of Object.values(BREED_PROFILE_BONUSES)) {
    assert.equal(Object.keys(bonus).length,1);
    if (bonus.statTilt) assert.equal(Object.keys(bonus.statTilt).length,1);
    assert.ok(Math.abs(score({ ...DEFAULT_PROFILE, ...bonus })) <= 1 + 1e-9);
  }
  for (const b of BREEDS) {
    const species = b.species === "waterdeer" ? "deer" : b.species;
    assert.deepEqual(b.battleProfile,profileFor(species,b.id));
    if (species === "dog" && !BREED_PROFILE_BONUSES[b.id]) assert.deepEqual(b.battleProfile,BATTLE_PROFILES[`dog_${b.size}`]);
    for (const group of GROUPS) assert.deepEqual(asBattleBreed(b.id,group).battleProfile,b.battleProfile);
  }
  assert.deepEqual(profileFor("cat","B003"),BATTLE_PROFILES.cat);
  assert.throws(() => profileFor("__proto__"));
  const copy = profileFor("cat"); copy.statTilt.hp = 0;
  assert.equal(profileFor("cat").statTilt.hp,-.06);
});

test("12종·64형과 비활성 손님 3종: 기존 품종 보존, 신규 체급 예산, 모든 그림·변형 존재", () => {
  assert.equal(SPECIES.filter(s => s.active).length, 12);
  assert.equal(BREEDS.length, 64);
  assert.equal(BREEDS.filter(b => b.species === "dog").length, 32);
  assert.equal(BREEDS.filter(b => b.species === "cat").length, 12);
  assert.equal(new Set(BREEDS.map(b => b.id)).size, 64);
  for (const guest of SPECIES.filter(s => s.category === "guest")) {
    assert.equal(guest.active, false); assert.equal(guest.art, null);
    assert.ok(!INDIVIDUALS.some(i => i.species === guest.id));
  }
  assert.equal(SPECIES.filter(s => s.category === "guest").length, 3);
  for (const breed of BREEDS) {
    assert.ok(!("group" in breed));
    assert.ok(engine.GROWTH[breed.growth]);
    assert.ok(engine.BREEDS.some(b => b.trait === breed.trait));
    assert.ok(existsSync(resolve("public", breed.art.slice(1))), breed.art);
    for (const variant of breed.variants) {
      assert.ok(existsSync(resolve("public", variant.art.slice(1))), variant.art);
      assert.ok(variant.look.length > 0);
    }
    assert.equal(breed.variants.length, ["dog", "cat"].includes(breed.species) ? 3 : 0);
    const old = engine.BREEDS.find(b => b.id === breed.id);
    if (old) {
      for (const key of ["id", "name", "size", "temperament", "base", "growth", "trait", "learn"]) assert.deepEqual(breed[key], old[key], `${breed.id}:${key}`);
    } else {
      const total = Object.values(breed.base).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(total / SIZE_BUDGET[breed.size] - 1) <= .08, breed.id);
    }
    for (const group of GROUPS) assert.equal(asBattleBreed(breed.id, group).group, group);
  }
});

test("512개 시드·ID·종별 이름 유일, 기운·태그·외형·주인·컨디션 유효", () => {
  assert.equal(INDIVIDUALS.length, 512);
  assert.equal(new Set(INDIVIDUALS.map(i => i.id)).size, 512);
  assert.deepEqual(INDIVIDUALS.map(i => i.seed), Array.from({ length: 512 }, (_, i) => i));
  assert.ok(SINGLE_NAMES.length >= 200);
  assert.equal(new Set(Object.values(OWNER_TITLES).flat()).size, 60);
  const names = new Set();
  for (const individual of INDIVIDUALS) {
    const { name, species, breedId, seed, owner, appearance, statShift } = individual;
    const breed = BREED_BY_ID[breedId];
    assert.ok(name.length > 0 && name.length <= 8, name);
    assert.ok(!names.has(`${species}:${name}`), name); names.add(`${species}:${name}`);
    assert.ok(NAME_POOLS[species].length >= 512);
    assert.ok(GROUPS.includes(individual.group));
    assert.ok(FORM_TAGS.includes(individual.weakness));
    assert.ok(FORM_TAGS.includes(individual.resistance));
    assert.notEqual(individual.weakness, individual.resistance);
    assert.ok(INTELLIGENCE.includes(individual.intelligence));
    assert.deepEqual(individual, makeIndividual(species, seed));
    assert.equal(breed.species, species);
    assert.ok(breed.habitat.includes(habitatOf(individual.homeCellId)));
    assert.ok(existsSync(resolve("public", appearance.art.slice(1))));
    assert.ok([breed.art, ...breed.variants.map(v => v.art)].includes(appearance.art));
    assert.ok(appearance.look.length > 0);
    assert.ok(individual.levelOffset >= -3 && individual.levelOffset <= 3);
    assert.equal(Object.entries(statShift).reduce((sum, [s, v]) => sum + (s === "hp" ? v / 4 : v), 0), 0);
    for (const value of Object.values(individual.condition)) assert.ok(value >= 0 && value <= 100);
    if (owner) assert.ok(OWNER_TITLES[individual.habitat].includes(owner.title));
    else assert.equal(individual.ownerLabel, "길에서 지냄");
    if (!["cat", "dog"].includes(species)) assert.equal(owner, null);
  }
  for (const breed of BREEDS) {
    const individuals = INDIVIDUALS.filter(i => i.breedId === breed.id);
    assert.equal(individuals.length, 8, breed.id);
    assert.equal(individuals.filter(i => i.owner).length, breed.species === "dog" ? 7 : breed.species === "cat" ? breed.id === "C01" ? 2 : 8 : 0);
    assert.ok(new Set(individuals.map(i => i.group)).size >= 2, breed.id);
  }
  const average = owned => {
    const selected = INDIVIDUALS.filter(i => Boolean(i.owner) === owned);
    return selected.reduce((sum, i) => sum + i.condition.fullness + i.condition.mood + i.condition.clean, 0) / selected.length / 3;
  };
  assert.ok(average(true) > average(false) + 10);
  assert.equal(intelligenceFor("kind", 3), "순둥이");
  assert.equal(intelligenceFor("lively", 15), "보통");
  assert.equal(intelligenceFor("careful", 16), "노련");
});

test("100칸·10구역 누락·중복 0, 설계서 구역 경계·레벨·실제 지명 서식지", () => {
  const cells = REGIONS.flatMap(r => r.cells);
  assert.equal(cells.length, 100); assert.equal(new Set(cells).size, 100);
  assert.deepEqual([...cells].sort(), PET_WORLD.map(c => c.id).sort());
  const columns = ["EF", "CD", "GH", "IJ", "AB", "CD", "EF", "GH", "IJ", "AB"];
  for (const [i, region] of REGIONS.entries()) {
    assert.equal(region.bossLevel, 10 + i * 6);
    assert.deepEqual(region.levelRange, [1 + i * 6, 7 + i * 6]);
    assert.ok(region.cells.every(id => columns[i].includes(id[0]) && (Number(id.slice(1)) <= 5) === (i < 5)));
    for (const cell of region.cells) {
      assert.equal(regionOf(cell).id, region.id);
      const habitat = habitatOf(cell);
      assert.ok(HABITAT_WEIGHTS[habitat]);
      assert.ok(INDIVIDUALS.some(p => BREED_BY_ID[p.breedId].habitat.includes(habitat) && HABITAT_WEIGHTS[habitat][p.species] > 0));
    }
  }
  for (const [id, expected] of Object.entries({ A8: "forest", H8: "river", H9: "river", G9: "river", E10: "river", H10: "forest", G2: "road", G5: "park", F3: "shops", D3: "housing", J6: "housing", H7: "station", C6: "school", I9: "industry" })) assert.equal(habitatOf(id), expected, id);
});

test("1000구간×98칸 출몰 분포와 입력 재현·서식 가중치·개체 중복·레벨 범위", () => {
  const counts = [0, 0, 0, 0], speciesCounts = {}, habitatTotals = {};
  for (let slot = 0; slot < 1000; slot++) for (const cell of PET_WORLD) {
    const spawns = pickSpawns(cell.id, slot, 1);
    if (SAFE_CELLS.includes(cell.id)) { assert.deepEqual(spawns, []); continue; }
    assert.ok(spawns.length <= 3); counts[spawns.length]++;
    assert.equal(new Set(spawns.map(s => s.individual.id)).size, spawns.length);
    if (slot < 3) {
      assert.deepEqual(spawns, pickSpawns(cell.id, slot, 1));
      assert.deepEqual(spawns, pickSpawns(cell.id, slot, 999).filter(s => s.kind === "resident"));
    }
    const habitat = habitatOf(cell.id), [min, max] = levelRange(cell.id);
    for (const spawn of spawns) {
      assert.equal(spawn.kind, "resident");
      assert.ok(spawn.level >= min && spawn.level <= max);
      assert.ok(Math.abs(spawn.level - (min + max) / 2) <= 3);
      assert.ok(BREED_BY_ID[spawn.individual.breedId].habitat.includes(habitat));
      assert.ok(HABITAT_WEIGHTS[habitat][spawn.individual.species] > 0);
      const key = `${habitat}:${spawn.individual.species}`;
      speciesCounts[key] = (speciesCounts[key] ?? 0) + 1;
      habitatTotals[habitat] = (habitatTotals[habitat] ?? 0) + 1;
    }
  }
  const total = counts.reduce((a, b) => a + b, 0), expected = [.7, .3 * .65, .3 * .25, .3 * .1];
  counts.forEach((count, i) => assert.ok(Math.abs(count / total - expected[i]) < .008, `${i}마리: ${count / total}`));
  for (const habitat of Object.keys(habitatTotals)) {
    const weights = HABITAT_WEIGHTS[habitat], sum = Object.values(weights).reduce((a, b) => a + b, 0);
    for (const [species, weight] of Object.entries(weights)) assert.ok(Math.abs((speciesCounts[`${habitat}:${species}`] ?? 0) / habitatTotals[habitat] - weight / sum) < .06, `${habitat}:${species}`);
  }
  assert.ok(GUEST_RATE >= .05 && GUEST_RATE <= .08);
  console.log("일반 출몰 비율(0/1/2/3):", counts.map(n => (n / total * 100).toFixed(2) + "%").join(" / "));
});

test("네임드 35마리: 10구역 대장·20칸 대장·4길목·1싸움왕, 고정 출현 조건과 전용 대사", () => {
  assert.equal(NAMED.length, 35);
  assert.deepEqual([...RESERVED_NAMES].sort(), NAMED.map(n => n.name).sort());
  assert.equal(new Set([...INDIVIDUALS, ...NAMED].map(i => i.id)).size, 547);
  assert.equal(new Set([...INDIVIDUALS, ...NAMED].map(i => `${i.species}:${i.name}`)).size, 547);
  for (const [rank, count] of Object.entries({ "region-boss": 10, "cell-chief": 20, gatekeeper: 4, king: 1 })) assert.equal(NAMED.filter(n => n.rank === rank).length, count);
  for (const region of REGIONS) {
    const boss = NAMED.filter(n => n.regionId === region.id && n.rank === "region-boss");
    assert.equal(boss.length, 1); assert.equal(boss[0].baseLevel, region.bossLevel);
    assert.equal(NAMED.filter(n => n.regionId === region.id && n.rank === "cell-chief").length, 2);
  }
  assert.equal(new Set(NAMED.flatMap(n => Object.values(n.lines))).size, 105);
  for (const named of NAMED) {
    assert.ok(named.story.length > 0 && named.name.length <= 8);
    assert.ok(BREED_BY_ID[named.breedId]);
    assert.equal(BREED_BY_ID[named.breedId].species, named.species);
    assert.ok(GROUPS.includes(named.group));
    assert.notEqual(named.weakness, named.resistance);
    assert.equal(named.intelligence, named.rank === "king" ? "싸움왕" : "대장");
    assert.ok(!pickSpawns(named.cellId, 0, named.minCareLevel - 1).some(s => s.individual.id === named.id));
    for (const slot of [0, 17, 123456]) assert.ok(pickSpawns(named.cellId, slot, named.minCareLevel).some(s => s.individual.id === named.id && s.level === named.baseLevel));
    for (const moment of ["enter", "win", "lose"]) assert.ok(named.lines[moment].length > 0 && named.lines[moment].length <= 28);
  }
});

test("잘못된 입력 거부, 비정상 돌봄 레벨 정규화", () => {
  for (const seed of [-1, .1, NaN, Infinity, 2 ** 32]) assert.throws(() => makeIndividual("dog", seed), RangeError);
  for (const species of ["unknown", "goblin", "orc", "slime"]) assert.throws(() => makeIndividual(species, 0), RangeError);
  for (const cell of ["", "A0", "K1", "A11", "__proto__"]) {
    assert.throws(() => regionOf(cell), RangeError); assert.throws(() => habitatOf(cell), RangeError);
    assert.throws(() => pickSpawns(cell, 0, 1), RangeError);
  }
  for (const slot of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => pickSpawns("A1", slot, 1), RangeError);
  for (const level of [NaN, Infinity, -5]) assert.deepEqual(pickSpawns("C1", 1, level), pickSpawns("C1", 1, 1));
  assert.throws(() => asBattleBreed("missing", "bond"), RangeError);
  assert.throws(() => asBattleBreed("__proto__", "bond"), RangeError);
});
