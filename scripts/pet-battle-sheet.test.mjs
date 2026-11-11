import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { loadTS } from "./pet-test-loader.mjs";

const require = createRequire(import.meta.url);
const engine = loadTS("lib/domine/battle/engine.ts");
const { encounterFor, showBattleEvent, actionLabel, battleCues, battleEffectId, hpColor, HINT_ICON, MOVE_KIND, moveEffect } = loadTS("lib/domine/pet-battle-view.ts");
const { MOVES, PUSH, FINISHERS } = loadTS("lib/domine/battle/data.ts");
const { BATTLE_MOVE_FX } = loadTS("lib/domine/pet-battle-fx.ts");
const { seedFor } = loadTS("lib/domine/battle/rng.ts");
const { moveFor, sameAction, REST_ENERGY, MAX_ENERGY, effectiveStat } = loadTS("lib/domine/battle/rules.ts");
const { PET_WORLD } = loadTS("lib/domine/pet-world.ts");
const source = ts.transpileModule(readFileSync("app/games/PetBattleSheet.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const text = node => typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node?.props?.children ?? "");
function nodes(node, match) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, match));
  if (!node?.props) return [];
  return [...(match(node) ? [node] : []), ...nodes(node.props.children, match)];
}
function mount(t, props, initial, reduced = false) {
  const slots = [], effects = [], timers = new Map(), vibration = [], listeners = new Map();
  let cursor = 0, tree, now = 0, id = 0, dirty = false, focusRestored = false;
  const body = { style: { overflow: "auto", position: "", top: "", width: "" } };
  const arenaVars = {};
  const field = {
    style: { setProperty: (key, value) => { arenaVars[key] = value; } },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    querySelector: selector => ({ getBoundingClientRect: () => selector.includes('"player"') ? { left: 8, top: 450, width: 168, height: 168 } : { left: 234, top: 203, width: 140, height: 140 } }),
  };
  const globals = {
    document: { body, activeElement: { focus() { focusRestored = true; } } },
    window: { scrollY: 120, scrollTo() {}, matchMedia: () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }), addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    history: { state: null, pushState(state) { this.state = state; }, back() { this.state = null; } },
    navigator: { vibrate: ms => vibration.push(ms) },
  };
  for (const [name, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true });
    t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name]);
  }
  t.mock.method(globalThis, "setTimeout", (fn, ms) => { timers.set(++id, { fn, at: now + ms }); return id; });
  t.mock.method(globalThis, "clearTimeout", id => timers.delete(id));
  const hooks = {
    useState(initial) { const n = cursor++; slots[n] ??= { value: typeof initial === "function" ? initial() : initial }; return [slots[n].value, value => { const next = typeof value === "function" ? value(slots[n].value) : value; if (!Object.is(next, slots[n].value)) dirty = true; slots[n].value = next; }]; },
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useId() { const n = cursor++; return `battle-${n}`; },
    useEffect(fn, deps) { const n = cursor++; if (!slots[n] || deps.some((v, i) => v !== slots[n].deps[i])) { const old = slots[n]; slots[n] = { deps }; effects.push(() => { old?.cleanup?.(); slots[n].cleanup = fn(); }); } },
  };
  hooks.useLayoutEffect = hooks.useEffect;
  const exports = {};
  new Function("require", "exports", source)(name => name === "react" ? hooks
    : name === "next/image" ? { default: "img" } : name === "@/lib/domine/battle/engine" && initial ? { ...engine, createBattle: () => structuredClone(initial) }
    : name.startsWith("@/") ? loadTS(`${name.slice(2)}.ts`) : require(name), exports);
  function render() { do { dirty = false; cursor = 0; tree = exports.default({ hour: 12, ...props }); const arena = nodes(tree, n => n.props.className === "pet-battle-arena")[0]; if (arena?.props.ref) arena.props.ref.current = field; while (effects.length) effects.shift()(); } while (dirty); }
  const button = label => nodes(tree, n => n.type === "button" && (n.props["aria-label"] === label || text(n).trim() === label || text(n.props.children?.[0]) === label || text(n).includes(label)))[0];
  render();
  const h = {
    get tree() { return tree; }, get timerCount() { return timers.size; }, render, button, vibration, listeners, body, arenaVars,
    get phase() { return nodes(tree, n => !!n.props["data-phase"])[0].props["data-phase"]; },
    get hp() { return nodes(tree, n => n.props.role === "progressbar").map(b => b.props["aria-valuenow"]); },
    actions() { return nodes(tree, n => n.type === "button" && n.props["data-group"]); },
    click(label) { const b = button(label); assert.ok(b, `button ${label}`); assert.ok(!b.props.disabled, `${label} enabled`); b.props.onClick({ stopPropagation() {} }); render(); },
    advance(ms) { const end = now + ms; let count = 0; for (;;) { const entry = [...timers].filter(([,v]) => v.at <= end).sort((a,b) => a[1].at - b[1].at)[0]; if (!entry) break; assert.ok(count++ < 20000, "timer queue must terminate"); now = entry[1].at; timers.delete(entry[0]); entry[1].fn(); render(); } now = end; },
    nextTimer() { assert.ok(timers.size); h.advance(Math.min(...[...timers.values()].map(t => t.at)) - now); },
    settle() { for (let i = 0; i < 2000 && ["intro", "playback"].includes(h.phase); i++) h.advance(100); assert.ok(["command", "result"].includes(h.phase), "playback must reach commands or result"); },
    unmount() { slots.forEach(s => s?.cleanup?.()); assert.equal(focusRestored, true); assert.equal(body.style.overflow, "auto"); assert.equal(listeners.size, 0); assert.equal(timers.size, 0); },
  };
  return h;
}
const encounter = (cell = "F5", level = 10) => {
  for (let slot = 0; slot < 100; slot++) { const found = encounterFor(cell, level, slot); if (found) return found; }
  throw new Error("fixture has no encounter");
};
function initialFor(e, petId) { return engine.createBattle({ seed: seedFor(`${e.cellId}:${petId}:0`, e.daySeed), player: engine.buildFighter(petId === 1 ? "B001" : "B002", e.playerLevel), opponent: e.fighter, difficulty: e.difficulty }); }

test("조우: 1000개 구간에서 30% 출현, 같은 구간·칸은 모두에게 동일", () => {
  let count = 0, changed = 0;
  for (let slot = 0; slot < 1000; slot++) for (const cell of PET_WORLD) {
    const a = encounterFor(cell.id, 10, slot);
    if (["E5", "D5"].includes(cell.id)) { assert.equal(a, null); continue; }
    assert.deepEqual(a, encounterFor(cell.id, 10, slot));
    if (JSON.stringify(a) !== JSON.stringify(encounterFor(cell.id, 10, slot + 1))) changed++;
    if (a) {
      count++;
      assert.deepEqual(a.fighter, encounterFor(cell.id, 30, slot).fighter);
      assert.deepEqual(a.npc, encounterFor(cell.id, 1, slot).npc);
      assert.equal(encounterFor(cell.id, 10, slot, [`${slot}:${cell.id}`]), null);
    }
  }
  assert.ok(count / 98000 >= .27 && count / 98000 <= .33, `appearance rate ${count / 98000}`);
  assert.ok(changed > 0);
  assert.equal(encounter("F5", 80).playerLevel, 30);
  assert.equal(encounter("F5", -2).playerLevel, 1);
  assert.equal(encounter("F5", NaN).playerLevel, 1);
});

test("체력 색: 50%, 20% 경계와 빈 막대", () => {
  for (const [hp, max, color] of [[100,100,"green"],[51,100,"green"],[50,100,"yellow"],[21,100,"yellow"],[20,100,"red"],[0,100,"red"],[0,0,"red"]]) assert.equal(hpColor(hp,max), color);
});

test("등장 2.4초, 18ms 타이핑, 탭 완성·진행, 기술↔뒤로, 가방", t => {
  const h = mount(t, { encounter: encounter(), petId: 1, stage: "adult", onClose() {} });
  assert.equal(h.tree.type, "dialog"); assert.equal(h.body.style.overflow, "hidden");
  h.advance(2399); assert.equal(h.phase, "intro"); h.advance(1); assert.equal(h.phase, "command");
  assert.equal(nodes(h.tree, n => n.props.className === "pet-battle-message").length, 0);
  const visible = () => text(nodes(h.tree, n => n.props.className === "pet-battle-message")[0].props.children[0]);
  h.click("기술"); assert.equal(h.actions().length, initialFor(encounter(), 1).player.moves.length + 3);
  for (const b of h.actions()) assert.ok(b.props["aria-label"].includes("기력"));
  h.click("뒤로"); assert.equal(h.actions().length, 0);
  h.click("가방"); assert.equal(h.phase, "playback"); h.click("대사 모두 보기"); assert.match(visible(), /가방이 비었어요/); h.click("다음 대사"); assert.equal(h.phase, "command");
  h.unmount();
});

for (const [petId, cell, level, expected] of [[1, "F5", 30, "player"], [2, "J10", 1, "opponent"], [1, "F5", 10, "draw"]]) {
  test(`타이머로 등장→선택→전체 라운드→${expected}, 재도전·종료`, t => {
    const e = encounter(cell, level);
    let state = initialFor(e, petId), closed = 0, wins = 0;
    if (expected === "draw") { state.round = 12; state.opponentAction = { kind: "rest" }; }
    const h = mount(t, { encounter: e, petId, stage: "adult", onClose: () => closed++, onWin: () => wins++ }, expected === "draw" ? state : undefined);
    h.settle();
    while (!state.outcome) {
      assert.equal(h.phase, "command");
      const action = expected === "draw" ? { kind: "rest" } : engine.availableActions(state, "player")
        .filter(a => moveFor(a)?.kind === "attack").sort((a,b) => engine.previewDamage(moveFor(b), state.player, state.opponent).min - engine.previewDamage(moveFor(a), state.player, state.opponent).min)[0];
      const next = engine.stepRound(state, action);
      if (action.kind !== "rest") h.click("기술");
      const click = h.button(actionLabel(action)).props.onClick;
      click(); click(); h.render(); assert.equal(h.phase, "playback"); assert.equal(h.actions().length, 0);
      assert.deepEqual(h.hp, [state.opponent.hp, state.player.hp], "HP stays until the impact cue finishes");
      h.settle(); state = next.state;
      assert.deepEqual(h.hp, state.outcome ? [] : [state.opponent.hp, state.player.hp]);
    }
    assert.equal(state.outcome, expected); assert.equal(h.phase, "result");
    assert.equal(wins, expected === "player" ? 1 : 0);
    assert.doesNotMatch(text(h.tree), /함께 놀아 줘서 고마워|곧 보상이 생겨요|수고했어요|꾸벅|겨루기 종료/);
    assert.match(text(h.tree), expected === "player" ? /승리!/ : expected === "opponent" ? /아쉬운 패배/ : /무승부/);
    if (expected === "opponent") {
      h.click("다시"); assert.equal(h.phase, "intro");
      for (const bar of nodes(h.tree, n => n.props.role === "progressbar")) assert.equal(bar.props["aria-valuenow"], bar.props["aria-valuemax"]);
      h.click("등장 연출 건너뛰기"); assert.equal(h.phase, "command");
      h.click("그만하기"); h.settle(); assert.match(text(h.tree), /그만뒀어요/);
    } else assert.equal(h.button("다시"), undefined);
    h.click("돌아가기"); assert.equal(closed, 1); h.unmount();
  });
}

test("연출 순서: 대사→돌진→피격→HP→상성, 기력은 한 번에 갱신하고 숫자는 0.3초 보간", () => {
  const events = [
    { type: "action", side: "player", action: { kind: "push" }, round: 1 },
    { type: "hit", side: "player", target: "opponent", moveId: "push", round: 1 },
    { type: "effectiveness", side: "player", target: "opponent", hint: "good", multiplier: 1.3, round: 1 },
    { type: "damage", side: "player", target: "opponent", amount: 12, hp: 88, round: 1 },
    { type: "energy", side: "player", amount: 2, energy: 8, reason: "round", round: 1 },
  ];
  const before = structuredClone(events), cues = battleCues(events, { player: "미네", opponent: "삽살개" });
  assert.equal(cues[0].text, "미네의 가볍게 밀기!");
  assert.equal(cues[1].motion, "skill"); assert.equal(cues[1].duration, BATTLE_MOVE_FX.push.duration);
  assert.equal(cues[2].motion, "hit"); assert.equal(cues[2].event, undefined);
  assert.equal(cues[3].event.type, "damage"); assert.equal(cues[3].duration, 900);
  assert.equal(cues[4].text, "효과가 좋아요!"); assert.equal(cues[4].motion, "effective");
  assert.deepEqual(cues.slice(5).map(c => c.event.energy), [8]); assert.deepEqual(events, before);
  const weak = battleCues(events.map(e => e.type === "effectiveness" ? { ...e, hint: "weak" } : e), { player: "미네", opponent: "삽살개" });
  assert.ok(!weak.some(c => c.motion === "effective"));
});

test("기력 조건, 길게 누르기·취소, Escape 뒤로, 재생 중 닫기 정리", t => {
  const e = encounter(), state = initialFor(e, 1); state.player.energy = 0;
  const h = mount(t, { encounter: e, petId: 1, stage: "baby", onClose() {} }, state);
  h.settle(); h.click("기술");
  for (const b of h.actions()) {
    const action = [...[...state.player.moves, state.player.finisher].filter(Boolean).map(moveId => ({ kind: "move", moveId })), { kind: "push" }, { kind: "rest" }].find(a => actionLabel(a) === text(nodes(b, n => n.type === "strong")[0]));
    assert.equal(b.props.disabled, !engine.availableActions(state, "player").some(a => sameAction(a, action)));
  }
  const push = () => h.button("가볍게 밀기");
  push().props.onPointerDown({ isPrimary: true, button: 0 }); h.advance(500);
  assert.match(text(h.tree), /예상 피해.*명중 시/);
  push().props.onPointerUp(); push().props.onClick(); h.render(); assert.equal(h.phase, "command", "long press must not choose"); h.click("상세 닫기");
  push().props.onPointerDown({ isPrimary: true, button: 0 }); push().props.onPointerCancel(); h.advance(1000); assert.equal(h.timerCount, 0);
  h.tree.props.onCancel({ preventDefault() {} }); h.render(); assert.equal(h.actions().length, 0);
  h.click("기술"); h.click("가볍게 밀기"); assert.equal(h.phase, "playback"); h.unmount();
});

test("기력이 충분해도 회복 불가능한 기술은 비활성", t => {
  const e = encounter("F5", 30), state = initialFor(e, 1);
  state.player.moves = ["T60"]; state.player.energy = 10;
  const h = mount(t, { encounter: e, petId: 1, stage: "adult", onClose() {} }, state);
  h.settle(); h.click("기술"); assert.equal(h.button(actionLabel({ kind: "move", moveId: "T60" })).props.disabled, true); h.unmount();
});

test("기술 카드: 이름·요약·숫자 비용·상성, 공격→방어→보조 순서", t => {
  const e = encounter("F5", 30), state = initialFor(e, 1);
  state.player.moves = MOVES.map(m => m.id).reverse(); state.player.energy = 0;
  const h = mount(t, { encounter: e, petId: 1, stage: "adult", onClose() {} }, state);
  h.settle();
  assert.equal(h.button("숨 고르기").props["data-kind"], "support");
  assert.ok(text(h.button("숨 고르기")).includes(`기력 +${REST_ENERGY}`));
  h.click("기술");
  const orders = h.actions().map(b => MOVE_KIND[b.props["data-kind"]].order);
  assert.deepEqual(orders, [...orders].sort());
  for (const move of [...MOVES, PUSH]) {
    const button = h.button(move.name), kind = MOVE_KIND[move.kind];
    assert.equal(text(nodes(button, n => n.props.className === "pet-battle-kind")[0]), kind.icon);
    assert.equal(nodes(button, n => n.props.className === "pet-battle-effect").length, 0);
    assert.ok(button.props["aria-label"].includes(moveEffect(move, state)));
    const card = nodes(h.tree, n => n.props.className === "pet-battle-card" && text(n).includes(move.name))[0];
    assert.ok(text(card).includes(`⚡${move.energy}`));
    assert.equal(card.props["data-insufficient"], move.energy > state.player.energy);
    if (move.energy) { assert.equal(button.props.disabled, true); assert.match(button.props["aria-label"], /기력 부족/); }
    if (move.kind === "attack") {
      const damage = engine.previewDamage(move, state.player, state.opponent, state.round);
      assert.ok(button.props["aria-label"].includes(`상대에게 피해 약 ${damage.min}~${damage.max}`));
    }
  }
  h.unmount();
});

for (const move of [...MOVES, PUSH, { id: "rest", name: "숨 고르기" }]) test(`${move.name}: 양쪽 연출은 지정 길이를 기다리고 한 라운드를 완료`, t => {
  const e = encounter("F5", 30), state = initialFor(e, 1);
  const visual = battleEffectId(move.id);
  const action = ["rest", "push"].includes(move.id) ? { kind: move.id } : { kind: "move", moveId: move.id };
  for (const side of ["player", "opponent"]) { state[side].moves = MOVES.map(m => m.id); state[side].energy = 10; state[side].hp -= 45; }
  state.opponentAction = action;
  const next = engine.stepRound(state, action);
  const h = mount(t, { encounter: e, petId: 1, stage: "adult", onClose() {} }, state);
  h.settle(); if (move.id !== "rest") h.click("기술"); h.click(move.name);
  const fx = () => nodes(h.tree, n => n.props.className === "pet-battle-move-fx")[0];
  const sides = new Set();
  for (let i = 0; i < 1500 && h.phase === "playback"; i++) {
    if (fx()) {
      const current = fx(); sides.add(current.props["data-side"]);
      assert.equal(current.props["data-trail"], BATTLE_MOVE_FX[visual].trail);
      assert.equal(current.props.style["--fx-duration"], `${BATTLE_MOVE_FX[visual].duration}ms`);
      assert.deepEqual(h.arenaVars, { "--reach-x": "212px", "--reach-y": "-261px", "--trail-left": "92px", "--trail-top": "273px", "--trail-width": "212px", "--trail-height": "261px" });
      h.advance(BATTLE_MOVE_FX[visual].duration - 1);
      assert.equal(fx().key, current.key, "animation must not be cut short");
      h.advance(1); assert.notEqual(fx()?.key, current.key, "animation completes at its own duration");
    } else h.nextTimer();
  }
  assert.deepEqual([...sides].sort(), ["opponent", "player"]);
  assert.equal(h.phase, "command"); assert.deepEqual(h.hp, [next.state.opponent.hp, next.state.player.hp]);
  h.unmount();
});

test("이동 줄이기에도 기술 아이콘과 대사를 읽을 시간이 남는다", t => {
  const h = mount(t, { encounter: encounter(), petId: 1, stage: "adult", onClose() {} }, undefined, true);
  h.settle(); h.click("숨 고르기");
  const fx = () => nodes(h.tree, n => n.props["data-trail"] === "energy-dots")[0];
  for (let i = 0; i < 1500 && !fx(); i++) h.nextTimer();
  assert.ok(fx()); assert.match(text(h.tree), /숨 고르기!/);
  const key = fx().key; h.advance(1099); assert.equal(fx().key, key);
  h.advance(1); assert.notEqual(fx()?.key, key); h.settle(); h.unmount();
});

test("장착 기술·결정기·기본 행동, 정보 버튼과 길게 누름은 상세를 열고 선택하지 않는다", t => {
  const e = encounter(), state = initialFor(e, 1); state.player.moves = ["T01", "T43"];
  const h = mount(t, { encounter: e, petId: 1, stage: "adult", onClose() {} }, state);
  h.settle(); h.click("기술"); assert.equal(h.actions().length, 5);
  assert.equal(h.actions().some(b => text(b).includes("코끝 집중")), false);
  h.click("앞발 밀기 상세"); assert.match(text(h.tree), /명중.*예상 피해/);
  h.click("상세 닫기");
  let push = h.button("가볍게 밀기");
  push.props.onKeyDown({ key: " ", repeat: false }); h.advance(500);
  assert.match(text(h.tree), /예상 피해/);
  push.props.onKeyUp(); push.props.onClick(); h.render(); assert.equal(h.phase, "command");
  h.click("상세 닫기"); assert.doesNotMatch(text(h.tree), /예상 피해/); h.unmount();
});

test("효과는 맞은 쪽에 연결되고 상태 해제에는 부여 효과를 재생하지 않는다", () => {
  const base = { side: "opponent", round: 1 };
  const cases = [
    [{ type: "damage", target: "player", amount: 12, hp: 80 }, "hit", "player"],
    [{ type: "heal", amount: 12, hp: 100 }, "heal"],
    [{ type: "buff", stat: "focus", change: "applied" }, "buff"],
    [{ type: "buff", stat: "focus", change: "removed" }, "debuff"],
    [{ type: "status", status: "stagger", change: "applied" }, "dizzy"],
    [{ type: "status", status: "blur", change: "applied" }, "dizzy"],
    [{ type: "status", status: "slow", change: "applied" }, "sleepy"],
    [{ type: "status", status: "winded", change: "applied" }, "sleepy"],
    [{ type: "status", status: "tense", change: "applied" }, "debuff"],
    [{ type: "status", status: "open", change: "applied" }, "debuff"],
    [{ type: "status", status: "stagger", change: "blocked" }, "shield"],
    [{ type: "status", status: "stagger", change: "removed" }, undefined],
    [{ type: "shield", multiplier: .65, change: "applied" }, "shield"],
    [{ type: "shield", multiplier: .65, change: "removed" }, undefined],
  ];
  for (const [event, fx, side = "opponent"] of cases) {
    const [cue] = battleCues([{ ...base, ...event }], { player: "미네", opponent: "친구" });
    assert.equal(cue.fx, fx); assert.equal(cue.side, side);
  }
  const [good] = battleCues([{ ...base, type: "effectiveness", target: "player", hint: "good", multiplier: 1.3 }, { ...base, ...cases[0][0] }], { player: "미네", opponent: "친구" });
  assert.equal(good.fx, "hit-good"); assert.equal(good.duration, 500);
});

test("효과 이미지가 실패해도 대상의 번쩍임은 남는다", t => {
  const h = mount(t, { encounter: encounter(), petId: 1, stage: "adult", onClose() {} });
  h.settle(); h.click("기술"); h.click("가볍게 밀기");
  const effects = () => nodes(h.tree, n => n.props.className === "pet-battle-fx");
  for (let i = 0; i < 1000 && !effects().length; i++) h.advance(10);
  assert.equal(effects().length, 1);
  const image = nodes(effects()[0], n => n.type === "img")[0], currentTarget = { style: {} };
  assert.match(image.props.src, /\/pet\/battle\/fx-hit(-good)?\.webp$/);
  image.props.onError({ currentTarget }); assert.equal(currentTarget.style.visibility, "hidden");
  assert.equal(nodes(effects()[0], n => n.props.className === "pet-battle-flash").length, 1);
  h.unmount();
});

for (const reduced of [false, true]) test(`HP 숫자는 막대와 함께 감소하고 동작 줄이기=${reduced}를 따른다`, t => {
  const e = encounter(), state = initialFor(e, 1);
  state.opponentAction = { kind: "rest" };
  const h = mount(t, { encounter: e, petId: 1, stage: "adult", onClose() {} }, state, reduced);
  h.settle(); h.click("기술"); h.click("가볍게 밀기");
  const number = () => Number(text(nodes(h.tree, n => n.props["data-hp-number"] === "opponent")[0]).split("/")[0]);
  for (let i = 0; i < 1000 && h.hp[0] === state.opponent.hp; i++) h.advance(10);
  assert.ok(h.hp[0] < state.opponent.hp);
  if (reduced) assert.equal(number(), h.hp[0]);
  else {
    assert.ok(number() > h.hp[0] && number() <= state.opponent.hp);
    const previous = number(); h.advance(150); assert.ok(number() < previous);
    h.advance(600); assert.equal(number(), h.hp[0]);
  }
  h.unmount();
});

test("동작 줄이기: 등장 생략, 타이핑·라운드·종료 유지, 진동 없음", t => {
  const e = encounter("F5", 30), state = initialFor(e, 1); state.opponent.hp = 1;
  const h = mount(t, { encounter: e, petId: 1, stage: "adult", onClose() {} }, state, true);
  h.advance(0); assert.equal(h.phase, "command"); h.settle(); h.click("기술"); h.click("가볍게 밀기"); h.settle();
  assert.equal(h.phase, "result"); assert.deepEqual(h.vibration, []); h.unmount();
});

test("상태·방어·버프 표시 갱신은 입력 상태와 엔진 결과를 바꾸지 않는다", () => {
  const state = initialFor(encounter(), 1), original = structuredClone(state);
  let shown = showBattleEvent(state, { type: "status", side: "player", status: "slow", change: "applied", round: 1 });
  shown = showBattleEvent(shown, { type: "buff", side: "player", stat: "focus", change: "applied", round: 1 });
  shown = showBattleEvent(shown, { type: "shield", side: "player", multiplier: .65, change: "applied", round: 1 });
  assert.equal(shown.player.statuses[0].id, "slow"); assert.equal(shown.player.buffs[0].stat, "focus"); assert.equal(shown.player.shield.multiplier, .65);
  for (const event of [{ type: "status", status: "slow" }, { type: "buff", stat: "focus" }, { type: "shield", multiplier: .65 }]) shown = showBattleEvent(shown, { ...event, side: "player", change: "removed", round: 2 });
  assert.equal(shown.player.statuses.length, 0); assert.equal(shown.player.buffs.length, 0); assert.equal(shown.player.shield, undefined); assert.deepEqual(state, original);
});

function visibleTextNodes(node) {
  if (typeof node === "string" || typeof node === "number") return String(node).trim() ? [String(node)] : [];
  if (Array.isArray(node)) return node.flatMap(visibleTextNodes);
  if (!node?.props || node.props["aria-hidden"] || node.props.className === "pet-battle-sr") return [];
  return visibleTextNodes(node.props.children);
}
for (const outcome of ["player", "opponent", "draw", "quit"]) test(`결과 ${outcome}: 배너·한마디와 버튼만 남는다`, t => {
  const e = encounter(), state = initialFor(e, 1); state.outcome = outcome;
  const h = mount(t, { encounter: e, petId: 1, stage: "adult", onClose() {} }, state);
  h.settle();
  const visible = visibleTextNodes(h.tree);
  assert.equal(visible.length, outcome === "opponent" ? 4 : 3, visible.join(" / "));
  assert.equal(nodes(h.tree, n => n.props.className === "pet-battle-result")[0].props.children.filter(Boolean).length, 2);
  assert.doesNotMatch(visible.join(" "), /겨루기 종료|수고했어요|꾸벅|보상|라운드|체력|기력/);
  h.unmount();
});

test("승리는 한 번 기록하고 그만두기·패배는 기록하지 않는다", t => {
  const e = encounter(), state = initialFor(e, 1); state.opponent.hp = 1; state.opponentAction = { kind: "rest" };
  let wins = 0;
  const h = mount(t, { encounter: e, petId: 1, stage: "adult", onClose() {}, onWin: () => wins++ }, state);
  h.settle(); h.click("기술"); h.click("가볍게 밀기"); h.settle();
  assert.equal(h.phase, "result"); assert.equal(wins, 1); h.unmount();
});


test("페이지 화살표·스와이프·필터 초기화와 비활성 페이지 포커스 제외", t => {
  const e = encounter(), state = initialFor(e, 1); state.player.moves = MOVES.map(m => m.id);
  const h = mount(t, { encounter: e, petId: 1, stage: "adult", onClose() {} }, state);
  h.settle(); h.click("기술");
  const pages = () => nodes(h.tree, n => n.props.className === "pet-battle-page");
  assert.equal(pages().length, Math.ceil((MOVES.length + 3) / 6));
  assert.equal(pages().filter(p => !p.props.inert).length, 1);
  assert.ok(pages().every(p => nodes(p, n => n.props.className === "pet-battle-card").length <= 6));
  h.click("다음 기술 페이지"); assert.equal(pages()[1].props.inert, false);
  h.click("🛡 방어"); assert.equal(pages()[0].props.inert, false);
  assert.ok(h.actions().every(b => b.props["data-kind"] === "defense"));
  h.click("✨ 보조"); assert.ok(h.actions().every(b => b.props["data-kind"] === "support"));
  h.click("전체");
  const viewport = () => nodes(h.tree, n => n.props.className === "pet-battle-pages")[0];
  viewport().props.onScroll({ currentTarget: { clientWidth: 366, scrollLeft: 732 } }); h.render();
  assert.equal(pages()[2].props.inert, false);
  viewport().props.onKeyDown({ key: "ArrowLeft", preventDefault() {} }); h.render();
  assert.equal(pages()[1].props.inert, false);
  h.unmount();
});

test("기력 막대는 MAX_ENERGY 칸, 포커스한 비용만 미리보기", t => {
  const e = encounter(), state = initialFor(e, 1); state.player.energy = 6;
  const h = mount(t, { encounter: e, petId: 1, stage: "adult", onClose() {} }, state);
  h.settle(); h.click("기술");
  const bars = () => nodes(h.tree, n => n.props.className === "pet-battle-energy-bar");
  assert.equal(nodes(bars()[1], n => n.type === "i").length, MAX_ENERGY);
  h.button("앞발 밀기").props.onFocus(); h.render();
  assert.equal(nodes(bars()[1], n => n.props["data-spend"]).length, 2);
  assert.equal(nodes(bars()[0], n => n.props["data-spend"]).length, 0);
  h.button("앞발 밀기").props.onBlur(); h.render();
  assert.equal(nodes(bars()[1], n => n.props["data-spend"]).length, 0);
  h.unmount();
});

test("동물 상세: 강화·약화 스탯, 상대 미공개 기술 숨김, 재생 일시정지·재개", t => {
  const e = encounter(), state = initialFor(e, 1);
  state.player.buffs = [{ stat: "attack", rate: .2, expires: 3 }];
  state.player.statuses = [{ id: "slow", applied: 1, expires: 2 }];
  state.opponentAction = { kind: "move", moveId: state.opponent.moves[0] };
  const h = mount(t, { encounter: e, petId: 1, stage: "adult", onClose() {} }, state);
  nodes(h.tree, n => n.props.className === "pet-battle-info")[1].props.onClick({ stopPropagation() {} }); h.render();
  const detail = () => nodes(h.tree, n => n.props.className === "pet-battle-details")[0];
  const meters = nodes(detail(), n => n.type === "meter");
  assert.equal(meters.length, 6);
  assert.equal(meters.find(m => m.props["aria-label"] === "공격력").props.value, effectiveStat(state.player, "attack", 1));
  assert.equal(meters.find(m => m.props["aria-label"] === "민첩").props.value, effectiveStat(state.player, "speed", 1));
  assert.match(text(detail()), /크리티컬/); assert.match(text(detail()), /느려짐 · 2라운드/);
  h.advance(10000); assert.equal(h.phase, "intro");
  h.click("상세 닫기"); h.settle();
  const opponentInfo = nodes(h.tree, n => n.props.className === "pet-battle-info")[0];
  opponentInfo.props.onClick({ stopPropagation() {} }); h.render();
  const known = () => nodes(detail(), n => n.props.className === "pet-battle-known-moves")[0];
  assert.equal(text(known()), "?".repeat(state.opponent.moves.length + (state.opponent.finisher ? 1 : 0))); assert.doesNotMatch(text(detail()), /크리티컬/);
  h.click("상세 닫기"); h.click("숨 고르기"); h.settle();
  nodes(h.tree, n => n.props.className === "pet-battle-info")[0].props.onClick({ stopPropagation() {} }); h.render();
  assert.ok(text(known()).includes(actionLabel(state.opponentAction)));
  const overlay = detail(); overlay.props.onClick({ target: overlay, currentTarget: overlay }); h.render();
  assert.equal(detail(), undefined); h.unmount();
});


test("충전 해방은 기력 비용 0, 부족 표시 없음", t => {
  const e = encounter(), state = initialFor(e, 1);
  state.player.moves = ["C01"]; state.player.charging = "C01"; state.player.energy = 0;
  const h = mount(t, { encounter: e, petId: 1, stage: "adult", onClose() {} }, state);
  h.settle(); h.click("기술");
  const card = nodes(h.tree, n => n.props.className === "pet-battle-card" && text(n).includes("웅크려 큰걸음"))[0];
  assert.match(text(card), /⚡0/); assert.equal(card.props["data-insufficient"], false);
  assert.equal(h.button("웅크려 큰걸음").props.disabled, false);
  h.click("웅크려 큰걸음 상세"); assert.match(text(h.tree), /충전 완료/); h.click("상세 닫기"); h.unmount();
});
