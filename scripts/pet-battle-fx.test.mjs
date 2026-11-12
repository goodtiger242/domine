import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { loadTS } from "./pet-test-loader.mjs";

const { MOVES, PUSH, FINISHERS } = loadTS("lib/domine/battle/data.ts");
const { BATTLE_MOVE_FX, battleFxId } = loadTS("lib/domine/pet-battle-fx.ts");
const { actionLabel, battleCues, battleEffectId, moveEffect, compactEffect, movePages, costBadge, MOVE_PAGE_SIZE } = loadTS("lib/domine/pet-battle-view.ts");
const { buildFighter, createBattle, previewDamage } = loadTS("lib/domine/battle/engine.ts");
const css = readFileSync("app/games/pet-game.css", "utf8");
const names = { player: "미네", opponent: "친구" };

test("26개 기술: 빠짐·중복 없는 모션/궤적과 0.5~1.1초 길이, 실제 CSS 정의", () => {
  assert.ok(Object.keys(BATTLE_MOVE_FX).every(id => ["push", "rest"].includes(id) || [...MOVES, ...FINISHERS].some(move => move.id === id)));
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

test("기력·기세별 정렬: 가능 공격 피해순, 결정기 우선, 방어·보조, 불가 기술 아래", () => {
  const { moveDamage, actionCost, MOVE_KIND } = loadTS("lib/domine/pet-battle-view.ts");
  const { availableActions, moveFor, sameAction } = loadTS("lib/domine/battle/rules.ts");
  for (const energy of [0, 3, 10]) for (const momentum of [0, 99, 100]) {
    const state = createBattle({ seed: 1, player: buildFighter("B001", 80), opponent: buildFighter("B020", 80) });
    state.player.moves = MOVES.map(m => m.id); state.player.energy = energy; state.player.momentum = momentum;
    const actions = [...state.player.moves, state.player.finisher].map(moveId => ({ kind: "move", moveId }));
    actions.push({ kind: "push" }, { kind: "rest" });
    const allowed = availableActions(state, "player");
    const usable = action => allowed.some(a => sameAction(a, action));
    const damage = action => { const move = moveFor(action); if (move?.kind !== "attack") return 0; const d = moveDamage(move, state); return d.base + d.delta; };
    const kind = action => MOVE_KIND[moveFor(action)?.kind ?? "support"].order;
    for (const filter of ["all", "attack", "defense", "support"]) {
      const sorted = movePages(actions, filter, state).flat();
      for (let i = 1; i < sorted.length; i++) {
        const a = sorted[i - 1], b = sorted[i];
        assert.ok(Number(usable(a)) >= Number(usable(b)), "unavailable moves must follow usable ones");
        if (usable(a) !== usable(b) || usable(a) && moveFor(a)?.finisher) continue;
        assert.ok(kind(a) <= kind(b));
        if (kind(a) !== kind(b)) continue;
        if (kind(a) === 0) assert.ok(damage(a) >= damage(b));
        if (kind(a) !== 0 || damage(a) === damage(b)) assert.ok(actionCost(a, state) <= actionCost(b, state));
      }
    }
    const all = movePages(actions, "all", state).flat();
    if (momentum === 100) assert.equal(all[0].moveId, state.player.finisher);
    else assert.ok(all.findIndex(a => a.moveId === state.player.finisher) > all.findIndex(a => a.kind === "rest"));
  }
});

test("결정기 양방향: 컷인→차징→타격→여운 한 번, 2.1초/0.7초/0.4초와 감소 모션", () => {
  const { finisherDuration, FINISHER_MS, showBattleEvent } = loadTS("lib/domine/pet-battle-view.ts");
  const { battleAssets } = loadTS("lib/domine/pet-battle-fx.ts");
  for (const move of FINISHERS) for (const side of ["player", "opponent"]) for (const mode of ["hit", "miss", "block"]) {
    const target = side === "player" ? "opponent" : "player", base = { side, target, round: 1 };
    const events = [{ ...base, type: "action", action: { kind: "move", moveId: move.id } }, { ...base, type: "finisher", moveId: move.id },
      { ...base, type: mode === "miss" ? "miss" : "hit", moveId: move.id },
      ...(mode === "miss" ? [] : [{ ...base, type: "effectiveness", hint: "good", multiplier: 1.3 }, { ...base, type: "damage", hp: 80, amount: mode === "block" ? 0 : 20, critical: true }])];
    const before = structuredClone(events), cues = battleCues(events, names), stages = cues.filter(c => c.finisher);
    assert.deepEqual(stages.map(c => c.finisher), ["cutin", "charge", "impact", "afterglow"]);
    assert.ok(stages.every(c => c.side === side && c.finisherId === move.id));
    assert.equal(stages[2].target, target);
    assert.equal(stages[2].missed, mode === "miss"); assert.equal(stages[2].blocked, mode === "block");
    if (mode !== "miss") {
      assert.equal(stages[2].event.type, "damage"); assert.equal(stages[2].amount, mode === "block" ? 0 : 20);
      assert.equal(showBattleEvent({ [target]: { hp: 100 } }, stages[2].event)[target].hp, 80);
    }
    for (const [speed, total] of [[0, 2100], [1, 700], [2, 400]]) assert.equal(stages.reduce((sum, c) => sum + finisherDuration(c.finisher, speed, false), 0), total);
    assert.equal(finisherDuration("charge", 0, true), 0);
    assert.equal(stages.reduce((sum, c) => sum + finisherDuration(c.finisher, 0, true), 0), 400);
    assert.deepEqual(events, before);
  }
  assert.equal(Object.values(FINISHER_MS).reduce((a, b) => a + b), 2100);
  for (const path of battleAssets([...MOVES, ...FINISHERS].map(m => m.id))) assert.ok(existsSync(`public${path}`), path);
});

test("공유 성장 snapshot: 수동 분배·직업·배운 편성만 적용, 구 응답은 기존 전투", () => {
  const { battlePlayer } = loadTS("lib/domine/pet-battle-view.ts");
  const condition = { fullness: 70, mood: 70, clean: 80 };
  const growth = { level: 10, allocationMode: "manual", allocation: { hp: 8, attack: 8, defense: 8, speed: 3, focus: 0, calm: 0 }, job: "striker", jobTier: 1, moves: ["unknown", "T01"], mastery: { T01: 9000 } };
  const player = battlePlayer(1, 10, condition, [], undefined, growth);
  const expected = buildFighter("B001", 10, [], { condition, allocation: growth.allocation, job: { id: "rush", tier: 1 }, moves: ["T01"] });
  assert.deepEqual(player.stats, expected.stats); assert.equal(player.moves[0], "T01");
  const { MOVE_BY_ID } = loadTS("lib/domine/battle/data.ts");
  assert.deepEqual(player.moves.slice(1).map(id => MOVE_BY_ID[id].learn?.job), ["rush"], "a job adds its own skill beside the equipped ones");
  assert.equal(player.mastery, undefined, "usage counts must never become unbounded damage ranks");
  assert.deepEqual(battlePlayer(1, 10, condition).stats, buildFighter("B001", 10, [], { condition }).stats);
  assert.doesNotThrow(() => battlePlayer(1, 1, condition, [], undefined, { ...growth, allocation: { hp: 9000 }, jobTier: 3 }));
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
      assert.equal(effects[0].duration, move.kind === "attack" ? Math.min(550, BATTLE_MOVE_FX[visual].duration) : BATTLE_MOVE_FX[visual].duration);
      assert.equal(cues[0].moveName, actionLabel(action));
      if (move.kind === "attack") assert.equal(effects[0].missed, hit === "miss");
    }
  }
});

test("390×844 고정 패널: 1열×3행, 요약·배지 폭, 이름은 말줄임과 상세", () => {
  const width = (s, size) => Array.from(s).reduce((n, c) => n + (c.charCodeAt(0) < 128 ? .6 : 1) * size, 0);
  const cardWidth = 390 - 24;
  const copyWidth = cardWidth - 6 - 50 - 14 - 24 - 14;
  assert.ok(copyWidth >= 240, copyWidth);
  for (const level of [1, 10, 30]) {
    const state = createBattle({ seed: 1, player: buildFighter("B001", level), opponent: buildFighter("B020", 30) });
    for (const move of [...MOVES, ...FINISHERS, PUSH]) {
      assert.ok(width(costBadge(move.energy), 12) <= 40);
      if (move.kind === "attack") assert.ok(width(compactEffect(move, state), 14) <= copyWidth, compactEffect(move, state));
      assert.ok(move.name.length > 0);
    }
  }
  const panelHeight = 44 + 3 * 56 + 2 * 6 + 44 + 2 * 4;
  assert.equal(panelHeight, 276);
  assert.ok(844 - panelHeight - 8 - 34 >= 500, "safe area and command panel leave 500px arena");
  assert.match(css, /grid-template-rows: repeat\(3, 56px\)/);
  assert.match(css, /scroll-snap-type: x mandatory/);
  assert.match(css, /pet-battle-move-copy strong[^}]*text-overflow: ellipsis/);
  assert.doesNotMatch(css, /pet-battle-cost-dots/);
});

test("6칸(2열×3줄) 페이지와 분류, 0·2·8 비용 배지", () => {
  const actions = MOVES.map(move => ({ kind: "move", moveId: move.id }));
  assert.equal(movePages(actions.slice(0, 6), "all").length, 1);
  assert.equal(movePages(actions.slice(0, 7), "all").length, 2);
  assert.equal(movePages(actions, "all").length, Math.ceil(actions.length / MOVE_PAGE_SIZE));
  for (const kind of ["attack", "defense", "support"]) {
    const ids = movePages(actions, kind).flat().map(a => a.moveId);
    assert.deepEqual(ids, MOVES.filter(m => m.kind === kind).map(m => m.id));
  }
  assert.deepEqual(movePages([], "attack"), [[]]);
  assert.deepEqual([0, 2, 8].map(costBadge), ["⚡0", "⚡2", "⚡8"]);
});
