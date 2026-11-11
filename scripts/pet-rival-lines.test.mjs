import assert from "node:assert/strict";
import test from "node:test";
import { loadTS } from "./pet-test-loader.mjs";

const { RIVAL_LINES, RIVAL_VARIANT_LINES, RIVAL_TONE_LINES, rivalLine, shouldSpeak } = loadTS("lib/domine/pet-rival-lines.ts");
const species = ["dog", "cat", "pigeon", "magpie", "sparrow", "duck", "squirrel", "raccoon", "waterdeer", "boar", "goblin", "orc", "slime"];
const legacyMoments = ["enter", "taunt", "attack", "hit", "crit_deal", "crit_take", "strong", "weak", "guard", "charge", "rest", "item", "low", "win", "lose", "owner"];
const newMoments = ["flee", "defend", "miss", "effective", "ineffective", "momentum", "finisher", "round"];
const moments = [...legacyMoments, ...newMoments];
const lifecycle = ["enter", "win", "lose", "flee"];
const battle = ["defend", "guard", "miss", "effective", "ineffective", "momentum", "finisher", "round", "taunt", "attack", "hit", "low", "charge", "rest", "item"];
const tones = ["polite", "cocky", "grumpy", "shy", "playful"];
const variants = ["dog:small", "dog:large", "dog:native", "cat:stray", "cat:house"];
const allRows = [...Object.values(RIVAL_LINES), ...Object.values(RIVAL_VARIANT_LINES), ...Object.values(RIVAL_TONE_LINES).flatMap(row => Object.values(row))];
const allLines = allRows.flatMap(row => Object.values(row).flat());
const render = line => line.replaceAll("{name}", "콩이").replaceAll("{owner}", "보호자");

// 성격 미지정 경로의 기존 선택 규칙을 독립적으로 재현한다.
function legacyRoll(seed) {
  let value = seed >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
}
function legacyPick(kind, moment, opts) {
  const variant = opts.variant?.startsWith(`${kind}:`) ? opts.variant : `${kind}:${opts.variant}`;
  if (moment === "owner" && (variant === "cat:stray" || !["dog", "cat"].includes(kind))) return "";
  const name = opts.name?.trim(), owner = opts.owner?.trim();
  const pool = [...RIVAL_LINES[kind][moment], ...(RIVAL_VARIANT_LINES[variant]?.[moment] ?? [])]
    .filter(line => (!line.includes("{name}") || name) && (!line.includes("{owner}") || owner))
    .map(line => line.replaceAll("{name}", name ?? "").replaceAll("{owner}", owner ?? ""))
    .filter(line => Array.from(line).length <= 28 && !/[\r\n]/.test(line));
  const fresh = pool.filter(line => line !== opts.last);
  const choices = fresh.length ? fresh : pool;
  return choices[legacyRoll(opts.seed) % choices.length] ?? "";
}

test("13종 × 24상황과 5개 변형: 기존 대사와 확장 분량, 주인 없는 동물의 예외", () => {
  assert.deepEqual(Object.keys(RIVAL_LINES), species);
  assert.deepEqual(Object.keys(RIVAL_VARIANT_LINES), variants);
  for (const kind of species) {
    const row = RIVAL_LINES[kind];
    assert.deepEqual(Object.keys(row), moments, kind);
    for (const moment of moments) {
      if (moment === "owner" && !["dog", "cat"].includes(kind)) {
        assert.deepEqual(row[moment], [], `${kind}:owner`);
      } else {
        const minimum = lifecycle.includes(moment) ? 8 : newMoments.includes(moment) ? 4 : ["dog", "cat"].includes(kind) ? 8 : 4;
        assert.ok(row[moment].length >= minimum, `${kind}:${moment}`);
      }
    }
    const count = Object.values(row).flat().length;
    assert.ok(count >= (["dog", "cat"].includes(kind) ? 150 : 60), `${kind}: ${count}`);
  }
  for (const variant of variants) {
    assert.deepEqual(Object.keys(RIVAL_VARIANT_LINES[variant]), [...legacyMoments, "flee"], variant);
    for (const moment of [...legacyMoments, "flee"]) {
      const lines = RIVAL_VARIANT_LINES[variant][moment];
      assert.ok(variant === "cat:stray" && moment === "owner" ? lines.length === 0 : lines.length >= (moment === "flee" ? 4 : lifecycle.includes(moment) ? 6 : 2), `${variant}:${moment}`);
    }
  }
  assert.ok(allLines.length >= 4600, `전체 ${allLines.length}줄`);
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
          assert.equal(first, legacyPick(kind, moment, opts));
          assert.equal(first, rivalLine(kind, moment, opts), `${kind}:${moment}:${seed}`);
          if (!allowed.length) {
            assert.equal(first, "");
            continue;
          }
          assert.ok(allowed.includes(first), first);
          const next = rivalLine(kind, moment, { ...opts, last: first });
          assert.equal(next, legacyPick(kind, moment, { ...opts, last: first }));
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

test("발화 확률: 등장·승패·도망 100%, 결정기·기세 80%, 크리티컬 70%, 전투 30%, 기타 25%", () => {
  for (const moment of moments) {
    const expected = lifecycle.includes(moment) ? 1 : ["finisher", "momentum"].includes(moment) ? 0.8
      : ["crit_deal", "crit_take"].includes(moment) ? 0.7 : battle.includes(moment) && moment !== "guard" ? 0.3 : 0.25;
    let spoken = 0;
    for (let seed = 0; seed < 10000; seed++) {
      const result = shouldSpeak(moment, seed);
      assert.equal(result, legacyRoll(seed) % 100 < expected * 100, `${moment}:${seed}`);
      assert.equal(typeof result, "boolean");
      assert.equal(result, shouldSpeak(moment, seed));
      spoken += Number(result);
    }
    if (expected === 1) assert.equal(spoken, 10000, moment);
    else assert.ok(Math.abs(spoken / 10000 - expected) < 0.02, `${moment}: ${spoken / 10000}`);
  }
});


test("모든 종·성격의 인사·승패·도망 4줄, 전투 15상황 2줄 이상", () => {
  assert.deepEqual(Object.keys(RIVAL_TONE_LINES), species);
  for (const kind of species) {
    assert.deepEqual(Object.keys(RIVAL_TONE_LINES[kind]), tones, kind);
    for (const tone of tones) {
      const row = RIVAL_TONE_LINES[kind][tone];
      assert.deepEqual(Object.keys(row).sort(), [...lifecycle, ...battle].sort(), `${kind}:${tone}`);
      for (const moment of [...lifecycle, ...battle]) {
        assert.ok(row[moment].length >= (lifecycle.includes(moment) ? 4 : 2), `${kind}:${tone}:${moment}`);
      }
    }
  }
});

test("성격 지정 시 1000개 시드의 60~80%는 해당 성격, 나머지는 공통·변형 대사", () => {
  for (const kind of species) for (const tone of tones) {
    for (const variant of [undefined, ...variants.filter(v => v.startsWith(`${kind}:`))]) {
      for (const moment of [...lifecycle, ...battle]) {
        const toneLines = new Set(RIVAL_TONE_LINES[kind][tone][moment].map(render));
        const commonLines = new Set([...RIVAL_LINES[kind][moment], ...(RIVAL_VARIANT_LINES[variant]?.[moment] ?? [])].map(render));
        const selected = new Set();
        let toned = 0;
        for (let seed = 0; seed < 1000; seed++) {
          const opts = { seed, tone, variant, name: "콩이", owner: "보호자" };
          const first = rivalLine(kind, moment, opts);
          assert.ok(toneLines.has(first) || commonLines.has(first), `${kind}:${tone}:${moment}: ${first}`);
          selected.add(first);
          toned += Number(toneLines.has(first));
          if (seed < 16) {
            assert.equal(first, rivalLine(kind, moment, opts));
            const next = rivalLine(kind, moment, { ...opts, last: first });
            assert.notEqual(next, first);
            assert.ok(toneLines.has(next) || commonLines.has(next));
            if (variant) assert.equal(first, rivalLine(kind, moment, { ...opts, variant: variant.split(":")[1] }));
          }
        }
        assert.ok(toned >= 600 && toned <= 800, `${kind}:${tone}:${variant}:${moment}: ${toned}/1000`);
        for (const line of toneLines) assert.ok(selected.has(line), `성격 대사 도달 불가: ${line}`);
      }
    }
  }
});

test("성격 미정의 상황은 기존 결과 유지, 성격 미지정은 모든 입력에서 기존 규칙 유지", () => {
  for (const kind of species) for (const moment of moments) {
    for (const variant of [undefined, "unknown", ...variants]) {
      for (const seed of [0, 1, 17, -1, 2 ** 32 - 1, 2 ** 32 + 17]) {
        for (const value of [undefined, "", "  ", " 콩이 ", "가".repeat(40), "첫줄\n둘째줄", "🐾".repeat(40)]) {
          const opts = { seed, variant, name: value, owner: value };
          const first = rivalLine(kind, moment, opts);
          assert.equal(first, legacyPick(kind, moment, opts));
          assert.equal(rivalLine(kind, moment, { ...opts, last: first }), legacyPick(kind, moment, { ...opts, last: first }));
          for (const tone of tones) {
            if (!RIVAL_TONE_LINES[kind][tone][moment]) assert.equal(rivalLine(kind, moment, { ...opts, tone }), first);
          }
        }
      }
    }
  }
});

test("성격 경로도 자리표시자·28자·줄바꿈·직전 대사 제한을 지킨다", () => {
  for (const kind of species) for (const tone of tones) for (const moment of [...lifecycle, ...battle, "owner"]) {
    for (const value of [undefined, "", "  ", " 콩이 ", "가".repeat(40), "이름\n다음줄", "이름\r다음줄", "🐾".repeat(40)]) {
      for (const seed of [0, 1, 9, 17, -1, 99, 12345, 2 ** 32 - 1]) {
        const opts = { seed, tone, name: value, owner: value };
        const first = rivalLine(kind, moment, opts);
        assert.ok(Array.from(first).length <= 28, first);
        assert.doesNotMatch(first, /[\r\n{}]/);
        if (first) assert.notEqual(rivalLine(kind, moment, { ...opts, last: first }), first);
      }
    }
  }
});
