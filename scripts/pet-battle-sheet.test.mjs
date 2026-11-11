import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { loadTS } from "./pet-test-loader.mjs";

const require = createRequire(import.meta.url);
const engine = loadTS("lib/domine/battle/engine.ts");
const { encounterFor, showBattleEvent, actionLabel, battleCues, hpColor, HINT_ICON } = loadTS("lib/domine/pet-battle-view.ts");
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
  return [...(match(node) ? [node] : []), ...nodes(node.props.children, match)];
}
function mount(t, props, initial, reduced = false) {
  const slots = [], effects = [], timers = new Map(), vibration = [], listeners = new Map();
  let cursor = 0, tree, now = 0, id = 0, dirty = false, focusRestored = false;
  const body = { style: { overflow: "auto", position: "", top: "", width: "" } };
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
  function render() { do { dirty = false; cursor = 0; tree = exports.default({ hour: 12, ...props }); while (effects.length) effects.shift()(); } while (dirty); }
  const button = label => nodes(tree, n => n.type === "button" && (n.props["aria-label"] === label || text(n).trim() === label || text(n.props.children?.[0]) === label || text(n).includes(label)))[0];
  render();
  const h = {
    get tree() { return tree; }, get timerCount() { return timers.size; }, render, button, vibration, listeners, body,
    get phase() { return nodes(tree, n => !!n.props["data-phase"])[0].props["data-phase"]; },
    get hp() { return nodes(tree, n => n.props.role === "progressbar").map(b => b.props["aria-valuenow"]); },
    actions() { return nodes(tree, n => n.type === "button" && n.props["data-group"]); },
    click(label) { const b = button(label); assert.ok(b, `button ${label}`); assert.ok(!b.props.disabled, `${label} enabled`); b.props.onClick({ stopPropagation() {} }); render(); },
    advance(ms) { const end = now + ms; let count = 0; for (;;) { const entry = [...timers].filter(([,v]) => v.at <= end).sort((a,b) => a[1].at - b[1].at)[0]; if (!entry) break; assert.ok(count++ < 20000, "timer queue must terminate"); now = entry[1].at; timers.delete(entry[0]); entry[1].fn(); render(); } now = end; },
    settle() { for (let i = 0; i < 2000 && ["intro", "playback"].includes(h.phase); i++) h.advance(100); assert.ok(["command", "result"].includes(h.phase), "playback must reach commands or result"); },
    unmount() { slots.forEach(s => s?.cleanup?.()); assert.equal(focusRestored, true); assert.equal(body.style.overflow, "auto"); assert.equal(listeners.size, 0); assert.equal(timers.size, 0); },
  };
  return h;
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

test("버틸 힘 색: 50%, 20% 경계와 빈 막대", () => {
  for (const [hp, max, color] of [[100,100,"green"],[51,100,"green"],[50,100,"yellow"],[21,100,"yellow"],[20,100,"red"],[0,100,"red"],[0,0,"red"]]) assert.equal(hpColor(hp,max), color);
});

test("등장 2.4초, 18ms 타이핑, 탭 완성·진행, 기술↔뒤로, 가방", t => {
  const h = mount(t, { encounter: encounter(), petId: 1, stage: "adult", onClose() {} });
  assert.equal(h.tree.type, "dialog"); assert.equal(h.body.style.overflow, "hidden");
  h.advance(2399); assert.equal(h.phase, "intro"); h.advance(1); assert.equal(h.phase, "playback");
  const visible = () => text(nodes(h.tree, n => n.props.className === "pet-battle-message")[0].props.children[1]);
  assert.equal(visible(), ""); h.advance(18); assert.equal(Array.from(visible()).length, 1);
  h.click("대사 모두 보기"); assert.match(visible(), /함께 나왔어요/);
  h.advance(899); assert.equal(h.phase, "playback"); h.advance(1); assert.equal(h.phase, "command");
  h.click("기술"); assert.equal(h.actions().length, 5);
  for (const b of h.actions()) assert.ok(text(b).includes(HINT_ICON[b.props["data-hint"]]));
  h.click("뒤로"); assert.equal(h.actions().length, 0);
  h.click("가방"); assert.equal(h.phase, "playback"); h.click("대사 모두 보기"); assert.match(visible(), /가방이 비었어요/); h.click("다음 대사"); assert.equal(h.phase, "command");
  h.unmount();
});

for (const [petId, cell, level, expected] of [[1, "F5", 30, "player"], [2, "J10", 1, "opponent"], [1, "F5", 10, "draw"]]) {
  test(`타이머로 등장→선택→전체 라운드→${expected}, 재도전·종료`, t => {
    const e = encounter(cell, level);
    let state = initialFor(e, petId), closed = 0;
    if (expected === "draw") { state.round = 12; state.opponentAction = { kind: "rest" }; }
    const h = mount(t, { encounter: e, petId, stage: "adult", onClose: () => closed++ }, expected === "draw" ? state : undefined);
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
      assert.deepEqual(h.hp, [state.opponent.hp, state.player.hp]);
    }
    assert.equal(state.outcome, expected); assert.equal(h.phase, "result");
    assert.match(text(h.tree), /함께 놀아 줘서 고마워/); assert.match(text(h.tree), /곧 보상이 생겨요/);
    assert.match(text(h.tree), expected === "player" ? /승리!/ : expected === "opponent" ? /아쉬운 패배/ : /무승부/);
    h.click("다시 겨루기"); assert.equal(h.phase, "intro");
    for (const bar of nodes(h.tree, n => n.props.role === "progressbar")) assert.equal(bar.props["aria-valuenow"], bar.props["aria-valuemax"]);
    h.click("등장 연출 건너뛰기"); assert.equal(h.phase, "playback"); h.settle();
    h.click("그만하기"); h.settle(); assert.match(text(h.tree), /다음에 또 만나요/);
    h.click("돌아가기"); assert.equal(closed, 1); h.unmount();
  });
}

test("연출 순서: 대사→돌진→피격→HP→상성, 기력 점은 하나씩", () => {
  const events = [
    { type: "action", side: "player", action: { kind: "push" }, round: 1 },
    { type: "hit", side: "player", target: "opponent", moveId: "push", round: 1 },
    { type: "effectiveness", side: "player", target: "opponent", hint: "good", multiplier: 1.3, round: 1 },
    { type: "damage", side: "player", target: "opponent", amount: 12, hp: 88, round: 1 },
    { type: "energy", side: "player", amount: 2, energy: 8, reason: "round", round: 1 },
  ];
  const before = structuredClone(events), cues = battleCues(events, { player: "미네", opponent: "삽살개" });
  assert.equal(cues[0].text, "미네의 가볍게 밀기!");
  assert.equal(cues[1].motion, "attack"); assert.equal(cues[1].duration, 450);
  assert.equal(cues[2].motion, "hit"); assert.equal(cues[2].event, undefined);
  assert.equal(cues[3].event.type, "damage"); assert.equal(cues[3].duration, 900);
  assert.equal(cues[4].text, "효과가 좋아요!"); assert.equal(cues[4].motion, "effective");
  assert.deepEqual(cues.slice(5).map(c => c.event.energy), [7, 8]); assert.deepEqual(events, before);
  const weak = battleCues(events.map(e => e.type === "effectiveness" ? { ...e, hint: "weak" } : e), { player: "미네", opponent: "삽살개" });
  assert.ok(!weak.some(c => c.motion === "effective"));
});

test("기력 조건, 길게 누르기·취소, Escape 뒤로, 재생 중 닫기 정리", t => {
  const e = encounter(), state = initialFor(e, 1); state.player.energy = 0;
  const h = mount(t, { encounter: e, petId: 1, stage: "baby", onClose() {} }, state);
  h.settle(); h.click("기술");
  for (const b of h.actions()) {
    const action = [...state.player.moves.map(moveId => ({ kind: "move", moveId })), { kind: "push" }].find(a => actionLabel(a) === text(b.props.children[0]));
    assert.equal(b.props.disabled, !engine.availableActions(state, "player").some(a => sameAction(a, action)));
  }
  const push = () => h.button("가볍게 밀기");
  push().props.onPointerDown({ isPrimary: true, button: 0 }); h.advance(500);
  assert.match(text(h.tree), /예상 피해.*명중 시/);
  push().props.onPointerUp(); push().props.onClick(); h.render(); assert.equal(h.phase, "command", "long press must not choose");
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

test("동작 줄이기: 등장 생략, 타이핑·라운드·종료 유지, 진동 없음", t => {
  const e = encounter("F5", 30), state = initialFor(e, 1); state.opponent.hp = 1;
  const h = mount(t, { encounter: e, petId: 1, stage: "adult", onClose() {} }, state, true);
  h.advance(0); assert.equal(h.phase, "playback"); h.settle(); h.click("기술"); h.click("가볍게 밀기"); h.settle();
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
