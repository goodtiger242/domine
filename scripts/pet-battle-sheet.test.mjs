import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { loadTS } from "./pet-test-loader.mjs";

const require = createRequire(import.meta.url);
const engine = loadTS("lib/domine/battle/engine.ts");
const { encounterFor, showBattleEvent, actionLabel } = loadTS("lib/domine/pet-battle-view.ts");
const { seedFor } = loadTS("lib/domine/battle/rng.ts");
const { moveFor, sameAction } = loadTS("lib/domine/battle/rules.ts");
const { PET_WORLD } = loadTS("lib/domine/pet-world.ts");
const source = ts.transpileModule(readFileSync("app/games/PetBattleSheet.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const text = node => typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node?.props?.children ?? "");
function nodes(node, match) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, match));
  if (!node?.props) return [];
  return [...(match(node) ? [node] : []), ...nodes(node.props.children, match), ...nodes(node.props.footer, match)];
}
function mount(t, props, initial) {
  const slots = [], effects = [], timers = new Map();
  let cursor = 0, tree, now = 0, id = 0;
  t.mock.method(globalThis, "setTimeout", (fn, ms) => { timers.set(++id, { fn, at: now + ms }); return id; });
  t.mock.method(globalThis, "clearTimeout", id => timers.delete(id));
  const hooks = {
    useState(initial) { const n = cursor++; slots[n] ??= { value: typeof initial === "function" ? initial() : initial }; return [slots[n].value, value => { slots[n].value = typeof value === "function" ? value(slots[n].value) : value; }]; },
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useId: () => "battle-preview",
    useEffect(fn, deps) { const n = cursor++; if (!slots[n] || deps.some((v, i) => v !== slots[n].deps[i])) { const old = slots[n]; slots[n] = { deps }; effects.push(() => { old?.cleanup?.(); slots[n].cleanup = fn(); }); } },
  };
  const exports = {};
  new Function("require", "exports", source)(name => name === "react" ? hooks : name === "./PetSheet" ? { default: "section" }
    : name === "next/image" ? { default: "img" } : name === "@/lib/domine/battle/engine" && initial ? { ...engine, createBattle: () => structuredClone(initial) }
    : name.startsWith("@/") ? loadTS(`${name.slice(2)}.ts`) : require(name), exports);
  function render() { cursor = 0; tree = exports.default(props); while (effects.length) effects.shift()(); }
  render();
  return {
    get tree() { return tree; }, get timerCount() { return timers.size; }, render,
    button(label) { return nodes(tree, n => n.type === "button" && (text(n) === label || text(n.props.children?.[0]) === label))[0]; },
    actions() { return nodes(tree, n => n.type === "button" && n.props["aria-describedby"]); },
    advance(ms) { const end = now + ms; for (;;) { const entry = [...timers].filter(([,v]) => v.at <= end).sort((a,b) => a[1].at - b[1].at)[0]; if (!entry) break; now = entry[1].at; timers.delete(entry[0]); entry[1].fn(); render(); } now = end; },
    unmount() { slots.forEach(s => s?.cleanup?.()); },
  };
}
const encounter = (cell = "F5", level = 10) => encounterFor(cell, level, "2026-11-11");
function initialFor(e, petId) { return engine.createBattle({ seed: seedFor(`${e.cellId}:${petId}:0`, e.daySeed), player: engine.buildFighter(petId === 1 ? "B001" : "B002", e.playerLevel), opponent: e.fighter, difficulty: e.difficulty }); }

test("조우: 성당·집 제외, 같은 날·칸 고정, 돌보기 레벨 1~30", () => {
  for (const cell of PET_WORLD) {
    const a = encounterFor(cell.id, 10, "2026-11-11");
    if (["E5", "D5"].includes(cell.id)) assert.equal(a, null);
    else { assert.deepEqual(a, encounterFor(cell.id, 10, "2026-11-11")); assert.deepEqual(a.fighter, engine.opponentFor(cell.id, a.daySeed, 10).fighter); }
  }
  assert.equal(encounter("F5", 80).playerLevel, 30);
  assert.equal(encounter("F5", -2).playerLevel, 1);
  assert.equal(encounter("F5", NaN).playerLevel, 1);
  assert.notEqual(encounter().daySeed, encounterFor("F5", 10, "2026-11-12").daySeed);
});

for (const [petId, cell, level, expected] of [[1, "F5", 30, "player"], [2, "J10", 1, "opponent"], [1, "F5", 10, "draw"]]) {
  test(`실제 시트: 이벤트 전체 재생 후 ${expected}, 재도전과 종료`, t => {
    const e = encounter(cell, level);
    let state = initialFor(e, petId), closed = 0;
    if (expected === "draw") { state.round = 12; state.opponentAction = { kind: "rest" }; }
    const h = mount(t, { encounter: e, petId, stage: "adult", onClose: () => closed++ }, expected === "draw" ? state : undefined);
    assert.equal(h.tree.props.fullHeight, true);
    while (!state.outcome) {
      const action = expected === "draw" ? { kind: "rest" } : engine.availableActions(state, "player")
        .filter(a => moveFor(a)?.kind === "attack").sort((a,b) => engine.previewDamage(moveFor(b), state.player, state.opponent).min - engine.previewDamage(moveFor(a), state.player, state.opponent).min)[0];
      const next = engine.stepRound(state, action);
      const click = h.button(actionLabel(action)).props.onClick;
      click(); click(); h.render();
      assert.ok(h.actions().every(b => b.props.disabled), "buttons lock immediately, including duplicate clicks");
      let shown = state;
      for (const event of next.events) {
        h.advance(599); assert.ok(!h.button("다시 겨루기")); h.advance(1);
        shown = showBattleEvent(shown, event);
        const bars = nodes(h.tree, n => n.props.role === "progressbar");
        assert.deepEqual(bars.map(b => b.props["aria-valuenow"]), [shown.opponent.hp, shown.player.hp]);
        assert.ok(h.actions().every(b => b.props.disabled));
      }
      h.advance(600); state = next.state;
      if (!state.outcome) assert.ok(h.actions().some(b => !b.props.disabled));
    }
    assert.equal(state.outcome, expected);
    assert.match(text(h.tree), /함께 놀아 줘서 고마워/);
    assert.match(text(h.tree), /곧 보상이 생겨요/);
    assert.match(text(h.tree), expected === "player" ? /승리했어요/ : expected === "opponent" ? /이번엔 졌어요/ : /무승부예요/);
    assert.ok(!h.actions().length);
    h.button("다시 겨루기").props.onClick(); h.render();
    assert.ok(!h.button("다시 겨루기")); assert.ok(h.actions().length <= 6);
    for (const bar of nodes(h.tree, n => n.props.role === "progressbar")) assert.equal(bar.props["aria-valuenow"], bar.props["aria-valuemax"]);
    h.tree.props.onClose(); assert.equal(closed, 1); h.unmount(); assert.equal(h.timerCount, 0);
  });
}

test("기력 조건, 길게 누르기, 취소와 재생 중 닫기", t => {
  const e = encounter(), state = initialFor(e, 1); state.player.energy = 0;
  const h = mount(t, { encounter: e, petId: 1, stage: "baby", onClose() {} }, state);
  for (const b of h.actions()) {
    const action = [...state.player.moves.map(moveId => ({ kind: "move", moveId })), { kind: "push" }, { kind: "rest" }].find(a => actionLabel(a) === text(b.props.children[0]));
    assert.equal(b.props.disabled, !engine.availableActions(state, "player").some(a => sameAction(a, action)));
  }
  assert.equal(h.button("숨 고르기").props.disabled, false);
  const push = () => h.button("가볍게 밀기");
  push().props.onPointerDown({ isPrimary: true, button: 0 }); h.advance(500);
  assert.match(text(h.tree.props.footer), /예상 피해.*명중 시/);
  push().props.onPointerUp(); push().props.onClick(); h.render();
  assert.equal(push().props.disabled, false, "long press must not choose the action");
  push().props.onPointerDown({ isPrimary: true, button: 0 }); push().props.onPointerCancel(); h.advance(1000);
  assert.equal(h.timerCount, 0);
  push().props.onClick(); h.render(); assert.equal(push().props.disabled, true);
  h.unmount(); assert.equal(h.timerCount, 0, "closing cancels pending playback timers");
});

test("기력이 충분해도 회복 불가능한 기술은 비활성", t => {
  const e = encounter("F5", 30), state = initialFor(e, 1);
  state.player.moves = ["T60"]; state.player.energy = 10;
  const h = mount(t, { encounter: e, petId: 1, stage: "adult", onClose() {} }, state);
  assert.equal(h.button(actionLabel({ kind: "move", moveId: "T60" })).props.disabled, true);
  h.unmount();
});

test("상태·방어·버프 표시 갱신은 입력 상태와 엔진 결과를 바꾸지 않는다", () => {
  const state = initialFor(encounter(), 1), original = structuredClone(state);
  let shown = showBattleEvent(state, { type: "status", side: "player", status: "slow", change: "applied", round: 1 });
  shown = showBattleEvent(shown, { type: "buff", side: "player", stat: "focus", change: "applied", round: 1 });
  shown = showBattleEvent(shown, { type: "shield", side: "player", multiplier: .65, change: "applied", round: 1 });
  assert.equal(shown.player.statuses[0].id, "slow"); assert.equal(shown.player.buffs[0].stat, "focus"); assert.equal(shown.player.shield.multiplier, .65);
  for (const event of [{ type: "status", status: "slow" }, { type: "buff", stat: "focus" }, { type: "shield", multiplier: .65 }]) shown = showBattleEvent(shown, { ...event, side: "player", change: "removed", round: 2 });
  assert.equal(shown.player.statuses.length, 0); assert.equal(shown.player.buffs.length, 0); assert.equal(shown.player.shield, undefined);
  assert.deepEqual(state, original);
});
