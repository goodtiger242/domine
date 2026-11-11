import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { loadTS } from "./pet-test-loader.mjs";

const Sheet = loadTS("app/games/PetStatusSheet.tsx").default;
const Progress = loadTS("app/games/PetProgress.tsx").default;
const allocation = { hp: 6, attack: 4, defense: 2, speed: 3, focus: 3, calm: 0 };
const growth = { pet: 2, xp: 130, streak: 3, level: 7, allocation, unspent: 0, allocationMode: "auto", job: null, jobTier: 0, jobChangedAt: null, moves: [], version: 1, mastery: {}, inventory: {} };
const html = renderToStaticMarkup(createElement(Sheet, { petId: 2, growth, condition: { fullness: 30, mood: 70, clean: 80 }, stage: "adult", onClose() {} }));
for (const text of ["미네 정보", "미네 Lv.7", "3연승", "체력", "공격력", "방어력", "민첩", "집중", "침착", "크리티컬", "기운", "직업 아직 없어요", "컨디션 −", "특성 ·", "장착 기술"]) assert.ok(html.includes(text), text);
assert.equal((html.match(/<li data-kind=/g) ?? []).length >= 3, true, "equipped moves listed");

// Without server data the sheet still renders from the level-1 defaults.
const bare = renderToStaticMarkup(createElement(Sheet, { petId: 1, stage: "baby", onClose() {} }));
assert.ok(bare.includes("도미 Lv.1") && !bare.includes("컨디션 −"));

// The (i) button next to the level opens it.
let opened = 0;
const bar = renderToStaticMarkup(createElement(Progress, { name: "미네", xp: 10, level: 5, coins: 32, onInfo() { opened++; } }));
assert.ok(bar.includes('aria-label="미네 정보 보기"'));
assert.ok(!renderToStaticMarkup(createElement(Progress, { name: "미네", xp: 10, level: 5, coins: 32 })).includes("정보 보기"));
console.log("Pet status sheet: stats, moves, job, condition, info button passed.");

// Compare every displayed stat with the same player construction used by battle.
const engine = loadTS("lib/domine/battle/engine.ts");
const { spawnsFor } = loadTS("lib/domine/pet-battle-view.ts");
const { PET_WORLD } = loadTS("lib/domine/pet-world.ts");
const Battle = loadTS("app/games/PetBattleSheet.tsx").default;
const originalCreateBattle = engine.createBattle;
let battlePlayer;
engine.createBattle = input => { const battle = originalCreateBattle(input); battlePlayer = battle.player; return battle; };
for (const petId of [1, 2]) for (const level of [1, 2, 7, 30]) for (const allocationMode of ["auto", "manual"]) for (const condition of [{ fullness: 70, mood: 70, clean: 80 }, { fullness: 10, mood: 20, clean: 5 }]) {
  const encounter = PET_WORLD.flatMap(cell => spawnsFor(cell.id, level, 996001))[0];
  const snapshot = { ...growth, pet: petId, level, allocationMode, job: level >= 30 ? "striker" : null, jobTier: level >= 30 ? 2 : 0 };
  renderToStaticMarkup(createElement(Battle, { petId, encounter, growth: snapshot, condition, stage: "adult", hour: 12, onClose() {} }));
  const rendered = renderToStaticMarkup(createElement(Sheet, { petId, growth: snapshot, condition, stage: "adult", onClose() {} }));
  assert.deepEqual([...rendered.matchAll(/<em>(\d+)<\/em>/g)].map(match => Number(match[1])), Object.values(battlePlayer.stats));
  assert.equal((rendered.match(/<li data-kind=/g) ?? []).length, battlePlayer.moves.length + Number(!!battlePlayer.finisher));
  if (snapshot.job) assert.match(rendered, /직업 선봉수/);
}
engine.createBattle = originalCreateBattle;
const held = renderToStaticMarkup(createElement(Sheet, { petId: 2, growth: { ...growth, inventory: { P01: 2, P04: 1 } }, stage: "adult", onClose() {} }));
assert.match(held, /소모품 2종 · 3개/);
assert.doesNotMatch(html, /소모품/);
const reward = { ticket: "confirmed", outcome: "win", xp: 21, coins: 3, levelBefore: 1, levelAfter: 1 };
const resultBar = renderToStaticMarkup(createElement(Progress, { name: "도미", xp: 21, level: 1, coins: 3, reward }));
assert.match(resultBar, /XP \+21 · 🪙 \+3 · Lv\.2까지 15 XP/);
const levelUp = renderToStaticMarkup(createElement(Progress, { name: "도미", xp: 40, level: 2, coins: 6, reward: { ...reward, levelAfter: 2 } }));
assert.match(levelUp, /Lv\.3까지 44 XP/);
assert.doesNotMatch(bar, /XP \+/);
console.log("Pet status: battle stat parity, held quantities, confirmed reward and next-level XP passed.");
