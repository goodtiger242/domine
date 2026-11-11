import assert from "node:assert/strict";
import test from "node:test";
import { loadTS } from "./pet-test-loader.mjs";

const { NAME_POOL, pickName } = loadTS("lib/domine/king/name-pool.ts");
const baseWeights = { common: 40, funny: 25, human: 15, grand: 15, local: 5 };
const speciesList = ["dog", "cat", "bird", "wild", "monster"];
const banned = [
  "씨발", "시발", "씨팔", "시팔", "씹새", "개새끼", "새끼", "병신", "븅신", "등신",
  "미친놈", "미친년", "지랄", "염병", "좆", "좇", "닥쳐", "꺼져", "멍청이", "바보",
  "찐따", "찐찌", "호구", "한남", "한녀", "틀딱", "급식충", "맘충", "벌레", "장애인",
];

test("400개 이상, 2~6자 한국어 이름, 중복·금지어 없음, 톤 비율 ±5%p", () => {
  assert.ok(NAME_POOL.length >= 400);
  assert.equal(new Set(NAME_POOL.map(({ name }) => name)).size, NAME_POOL.length);
  for (const entry of NAME_POOL) {
    assert.match(entry.name, /^[가-힣0-9]{2,6}$/);
    assert.match(entry.name, /[가-힣]/);
    assert.ok(Object.hasOwn(baseWeights, entry.tone));
    assert.ok(["dog", "cat", "any"].includes(entry.for));
    assert.ok(!banned.some((word) => entry.name.includes(word)), entry.name);
  }
  for (const [tone, weight] of Object.entries(baseWeights)) {
    const count = NAME_POOL.filter((entry) => entry.tone === tone).length;
    assert.ok(Math.abs(count / NAME_POOL.length * 100 - weight) <= 5, tone);
  }
  for (const target of ["dog", "cat", "any"]) {
    assert.ok(NAME_POOL.some((entry) => entry.tone === "common" && entry.for === target));
  }
});

test("시드 결정성, 전용 이름의 종 제한, 외부 상태 변경 없음", () => {
  for (const species of speciesList) {
    for (const seed of [0, 1, -1, 42, 4294967295, Number.MAX_SAFE_INTEGER]) {
      const opts = { species, taken: new Set(["초코", "대왕마마"]) };
      const before = [...opts.taken];
      const first = pickName(seed, opts);
      assert.deepEqual(first, pickName(seed, opts));
      assert.deepEqual([...opts.taken], before);
      assert.deepEqual(Object.keys(first).sort(), ["name", "tone"]);
      assert.ok(NAME_POOL.some((entry) => entry.name === first.name && entry.tone === first.tone
        && (entry.for === "any" || entry.for === species)));
      assert.ok(!opts.taken.has(first.name));
    }
  }
});

test("taken 회피, 톤 고갈 시 재분배, 마지막 후보 선택, 전부 소진 시 명시적 오류", () => {
  const allNames = NAME_POOL.map(({ name }) => name);
  for (const species of speciesList) {
    const taken = new Set();
    const eligible = NAME_POOL.filter((entry) => entry.for === "any" || entry.for === species);
    for (let seed = 0; seed < eligible.length; seed++) {
      const result = pickName(seed, { species, taken });
      assert.ok(!taken.has(result.name));
      taken.add(result.name);
    }
    assert.equal(taken.size, eligible.length);
    assert.throws(() => pickName(1, { species, taken }), RangeError);
    for (const tone of Object.keys(baseWeights)) {
      const taken = new Set(NAME_POOL.filter((entry) => entry.tone !== tone).map(({ name }) => name));
      assert.equal(pickName(42, { species, taken }).tone, tone);
    }
    const last = new Set(allNames.filter((name) => name !== "당정이"));
    assert.deepEqual(pickName(42, { species, taken: last }), { name: "당정이", tone: "local" });
  }
});

test("선택 가중치 ±3%p, 새·야생·수상한 손님의 funny·grand 비중 증가", () => {
  for (const species of speciesList) {
    const expected = ["dog", "cat"].includes(species)
      ? baseWeights : { common: 25, funny: 30, human: 10, grand: 30, local: 5 };
    const counts = Object.fromEntries(Object.keys(baseWeights).map((tone) => [tone, 0]));
    for (let seed = 0; seed < 5000; seed++) {
      const result = pickName(seed, { species });
      const entry = NAME_POOL.find((entry) => entry.name === result.name);
      assert.ok(entry && (entry.for === "any" || entry.for === species));
      counts[result.tone]++;
    }
    for (const [tone, weight] of Object.entries(expected)) {
      assert.ok(Math.abs(counts[tone] / 50 - weight) <= 3, `${species}:${tone}`);
    }
  }
});
