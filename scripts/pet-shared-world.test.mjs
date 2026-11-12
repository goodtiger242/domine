import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTS } from "./pet-test-loader.mjs";

const { pickSpawns, profileLevel, validProfile, SPAWN_RATE, STARTER_LEVEL, STARTER_RATE, SLOT_MS, STAY_MS } = loadTS("lib/domine/king/spawn.ts");
const { REGIONS, SAFE_CELLS } = loadTS("lib/domine/king/world.ts");
const { PET_WORLD } = loadTS("lib/domine/pet-world.ts");
const view = loadTS("lib/domine/pet-battle-view.ts");
const rules = loadTS("lib/domine/pet-job-rules.ts");
const { MOVE_BY_ID } = loadTS("lib/domine/battle/data.ts");
const { buildFighter } = loadTS("lib/domine/battle/engine.ts");
const profile = { day: "2026-11-12", levels: [3, 8, 14, 20, 32] };
const cells = PET_WORLD.filter(cell => !SAFE_CELLS.includes(cell.id));
const residents = (cell, slot, level, shared) => pickSpawns(cell, slot, level, shared).filter(s => s.kind === "resident");

test("공용 출현: 연습 기간이 지나면 드물게, 15분만, 모두에게 같은 동물·같은 레벨", () => {
  let occupied = 0, total = 0, starters = 0;
  for (let slot = 500; slot < 700; slot++) for (const cell of cells) {
    const shared = residents(cell.id, slot, 20, profile), starter = residents(cell.id, slot, STARTER_LEVEL - 1, profile);
    total++; occupied += Number(shared.length > 0); starters += Number(starter.length > 0);
    assert.deepEqual(shared, residents(cell.id, slot, 60, profile), "level 20 and level 60 dogs see identical animals");
    assert.ok(shared.every(s => starter.some(x => x.individual.id === s.individual.id)), "a starter sees everything a veteran sees");
    for (const spawn of shared) {
      assert.equal(spawn.until - spawn.from, STAY_MS);
      assert.ok(spawn.from >= slot * SLOT_MS && spawn.until <= (slot + 1) * SLOT_MS && spawn.from % 60000 === 0);
      assert.ok(spawn.level >= 1 && spawn.level <= profile.levels[4] + 3);
    }
    for (const spawn of starter) {
      assert.deepEqual([spawn.from, spawn.until], [slot * SLOT_MS, (slot + 1) * SLOT_MS], "practice animals stay the whole slot");
      assert.ok(spawn.level <= STARTER_LEVEL - 1 + 5, "practice animals follow the dog's own level");
    }
  }
  assert.ok(Math.abs(occupied / total - SPAWN_RATE) < .015, `shared ${occupied / total}`);
  assert.ok(Math.abs(starters / total - STARTER_RATE) < .015, `starter ${starters / total}`);
});

test("레벨 분포: 성당 근처는 아래쪽, 먼 구역은 위쪽, 전체로는 고르게", () => {
  const mean = region => { const levels = []; for (let slot = 0; slot < 400; slot++) for (const cell of region.cells) levels.push(...residents(cell, slot, 20, profile).map(s => s.level)); return levels.reduce((a, b) => a + b, 0) / levels.length; };
  const means = REGIONS.map(mean);
  assert.ok(means[0] < means[4] && means[4] < means[9], means.map(m => m.toFixed(1)).join(" "));
  assert.ok(means[0] < profile.levels[2] && means[9] > profile.levels[2], "home below the median, the far end above it");
  assert.equal(profileLevel(profile, "E1", 0, 0), profile.levels[0]);
  assert.equal(profileLevel(profile, "A7", 1, 0), profile.levels[4]);
  assert.equal(profileLevel(profile, "A7", 1, 3), profile.levels[4] + 3);
  assert.equal(profileLevel({ day: "", levels: [1, 1, 1, 1, 1] }, "E1", .3, -3), 1);
  for (const bad of [null, undefined, { day: "", levels: [1, 2, 3] }, { day: "", levels: [5, 4, 3, 2, 1] }, { day: "", levels: [0, 1, 2, 3, 4] }]) assert.equal(validProfile(bad), false);
  const slot = 123, cell = cells.find(c => residents(c.id, slot, 20).length).id;
  assert.ok(residents(cell, slot, 20).every(s => s.level >= 15 && s.level <= 25), "without a profile (older server) levels follow our dog");
});

test("화면: 머무는 시간 밖의 동물은 숨기고, 이름 있는 동물은 시간대 내내 보인다", () => {
  const slot = 4321, cell = cells.find(c => view.spawnsFor(c.id, 20, slot, [], { profile }).some(e => e.kind === "resident")).id;
  const foe = view.spawnsFor(cell, 20, slot, [], { profile }).find(e => e.kind === "resident");
  const ids = now => view.spawnsFor(cell, 20, slot, [], { profile, now }).map(e => e.id);
  assert.ok(ids(foe.from).includes(foe.id) && ids(foe.until - 1).includes(foe.id));
  assert.ok(!ids(foe.until).includes(foe.id) && (foe.from === slot * SLOT_MS || !ids(foe.from - 1).includes(foe.id)));
  const boss = view.spawnsFor("E1", 20, slot, [], { profile, now: slot * SLOT_MS + 1 }).find(e => e.kind === "named");
  assert.equal(boss.individual.name, "봉돌"); assert.equal(boss.level, 10);
});

test("직업 규칙: 시작·전직·바꾸기 조건이 서버 규칙과 같다", () => {
  const base = { level: 10, job: null, jobTier: 0, jobChangedAt: null };
  assert.deepEqual(rules.jobPlan({ ...base, level: 9 }, "striker", { coins: 0, regions: [] }).blocks, [{ kind: "level", need: 10 }, { kind: "boss" }]);
  assert.deepEqual(rules.jobPlan(base, "striker", { coins: 0, regions: ["R01"] }), { tier: 1, step: "start", cost: 0, blocks: [] });
  const held = { level: 30, job: "striker", jobTier: 1, jobChangedAt: "2026-11-12T00:00:00Z" };
  assert.deepEqual(rules.jobPlan(held, "striker", { coins: 100, regions: ["R01", "R02"] }).blocks, [{ kind: "marks", have: 2, need: 3 }, { kind: "coins", have: 100, need: 120 }]);
  assert.deepEqual(rules.jobPlan(held, "striker", { coins: 120, regions: ["R01", "R02", "R03"] }), { tier: 2, step: "promote", cost: 120, blocks: [] });
  const now = Date.parse("2026-11-12T10:00:00Z");
  assert.deepEqual(rules.jobPlan(held, "defender", { coins: 300, regions: [], now }), { tier: 1, step: "switch", cost: 300, blocks: [{ kind: "cooldown", hours: 14 }] });
  assert.deepEqual(rules.jobPlan(held, "defender", { coins: 299, regions: [], now: now + 86400000 }).blocks, [{ kind: "coins", have: 299, need: 300 }]);
  assert.equal(rules.jobPlan({ ...held, jobTier: 3 }, "striker", { coins: 0, regions: [] }).step, "max");
  for (const job of rules.KING_JOBS) {
    const moves = rules.jobMoves(job);
    assert.deepEqual(moves.map(m => m.learn.level), [10, 15, 30, 40, 60, 80]); assert.deepEqual(moves.map(m => m.learn.tier), [1, 1, 2, 2, 3, 3]);
    assert.equal(rules.jobChanges(job, 1).filter(c => c.percent > 0).length, 2); assert.equal(rules.jobChanges(job, 3)[0].percent, 8);
  }
  assert.equal(rules.jobName("striker", 3), "선봉대장");
  assert.equal(rules.recommendedJob({ hp: 100, attack: 30, defense: 10, speed: 30, focus: 12, calm: 10 }), "striker");
  assert.equal(rules.recommendedJob({ hp: 100, attack: 8, defense: 12, speed: 10, focus: 30, calm: 30 }), "empath");
});

test("직업 기술: 따로 두 칸, 일반 기술은 그대로, 조건이 안 되면 붙지 않는다", () => {
  const growth = (job, jobTier, level) => ({ pet: 1, xp: 0, streak: 0, level, allocation: { hp: 0, attack: 0, defense: 0, speed: 0, focus: 0, calm: 0 }, unspent: 0, allocationMode: "auto", job, jobTier, jobChangedAt: null, moves: [], version: 1, mastery: {}, inventory: {} });
  const special = fighter => fighter.moves.filter(id => MOVE_BY_ID[id].learn?.job);
  for (const pet of [1, 2]) for (const job of rules.KING_JOBS) for (const [tier, level] of [[1, 10], [1, 16], [2, 45], [3, 80], [3, 200]]) {
    const plain = view.battlePlayer(pet, level, undefined, [], undefined, growth(null, 0, level)), fighter = view.battlePlayer(pet, level, undefined, [], undefined, growth(job, tier, level));
    assert.deepEqual(fighter.moves.filter(id => !MOVE_BY_ID[id].learn?.job), plain.moves, "regular skills are untouched");
    assert.equal(special(fighter).length, level < 15 ? 1 : 2);
    assert.ok(special(fighter).every(id => MOVE_BY_ID[id].learn.job === rules.KING_JOB_IDS[job] && MOVE_BY_ID[id].learn.tier <= tier && MOVE_BY_ID[id].learn.level <= level));
    const unlocked = rules.jobMoves(job).filter(m => m.learn.tier <= tier && m.learn.level <= level);
    if (unlocked.some(m => m.kind === "attack")) assert.ok(special(fighter).some(id => MOVE_BY_ID[id].kind === "attack"), "an attack is included whenever the job has one unlocked");
  }
  assert.equal(special(view.battlePlayer(1, 9, undefined, [], undefined, growth("striker", 1, 9))).length, 0, "below the job level nothing is added");
  assert.throws(() => buildFighter("B001", 10, [], { moves: ["T01", "T02", "T03", "T04", "T05"] }), "the regular slot limit still holds without a job");
});

test("직업 화면: 조건·기술·버튼을 보여 준다", () => {
  const Sheet = loadTS("app/games/PetJobSheet.tsx").default;
  const growth = { pet: 1, xp: 0, streak: 0, level: 12, allocation: { hp: 0, attack: 0, defense: 0, speed: 0, focus: 0, calm: 0 }, unspent: 0, allocationMode: "auto", job: null, jobTier: 0, jobChangedAt: null, moves: [], version: 1, mastery: {}, inventory: {} };
  const html = props => renderToStaticMarkup(createElement(Sheet, { petId: 1, growth, coins: 50, certifications: [], onClose() {}, onMap() {}, chooseJob: async () => ({ ok: true, code: "OK" }), ...props }));
  const locked = html({});
  for (const text of ["도미 직업", "아직 직업이 없어요", "추천", "직업 기술", "구역 대장 봉돌을 이기면 열려요", "지도 열기"]) assert.ok(locked.includes(text), text);
  assert.equal((locked.match(/role="radio"/g) ?? []).length, 5); assert.equal((locked.match(/<li data-open=/g) ?? []).length, 6);
  assert.match(locked, /class="pet-job-confirm"[^>]*disabled=""/);
  const ready = html({ certifications: [{ pet: 1, kind: "region", target: "R01", at: "" }, { pet: 2, kind: "region", target: "R02", at: "" }] });
  assert.ok(!ready.includes("이기면 열려요")); assert.doesNotMatch(ready, /class="pet-job-confirm"[^>]*disabled=""/); assert.match(ready, / 되기</);
  const promote = html({ growth: { ...growth, level: 30, job: "striker", jobTier: 1 }, coins: 120, certifications: ["R01", "R02", "R03"].map(target => ({ pet: 1, kind: "region", target, at: "" })) });
  for (const text of ["돌격수", "현재", "선봉수로 전직", "🪙 120", "사용 중"]) assert.ok(promote.includes(text), text);
});

test("레벨 차가 상성보다 크다: 12레벨 위면 불리해도 체력을 적게 잃고, 3레벨 아래면 대개 진다", async () => {
  const { duel } = await import("./pet-balance-report.mjs");
  const big = duel({ level: 16, gap: 12, relation: "weak", samples: 6 });
  assert.equal(big.win, 100); assert.ok(big.hpLost <= 30, `hp lost ${big.hpLost}%`);
  const even = duel({ level: 16, gap: 0, relation: "weak", samples: 6 }), ahead = duel({ level: 16, gap: 3, relation: "weak", samples: 6 });
  assert.ok(ahead.win > even.win + 10, `+3 levels ${ahead.win}% vs even ${even.win}%`);
});

test("랭킹: 서버 응답에서 Lv.2 이상만 받고, 서버가 아직 없으면 준비 중으로 보인다", async () => {
  const { createPetApi } = loadTS("lib/domine/pet-rpc.ts");
  let reply = { data: { 1: [{ nickname: "bob", level: 20, xp: 9 }, { nickname: "x", level: 1 }, { level: 9 }], 2: "bad" }, error: null };
  const api = createPetApi(async name => (assert.equal(name, "domine_pet_level_ranking_v24"), reply));
  assert.deepEqual(await api.ranking(), { 1: [{ nickname: "bob", level: 20, xp: 9 }], 2: [] });
  const { places } = loadTS("app/games/PetRankSheet.tsx");
  assert.deepEqual(places([{ level: 16, xp: 1936 }, { level: 16, xp: 1845 }, { level: 16, xp: 1845 }, { level: 9, xp: 400 }]), [1, 2, 2, 4], "equal level and XP share a place");
  const full = renderToStaticMarkup(createElement(loadTS("app/games/PetRankSheet.tsx").default, { petId: 2, nickname: "최선호", onClose() {}, load: async () => null }));
  assert.match(full, /경험치가 많은 쪽이 위/);
  reply = { data: null, error: { code: "PGRST202", message: "missing" } };
  assert.equal(await api.ranking(), null);
  const Sheet = loadTS("app/games/PetRankSheet.tsx").default;
  const html = renderToStaticMarkup(createElement(Sheet, { petId: 2, nickname: "bob", load: async () => null, onClose() {} }));
  for (const text of ["랭킹", "도미 랭킹", "미네 랭킹", "불러오는 중", "Lv.2부터 순위에 올라요"]) assert.ok(html.includes(text), text);
  assert.match(html, /aria-selected="true"[^>]*>미네 랭킹/);
});

test("난이도 색: 레벨·상성·직업이 반영되고, 단계가 승률 순서와 맞는다", async () => {
  const { sample } = await import("./pet-difficulty-report.mjs");
  const { DIFFICULTY_LABEL, DIFFICULTIES, foeDifficulty, powerRatio } = loadTS("lib/domine/pet-difficulty.ts");
  assert.deepEqual(DIFFICULTIES.map(d => DIFFICULTY_LABEL[d]), ["쉬움", "보통", "조금 어려움", "어려움"]);
  const rows = sample({ levels: [8, 16, 30], perLevel: 90, seeds: 3 });
  const mean = d => { const g = rows.filter(r => r.difficulty === d); return g.reduce((a, r) => a + r.win, 0) / Math.max(1, g.length); };
  assert.ok(mean("easy") >= .95 && mean("normal") >= .7 && mean("normal") < mean("easy") && mean("hard") < mean("normal") && mean("deadly") <= .2,
    DIFFICULTIES.map(d => `${d} ${mean(d).toFixed(2)}`).join(" "));
  // The same animal gets easier as our dog levels up, and a stronger dog never rates it harder.
  const { battlePlayer, spawnsFor } = loadTS("lib/domine/pet-battle-view.ts");
  const growth = level => ({ pet: 1, xp: 0, streak: 0, level, allocation: { hp: 0, attack: 0, defense: 0, speed: 0, focus: 0, calm: 0 }, unspent: 0, allocationMode: "auto", job: null, jobTier: 0, jobChangedAt: null, moves: [], version: 1, mastery: {}, inventory: {} });
  const foe = PET_WORLD.flatMap(c => spawnsFor(c.id, 20, 5000, [], { profile: { day: "x", levels: [10, 14, 18, 22, 26] } }))[0];
  const ratios = [6, 12, 20, 35, 60].map(level => powerRatio(battlePlayer(1, level, undefined, [], undefined, growth(level)), foe.fighter));
  assert.deepEqual([...ratios].sort((a, b) => a - b), ratios, `stronger dog, higher ratio: ${ratios.map(r => r.toFixed(2))}`);
  assert.equal(foeDifficulty(battlePlayer(1, 60, undefined, [], undefined, growth(60)), foe.fighter), "easy");
});

test("난이도 색: 장면·지도·겨루기 창에 단계와 초록 테두리가 붙고, 계산이 없으면 아무것도 붙지 않는다", () => {
  const profile = { day: "x", levels: [3, 8, 14, 22, 36] };
  const slot = 2468, foes = new Map(PET_WORLD.map(c => [c.id, view.spawnsFor(c.id, 12, slot, [], { profile })]));
  const cell = PET_WORLD.find(c => foes.get(c.id).length >= 2), here = foes.get(cell.id);
  const levels = ["easy", "normal", "hard", "deadly"], rate = e => levels[Math.max(0, here.findIndex(x => x.id === e.id)) % 4];
  const World = loadTS("app/games/PetWorldSheet.tsx").default, Scene = loadTS("app/games/PetScene.tsx").PetScene;
  const map = props => renderToStaticMarkup(createElement(World, { current: "E5", visited: [], slot, wins: [], careLevel: 12, showAnimals: true, profile, onMove() {}, onClose() {}, ...props }));
  const withRate = map({ rate });
  assert.ok(withRate.includes('data-level="easy"') && withRate.includes('data-level="deadly"'));
  assert.match(withRate, /이길 만한 상대/); assert.match(withRate, /data-fair="true"/); assert.match(withRate, /쉬움[\s\S]*보통[\s\S]*조금 어려움[\s\S]*어려움/);
  const plain = map({});
  assert.doesNotMatch(plain, /data-level=|이길 만한 상대|pet-world-legend/, "no rating, no colors");
  const scene = renderToStaticMarkup(createElement(Scene, { encounters: here, rate, stage: "adult", face: "happy", light: 1, hour: 12, collar: "#fff", cue: null, onSay() {}, onEncounter() {}, onBattle() {}, cellId: cell.id }));
  assert.ok(scene.includes('data-level="easy"') && scene.includes("쉬움,"), "name plate color and spoken label");
  const Sheet = loadTS("app/games/PetEncounterSheet.tsx").default;
  const list = renderToStaticMarkup(createElement(Sheet, { encounters: here, selected: null, petId: 1, onSelect() {}, onStart() {}, onClose() {}, rate }));
  assert.match(list, /class="pet-diff" data-level="easy">쉬움</); assert.match(list, /조금 어려움/);
  const card = renderToStaticMarkup(createElement(Sheet, { encounters: here, selected: here[0], petId: 1, onSelect() {}, onStart() {}, onClose() {}, rate }));
  assert.match(card, /class="pet-diff" data-level="easy">쉬움</);
});
