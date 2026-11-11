import assert from "node:assert/strict";
import test from "node:test";
import { loadTS } from "./pet-test-loader.mjs";

const { RIVAL_LINES, RIVAL_VARIANT_LINES, rivalLine, shouldSpeak } = loadTS("lib/domine/pet-rival-lines.ts");
const species = ["dog", "cat", "pigeon", "magpie", "sparrow", "duck", "squirrel", "raccoon", "waterdeer", "boar", "goblin", "orc", "slime"];
const moments = ["enter", "taunt", "attack", "hit", "crit_deal", "crit_take", "strong", "weak", "guard", "charge", "rest", "item", "low", "win", "lose", "owner"];
const variants = ["dog:small", "dog:large", "dog:native", "cat:stray", "cat:house"];
const allRows = [...Object.values(RIVAL_LINES), ...Object.values(RIVAL_VARIANT_LINES)];
const allLines = allRows.flatMap(row => Object.values(row).flat());
const render = line => line.replaceAll("{name}", "콩이").replaceAll("{owner}", "보호자");

test("13종 × 16상황과 5개 변형: 줄 수 및 주인 없는 동물의 예외", () => {
  assert.deepEqual(Object.keys(RIVAL_LINES), species);
  assert.deepEqual(Object.keys(RIVAL_VARIANT_LINES), variants);
  for (const kind of species) {
    const row = RIVAL_LINES[kind];
    assert.deepEqual(Object.keys(row), moments, kind);
    for (const moment of moments) {
      if (moment === "owner" && !["dog", "cat"].includes(kind)) {
        assert.deepEqual(row[moment], [], `${kind}:owner`);
      } else {
        assert.ok(row[moment].length >= (["dog", "cat"].includes(kind) ? 8 : 4), `${kind}:${moment}`);
      }
    }
    const count = Object.values(row).flat().length;
    assert.ok(count >= (["dog", "cat"].includes(kind) ? 150 : 60), `${kind}: ${count}`);
  }
  for (const variant of variants) {
    assert.deepEqual(Object.keys(RIVAL_VARIANT_LINES[variant]), moments, variant);
    for (const moment of moments) {
      const lines = RIVAL_VARIANT_LINES[variant][moment];
      assert.ok(variant === "cat:stray" && moment === "owner" ? lines.length === 0 : lines.length >= 2, `${variant}:${moment}`);
    }
  }
  assert.ok(allLines.length >= 1100, `전체 ${allLines.length}줄`);
});

test("모든 대사는 한 줄 28자 이하이며 전체에서 중복되지 않는다", () => {
  const seen = new Set();
  for (const line of allLines) {
    assert.equal(typeof line, "string");
    assert.equal(line, line.trim());
    assert.ok(line.length > 0 && Array.from(line).length <= 28, `${Array.from(line).length}자: ${line}`);
    assert.doesNotMatch(line, /[\r\n]/);
    assert.doesNotMatch(line.replaceAll("{name}", "").replaceAll("{owner}", ""), /[{}]/);
    assert.ok(!seen.has(line), `중복: ${line}`);
    seen.add(line);
  }
});

test("모든 종·상황·변형에서 시드 재현, 직전 대사 회피, 유효한 대사 반환", () => {
  for (const kind of species) {
    for (const variant of [undefined, ...variants.filter(v => v.startsWith(`${kind}:`))]) {
      for (const moment of moments) {
        const owned = moment !== "owner" || (["dog", "cat"].includes(kind) && variant !== "cat:stray");
        const allowed = owned ? [...RIVAL_LINES[kind][moment], ...(RIVAL_VARIANT_LINES[variant]?.[moment] ?? [])].map(render) : [];
        for (const seed of [0, 1, 2, 17, 99, 100, 12345, -1, -12345, 2 ** 32 - 1]) {
          const opts = { seed, variant, name: "콩이", owner: "보호자" };
          const first = rivalLine(kind, moment, opts);
          assert.equal(first, rivalLine(kind, moment, opts), `${kind}:${moment}:${seed}`);
          if (!allowed.length) {
            assert.equal(first, "");
            continue;
          }
          assert.ok(allowed.includes(first), first);
          const next = rivalLine(kind, moment, { ...opts, last: first });
          assert.ok(allowed.includes(next), next);
          assert.notEqual(next, first, `${kind}:${moment}:${variant}`);
          if (variant) assert.equal(first, rivalLine(kind, moment, { ...opts, variant: variant.split(":")[1] }));
        }
      }
    }
  }
});

test("이름·주인 자리표시자는 주어진 값으로 치환하고 값이 없으면 해당 줄을 고르지 않는다", () => {
  for (const kind of ["dog", "cat"]) {
    for (const variant of [undefined, ...variants.filter(v => v.startsWith(`${kind}:`))]) {
      for (const moment of ["enter", "owner"]) {
        const selected = new Set();
        for (let seed = 0; seed < 1024; seed++) {
          const opts = { seed, variant, name: " 콩이 ", owner: " 보호자 " };
          const full = rivalLine(kind, moment, opts);
          selected.add(full);
          assert.doesNotMatch(full, /[{}]/);
          for (const absent of [undefined, "", "   "]) {
            const missing = rivalLine(kind, moment, { seed, variant, name: absent, owner: absent });
            assert.doesNotMatch(missing, /[{}]/);
            const untemplated = [...RIVAL_LINES[kind][moment], ...(RIVAL_VARIANT_LINES[variant]?.[moment] ?? [])].filter(line => !/[{}]/.test(line));
            assert.ok(missing === "" || untemplated.includes(missing), missing);
          }
        }
        if (variant === "cat:stray" && moment === "owner") continue;
        const templates = [...RIVAL_LINES[kind][moment], ...(RIVAL_VARIANT_LINES[variant]?.[moment] ?? [])].filter(line => /[{}]/.test(line));
        for (const template of templates) {
          const expanded = render(template);
          assert.ok(selected.has(expanded), `선택되지 않은 대사: ${expanded}`);
          for (let seed = 0; seed < 32; seed++) {
            assert.notEqual(rivalLine(kind, moment, { seed, variant, name: "콩이", owner: "보호자", last: expanded }), expanded);
          }
        }
      }
    }
  }
});

test("긴 이름이나 줄바꿈을 넣어도 말풍선 글자 수와 한 줄 조건을 지킨다", () => {
  for (const value of ["가".repeat(40), "이름\n둘째줄", "주인\r이름", "🐾".repeat(40)]) {
    for (let seed = 0; seed < 128; seed++) {
      for (const kind of ["dog", "cat"]) for (const moment of ["enter", "owner"]) {
        const line = rivalLine(kind, moment, { seed, name: value, owner: value });
        assert.ok(Array.from(line).length <= 28, line);
        assert.doesNotMatch(line, /[\r\n{}]/);
      }
    }
  }
  assert.equal(rivalLine("dog", "enter", { seed: 7, variant: "unknown" }), rivalLine("dog", "enter", { seed: 7 }));
  assert.equal(rivalLine("dog", "enter", { seed: 7, variant: "cat:house" }), rivalLine("dog", "enter", { seed: 7 }));
});

test("발화 확률: 등장·승리·패배 100%, 크리티컬·위기 70%, 나머지 25%", () => {
  for (const moment of moments) {
    const expected = ["enter", "win", "lose"].includes(moment) ? 1 : ["crit_deal", "crit_take", "low"].includes(moment) ? 0.7 : 0.25;
    let spoken = 0;
    for (let seed = 0; seed < 10000; seed++) {
      const result = shouldSpeak(moment, seed);
      assert.equal(typeof result, "boolean");
      assert.equal(result, shouldSpeak(moment, seed));
      spoken += Number(result);
    }
    if (expected === 1) assert.equal(spoken, 10000, moment);
    else assert.ok(Math.abs(spoken / 10000 - expected) < 0.02, `${moment}: ${spoken / 10000}`);
  }
});
