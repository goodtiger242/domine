import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadTS } from "./pet-test-loader.mjs";

const { MOVES, PUSH } = loadTS("lib/domine/battle/data.ts");
const { BATTLE_MOVE_FX, battleFxId } = loadTS("lib/domine/pet-battle-fx.ts");
const { actionLabel, battleCues, battleEffectId, moveEffect } = loadTS("lib/domine/pet-battle-view.ts");
const { buildFighter, createBattle, previewDamage } = loadTS("lib/domine/battle/engine.ts");
const css = readFileSync("app/games/pet-game.css", "utf8");
const names = { player: "미네", opponent: "친구" };

test("26개 기술: 빠짐·중복 없는 모션/궤적과 0.5~1.1초 길이, 실제 CSS 정의", () => {
  assert.ok(Object.keys(BATTLE_MOVE_FX).every(id => ["push", "rest"].includes(id) || MOVES.some(move => move.id === id)));
  for (const move of MOVES) assert.ok(BATTLE_MOVE_FX[battleEffectId(move.id)]);
  for (const field of ["motion", "trail", "suffix"]) assert.equal(new Set(Object.values(BATTLE_MOVE_FX).map(f => f[field])).size, 26);
  for (const fx of Object.values(BATTLE_MOVE_FX)) {
    assert.ok(fx.duration >= 500 && fx.duration <= 1100);
    assert.ok(fx.elements.length);
    for (const name of [`pet-move-${fx.motion}`, `pet-trail-${fx.trail}`, ...(fx.reaction === "none" ? [] : [`pet-react-${fx.reaction}`])]) assert.ok(css.includes(`@keyframes ${name} {`), name);
    for (const element of fx.elements.filter(e => e.startsWith("fx-"))) assert.ok(readFileSync(`public/pet/battle/${element}.webp`).length);
  }
  assert.equal(battleFxId({ kind: "item", itemId: "I19" }), undefined);
  assert.equal(battleFxId({ kind: "quit" }), undefined);
});

test("새 키프레임은 transform·opacity·filter만, 양방향 및 이동 줄이기 규칙", () => {
  const blocks = css.match(/@keyframes pet-(?:move|trail|react|heavy)-[^{}]+\{(?:[^{}]|\{[^{}]*\})*\}/g);
  assert.ok(blocks.length >= 68);
  for (const block of blocks) {
    const declarations = [...block.matchAll(/\{([^{}]*)\}/g)].flatMap(m => m[1].split(";").filter(v => v.trim()).map(v => v.split(":")[0].trim()));
    for (const property of declarations) assert.ok(["transform", "opacity", "filter"].includes(property), `${block.split("{")[0]}: ${property}`);
  }
  assert.match(css, /data-side=opponent\] \{ --direction: -1/);
  assert.match(css, /data-side=player\] \{ --facing: 1/);
  assert.match(css, /data-side=opponent\] \{ --facing: -1/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*animation: none !important/);
  assert.match(css, /pet-battle-move-fx \.pet-battle-fx-part \{ transform: translate\(50%,-50%\); opacity: 1/);
});

test("양쪽 공격·빗나감·방어·보조·숨 고르기 모두 기술별 연출을 한 번만 재생", () => {
  for (const side of ["player", "opponent"]) for (const move of [...MOVES, PUSH, { id: "rest", kind: "support" }]) {
    const visual = battleEffectId(move.id);
    const action = move.id === "rest" || move.id === "push" ? { kind: move.id } : { kind: "move", moveId: move.id, phase: move.mode === "charge" ? "release" : undefined };
    for (const hit of ["hit", "miss"]) {
      const events = [{ type: "action", side, action, round: 1 }];
      if (move.kind === "attack") events.push({ type: hit, side, target: side === "player" ? "opponent" : "player", moveId: move.id, round: 1 });
      const cues = battleCues(events, names), effects = cues.filter(c => c.moveFx);
      assert.equal(effects.length, 1);
      assert.equal(effects[0].moveFx, visual);
      assert.equal(effects[0].side, side);
      assert.equal(effects[0].duration, BATTLE_MOVE_FX[visual].duration);
      assert.equal(cues[0].text, `${names[side]}의 ${actionLabel(action)}!`);
      if (move.kind === "attack") assert.equal(effects[0].missed, hit === "miss");
    }
  }
});

test("390×844 글자 폭 예산: 전체 기술 이름·효과·비용/부족/상성 3줄", () => {
  // Conservative font budget: Hangul 1em, ASCII .65em, symbols 1em; no clipping/ellipsis.
  const width = (s, size) => Array.from(s).reduce((n, c) => n + (c.charCodeAt(0) < 128 ? .65 : 1) * size, 0);
  const copyWidth = 390 - 24 - 2 - 12 - 42 - 8;
  let longest = 0;
  for (const level of [1, 10, 30]) for (const breedId of ["B001", "B002", "B020"]) {
    const state = createBattle({ seed: 1, player: buildFighter(breedId, level), opponent: buildFighter("B020", 30) });
    for (const move of [...MOVES, PUSH]) {
      const effect = moveEffect(move, state);
      longest = Math.max(longest, width(effect, 12));
      assert.ok(width(move.name, 15) + 23 <= copyWidth, move.name);
      assert.ok(width(effect, 12) <= copyWidth, `${effect}: ${width(effect, 12)} > ${copyWidth}`);
      if (move.kind === "attack") {
        const damage = previewDamage(move, state.player, state.opponent, state.round);
        assert.ok(effect.includes(`${damage.min}~${damage.max}`));
        if (move.status) assert.ok(effect.includes(`${Math.round(damage.statusChance)}%`));
      }
    }
  }
  assert.ok(width("기력 ●●●●● 기력 부족 잘 안 통해요", 12) + 10 < copyWidth);
  assert.ok(844 * .42 > 4 * 76 + 3 * 8 + 5, "four complete rows fit; remaining rows scroll");
  assert.match(css, /data-menu=moves[^}]*overflow-y: auto/);
  assert.ok(longest > 0);
});
