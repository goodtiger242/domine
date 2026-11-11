import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import ts from "typescript";
import { loadTS } from "./pet-test-loader.mjs";

const require = createRequire(import.meta.url);
function mount(file, props, imports = {}) {
  const slots = [], effects = []; let cursor = 0, tree;
  function effect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((d, n) => d !== slots[i].deps[n])) { const previous = slots[i]; slots[i] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); }); } }
  const hooks = {
    useState(initial) { const i = cursor++; slots[i] ??= { value: typeof initial === "function" ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === "function" ? value(slots[i].value) : value; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useId: () => "sheet-test", useEffect: effect, useLayoutEffect: effect, useCallback: fn => fn,
  };
  const source = ts.transpileModule(readFileSync(`app/games/${file}.tsx`, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  if (file === "PetShopSheet") {
    const progress = ts.transpileModule(readFileSync("app/games/PetProgress.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const shared = {};
    new Function("require", "exports", progress)(name => name === "react" ? hooks : name.startsWith("@/") ? loadTS(`${name.slice(2)}.ts`) : require(name), shared);
    imports["./PetProgress"] = shared;
  }
  new Function("require", "exports", source)(name => imports[name] ?? (name === "react" ? hooks : name.startsWith("@/") ? loadTS(`${name.slice(2)}.ts`) : name.startsWith("./") ? loadTS(`app/games/${name.slice(2)}.tsx`) : require(name)), exports);
  return { render(next = {}) { Object.assign(props, next); cursor = 0; tree = (exports.default ?? exports.PetGame)(props); return tree; }, get tree() { return tree; }, flushEffects() { while (effects.length) effects.shift()(); }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}
function nodes(node, match) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, match));
  if (!node?.props) return [];
  return [...(match(node) ? [node] : []), ...nodes(node.props.children, match)];
}
const text = node => typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node?.props?.children ?? "");
const button = (tree, label) => nodes(tree, n => n.type === "button" && text(n) === label)[0];
const { PET_LEGAL_NAMES } = loadTS("lib/domine/pet-identity.ts");
const game = {
  machine: { command: "idle", visual: "idle", committedMap: "E5" }, shared: null, personal: null,
  nickname: "김경석", registered: true, capability: "ready", features: { v9: true }, petId: 1, multiPet: true,
  message: "", api: {}, pause() {}, resume() {}, clearIdentity() { this.nickname = ""; },
  async connect(name) { this.nickname = name; },
};
// Render the real game handlers with scene/network dependencies replaced by inert components.
const gameView = mount("PetGame", {}, {
  "./usePetController": { usePetController: () => game }, "next/dynamic": { default: () => "section" },
  "./PetScene": { PetScene: () => null }, "./PetProgress": {}, "./PetFeedback": {}, "./pet-game.css": {},
});
gameView.render(); button(gameView.tree, "김경석").props.onClick(); gameView.render();
assert.ok(!text(gameView.tree).includes("지금: 김경석"));
const input = () => nodes(gameView.tree, n => n.type === "input")[0];
const nameSheet = () => nodes(gameView.tree, n => n.type === "section" && n.props.title === "내 이름")[0];
const submit = () => nodes(gameView.tree, n => n.type === "form")[0].props.onSubmit({preventDefault(){}});
assert.equal(nodes(gameView.tree, n => n.type === "input").length, 1);
assert.equal(input().props.placeholder, "이름", "the name field never shows an earlier name"); assert.equal(input().props.enterKeyHint, "go");
function noRoster() {
  const html = renderToStaticMarkup(createElement("section", null, nameSheet().props.children));
  for (const name of PET_LEGAL_NAMES) if (name !== game.nickname) assert.ok(!html.includes(name), `sheet must not render ${name}`);
  assert.equal(nodes(nameSheet(), n => n.type === "button").length, 1, "only the start button in the name content");
  assert.doesNotMatch(html, /선택 해제|연결 다시 확인|결과 확인|개인 기록|성장 단계|함께한 돌봄|최근 기록|오늘 돌봐 준|다른 이름으로/);
}
assert.equal(PET_LEGAL_NAMES.length, 21);
noRoster();
for (const value of ["김", "경석", "ㄱㄱㅅ", "보영", ...PET_LEGAL_NAMES.map(name => name.slice(0, 1))]) {
  input().props.onChange({target:{value}}); gameView.render(); noRoster();
}
input().props.onChange({target:{value:"명단에없음"}}); gameView.render(); submit(); await Promise.resolve(); gameView.render();
assert.equal(game.nickname,"김경석");
assert.match(text(nameSheet()), /도미네 청년회 이름을 정자로 사용해주세요/); noRoster();
input().props.onChange({target:{value:"김보영"}}); gameView.render(); submit(); await Promise.resolve(); await Promise.resolve(); gameView.render();
assert.equal(game.nickname,"김보영"); assert.equal(nodes(gameView.tree, n => n.type === "input").length, 0, "enter starts and closes sheet");
button(gameView.tree, "김보영").props.onClick(); gameView.render(); noRoster();
game.nickname=""; game.registered=false; gameView.render(); noRoster();
assert.ok(button(gameView.tree,"내 이름"));
const gameCss = readFileSync("app/games/pet-game.css", "utf8");
assert.match(gameCss, /\.pet-record-form input[^{}]*\{[^}]*font-size: 16px/);
assert.match(gameCss, /button:focus:not\(:focus-visible\)/);
assert.match(gameCss, /header button\s*\{[^}]*border: 0/);
console.log("Pet name: one input, enter submit, no roster HTML, exact validation message and minimal content passed.");
const cards = tree => nodes(tree.props.children, n => n.props.className === "pet-catalog-card");
const state = { ok: true, code: "OK", serverNow: "", coins: 100, player: { coins: 100, xp: 0, level: 1 }, inventory: [], equipment: [] };
let calls = [], release;
const shop = mount("PetShopSheet", { state, petId: 1, disabled: false, notice: "", onClose() {}, execute: command => { calls.push(command); return new Promise(resolve => { release = resolve; }); } });
shop.render(); cards(shop.tree)[0].props.onClick(); shop.render();
assert.equal(cards(shop.tree).length, 20, "detail keeps the list mounted to preserve its scroll position");
button(shop.tree.props.footer, "구매 40").props.onClick(); shop.render();
assert.equal(calls.length, 0, "opening confirmation never purchases");
assert.ok(button(shop.tree.props.footer, "구매 확인 40"));
button(shop.tree.props.footer, "취소").props.onClick(); shop.render();
assert.equal(calls.length, 0);
button(shop.tree.props.footer, "구매 40").props.onClick(); shop.render();
const purchase = button(shop.tree.props.footer, "구매 확인 40"); purchase.props.onClick(); purchase.props.onClick(); shop.render();
assert.equal(calls.length, 1, "double taps submit once"); assert.equal(calls[0].kind, "purchase");
assert.equal(calls[0].pet, 1); assert.equal(calls[0].item, "061");
release(); await Promise.resolve(); shop.render();
assert.ok(!text(shop.tree.props.footer).includes("착용하기"), "promise resolution alone never claims ownership");
shop.render({ state: { ...state, inventory: ["061"], coins: 60 } });
assert.ok(button(shop.tree.props.footer, "착용하기"), "server purchase result enables equip in the same panel");
button(shop.tree.props.footer, "착용하기").props.onClick(); shop.render();
assert.equal(calls.at(-1).kind, "equip");
assert.ok(!text(shop.tree.props.panel).includes("착용했어요"), "no optimistic success before server equipment");
release(); await Promise.resolve(); shop.render();
assert.match(text(shop.tree.props.panel), /아직 적용되지 않았어요/);
shop.render({ state: { ...state, inventory: ["061"], equipment: [{ pet_id: 1, slot: "wearable", item_id: "061" }] } });
assert.doesNotMatch(text(shop.tree.props.panel), /착용했어요|보유|아직 안 입었어요/);
assert.ok(button(shop.tree.props.footer, "착용 해제"));

const poor = mount("PetShopSheet", { state: { ...state, coins: 0 }, petId: 2, disabled: false, notice: "", onClose() {}, execute: async () => assert.fail("insufficient balance must not execute") });
poor.render(); assert.match(text(cards(poor.tree)[0]), /🪙 40/); cards(poor.tree)[0].props.onClick(); poor.render();
button(poor.tree.props.footer, "구매 40").props.onClick(); poor.render();
assert.match(text(poor.tree.props.panel), /40코인 부족해요/);

let selectedPet, openedShop = false;
const bag = mount("PetShopSheet", { state: { ...state, inventory: ["061", "073"], equipment: [{ pet_id: 1, slot: "wearable", item_id: "061" }] }, bag: true, petId: 1, disabled: false, notice: "", onClose() {}, onSelectPet: id => { selectedPet = id; }, onShop: () => { openedShop = true; }, execute: async command => { calls.push(command); } });
bag.render(); assert.equal(cards(bag.tree).length, 2); assert.equal(cards(bag.tree)[0].props["aria-pressed"], true);
cards(bag.tree)[0].props.onClick(); await Promise.resolve(); bag.render();
assert.equal(calls.at(-1).item, null, "one tap on equipped bag item removes it"); assert.ok(!bag.tree.props.panel);
cards(bag.tree)[1].props.onClick(); await Promise.resolve(); bag.render();
assert.equal(calls.at(-1).item, "073", "one tap on owned bag item equips it");
button(bag.tree.props.toolbar, "미네").props.onClick(); assert.equal(selectedPet, 2);
bag.render({ petId: 2, state: { ...state, inventory: [] } }); assert.equal(cards(bag.tree).length, 0);
button(bag.tree.props.footer, "상점 가기").props.onClick(); assert.ok(openedShop);

const album = mount("PetAlbumSheet", { state: { ...state, album: ["001", "061"], season: "advent" }, disabled: false, notice: "", map: "church", execute: async command => calls.push(command), onClose() {} });
album.render(); assert.equal(cards(album.tree).length, 96);
button(album.tree.props.toolbar, "발견").props.onClick(); album.render(); assert.equal(cards(album.tree).length, 2);
button(album.tree.props.toolbar, "옷").props.onClick(); album.render(); assert.equal(cards(album.tree).length, 1);
cards(album.tree)[0].props.onClick(); album.render(); assert.match(text(album.tree.props.footer), /기록함/);
button(album.tree.props.toolbar, "미발견").props.onClick(); album.render(); assert.equal(cards(album.tree).length, 11);
const categories = nodes(album.tree.props.toolbar, n => n.props["aria-label"] === "도감 분류")[0];
button(categories, "전체").props.onClick(); album.render();
const seasonal = cards(album.tree).find(card => card.key === "081"); seasonal.props.onClick(); album.render();
assert.equal(calls.at(-1).kind, "record_season"); assert.equal(calls.at(-1).entry, "081");
assert.equal(album.tree.props.onBack(), true); album.render(); assert.ok(!album.tree.props.footer);

const Achievements = loadTS("app/games/PetAchievementSheet.tsx").default;
const html = renderToStaticMarkup(createElement(Achievements, { badges: ["A30"], notice: "", onClose() {} }));
assert.ok(html.indexOf("오래 함께") < html.indexOf("첫 인사"), "achieved badges sort first");
console.log("Pet sheets: confirmation, double-tap guard, server-only success, bag actions, filters and achievement order passed.");

// The dialog owns scroll locking, history and gestures; exercise those handlers without a DOM library.
let closed = 0, backs = 0, restoredScroll;
const events = new Map(), viewportEvents = new Map();
const style = { overflow: "auto", position: "", top: "", width: "" };
globalThis.document = { body: { style }, activeElement: { focus() {}, isConnected: true } };
globalThis.window = { scrollY: 120, innerHeight: 780, scrollTo(value) { restoredScroll = value.top; }, addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key), visualViewport: { height: 780, offsetTop: 0, addEventListener: (key, fn) => viewportEvents.set(key, fn), removeEventListener: key => viewportEvents.delete(key) } };
globalThis.history = { state: { original: true }, pushState(value) { this.state = value; }, back() { backs++; } };
const sheet = mount("PetSheet", { title: "가방", children: "목록", onClose() { closed++; }, onBack: () => false });
sheet.render();
const dialog = { showModal() {}, close() {}, focus() {}, style: { setProperty() {} } };
sheet.tree.props.ref.current = dialog;
const scroll = nodes(sheet.tree, n => n.props.className === "pet-sheet-content")[0]; scroll.props.ref.current = { scrollTop: 0 };
sheet.flushEffects(); assert.equal(style.position, "fixed"); assert.equal(style.top, "-120px"); assert.equal(history.state.original, true);
const handle = nodes(sheet.tree, n => n.props.className === "pet-sheet-handle")[0];
const pointer = y => ({ isPrimary: true, button: 0, pointerId: 1, clientY: y, currentTarget: { setPointerCapture() {} } });
handle.props.onPointerDown(pointer(10)); handle.props.onPointerUp(pointer(89)); assert.equal(closed, 0);
handle.props.onPointerDown(pointer(10)); handle.props.onPointerUp(pointer(90)); assert.equal(closed, 1);
scroll.props.ref.current.scrollTop = 20;
handle.props.onPointerDown(pointer(10)); handle.props.onPointerUp(pointer(120)); assert.equal(closed, 1, "a scrolled list cannot swipe-dismiss");
scroll.props.ref.current.scrollTop = 0;
handle.props.onPointerDown(pointer(10)); handle.props.onPointerCancel(); handle.props.onPointerUp(pointer(120)); assert.equal(closed, 1);
sheet.tree.props.onPointerDown({ target: {}, currentTarget: dialog }); sheet.tree.props.onClick({ target: dialog, currentTarget: dialog }); assert.equal(closed, 1, "starting inside must not count as a backdrop tap");
sheet.tree.props.onPointerDown({ target: dialog, currentTarget: dialog }); sheet.tree.props.onClick({ target: dialog, currentTarget: dialog }); assert.equal(closed, 2);
sheet.render({ onBack: () => true }); sheet.flushEffects(); events.get("popstate")(); assert.equal(closed, 2, "detail back is handled before closing the sheet");
sheet.tree.props.onCancel({ preventDefault() {} }); assert.equal(closed, 2);
sheet.render({ onBack: () => false }); sheet.flushEffects(); sheet.tree.props.onCancel({ preventDefault() {} }); assert.equal(closed, 3);
sheet.unmount(); assert.equal(style.position, ""); assert.equal(style.overflow, "auto"); assert.equal(restoredScroll, 120); assert.equal(backs, 1); assert.equal(events.size, 0); assert.equal(viewportEvents.size, 0);
console.log("Pet sheet shell: 80px drag, scroll-top guard, cancel, backdrop, back navigation and scroll restoration passed.");

let battlePause = false;
const battleGame = { ...game, worldReady: true, petId: 2, personal: { levels: { 2: 40 } },
  machine: { command: "idle", visual: "idle", committedMap: "E5" },
  pause(localOnly) { battlePause = localOnly; }, resume() { battlePause = false; },
};
const battleView = mount("PetGame", {}, {
  "./usePetController": { usePetController: () => battleGame }, "next/dynamic": { default: () => "section" },
  "./PetScene": { PetScene: () => null }, "./PetProgress": {}, "./PetFeedback": {}, "./pet-game.css": {},
});
const scene = () => nodes(battleView.tree, n => "onBattle" in n.props)[0];
const { encounterFor, encounterSlot, readEncounterWins, ENCOUNTER_STORAGE } = loadTS("lib/domine/pet-battle-view.ts");
const { PET_WORLD } = loadTS("lib/domine/pet-world.ts");
const saved = new Map();
window.localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
for (const cell of ["E5", "D5"]) {
  battleGame.machine.committedMap = cell; battleView.render();
  assert.equal(typeof scene().props.onBattle, "function"); assert.equal(scene().props.hasOpponent, false);
  scene().props.onBattle(); battleView.render(); assert.equal(battlePause, false);
  button(battleView.tree, "여긴 겨룰 상대가 없어요 · 지도에서 🐾를 찾아보세요").props.onClick(); battleView.render();
  const map = nodes(battleView.tree, n => "showAnimals" in n.props)[0];
  assert.equal(map.props.showAnimals, true); map.props.onClose(); battleView.render();
}
const slot = encounterSlot(), found = PET_WORLD.find(cell => encounterFor(cell.id, 40, slot));
battleGame.machine.committedMap = found.id; battleGame.machine.command = "pending"; battleView.render();
assert.equal(scene().props.battleDisabled, true); scene().props.onBattle(); battleView.render(); assert.equal(battlePause, false);
battleGame.machine.command = "idle"; battleView.render(); scene().props.onBattle(); battleView.render();
assert.equal(battlePause, true); assert.equal(scene().props.locked, true);
assert.ok(nodes(battleView.tree, n => n.props.className === "pet-action").every(n => n.props.disabled));
let battleSheet = nodes(battleView.tree, n => n.props.encounter)[0];
assert.equal(battleSheet.props.petId, 2); assert.equal(battleSheet.props.encounter.playerLevel, 30);
battleSheet.props.onClose(); battleView.render(); assert.equal(battlePause, false); assert.equal(scene().props.locked, false);
assert.equal(scene().props.hasOpponent, true, "closing without a win keeps the opponent");
scene().props.onBattle(); battleView.render(); battleSheet = nodes(battleView.tree, n => n.props.encounter)[0];
battleSheet.props.onWin(); battleView.render();
assert.deepEqual(readEncounterWins(window.localStorage, slot), [`${slot}:${found.id}`]);
battleSheet.props.onClose(); battleView.render();
assert.equal(scene().props.hasOpponent, false); scene().props.onBattle(); battleView.render();
assert.equal(nodes(battleView.tree, n => n.props.encounter).length, 0);
assert.deepEqual(readEncounterWins(window.localStorage, slot + 1), []);
for (const invalid of ["bad json", "{}", '[null,1,"bad","0:E5"]']) {
  saved.set(ENCOUNTER_STORAGE, invalid); assert.deepEqual(readEncounterWins(window.localStorage, slot), []);
}
assert.deepEqual(readEncounterWins({ getItem() { throw new Error("blocked"); } }, slot), []);
console.log("Battle entry: always-visible button, animal map, pending guard, selected pet, wins and storage validation passed.");

// A shared clock refreshes both the scene and an open map, but never an active battle.
const originalNow = Date.now, originalInterval = globalThis.setInterval, originalClear = globalThis.clearInterval;
const intervals = new Map(); let clock = 100 * 1800000, intervalId = 0;
Date.now = () => clock;
globalThis.setInterval = (fn, ms) => { intervals.set(++intervalId, { fn, ms }); return intervalId; };
globalThis.clearInterval = id => intervals.delete(id);
let timed;
try {
  const changing = PET_WORLD.find(cell => encounterFor(cell.id, 10, 100) && !encounterFor(cell.id, 10, 101));
  battleGame.machine.committedMap = changing.id;
  timed = mount("PetGame", {}, {
    "./usePetController": { usePetController: () => battleGame }, "next/dynamic": { default: () => "section" },
    "./PetScene": { PetScene: () => null }, "./PetProgress": {}, "./PetFeedback": {}, "./pet-game.css": {},
  });
  const timedScene = () => nodes(timed.tree, n => "onBattle" in n.props)[0];
  timed.render(); timed.flushEffects(); timed.render();
  assert.equal(timedScene().props.hasOpponent, true);
  timedScene().props.onMap(); timed.render(); timed.flushEffects(); timed.render();
  const worldSheet = () => nodes(timed.tree, n => "showAnimals" in n.props)[0];
  assert.equal(worldSheet().props.slot, 100);
  clock += 1800000; [...intervals.values()].find(timer => timer.ms === 60000).fn(); timed.render(); timed.flushEffects(); timed.render();
  assert.equal(worldSheet().props.slot, 101); assert.equal(timedScene().props.hasOpponent, false);
  worldSheet().props.onClose(); timed.render(); timed.flushEffects(); timed.render();
  clock = 100 * 1800000;
  timedScene().props.onBattle(); timed.render(); timed.flushEffects(); timed.render();
  const frozen = nodes(timed.tree, n => n.props.encounter)[0];
  assert.equal(frozen.props.encounter.slot, 100);
  assert.equal(intervals.size, 0, "no encounter timer while battling");
  clock = 102 * 1800000;
  frozen.props.onClose(); timed.render(); timed.flushEffects(); timed.render();
  timedScene().props.onMap(); timed.render(); timed.flushEffects(); timed.render();
  assert.equal(worldSheet().props.slot, 102, "closing a battle immediately catches up to the clock");
} finally {
  timed?.unmount(); Date.now = originalNow; globalThis.setInterval = originalInterval; globalThis.clearInterval = originalClear;
}
assert.equal(intervals.size, 0);
const world = mount("PetWorldSheet", { current: found.id, visited: [], slot, wins: [], showAnimals: true, onMove() {}, onClose() {} });
world.render();
const place = () => nodes(world.tree, n => n.type === "button" && n.key === found.id)[0];
assert.match(place().props["aria-label"], /동물 있음/);
world.render({ wins: [`${slot}:${found.id}`] }); assert.doesNotMatch(place().props["aria-label"], /동물 있음/);
world.render({ wins: [], slot: slot + 1 });
assert.equal(place().props["aria-label"].includes("동물 있음"), !!encounterFor(found.id, 1, slot + 1));
console.log("Encounter clock: open map/scene refresh, frozen battles, immediate catch-up and map win filtering passed.");
