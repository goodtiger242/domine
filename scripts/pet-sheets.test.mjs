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
gameView.render(); button(gameView.tree, "내 이름 선택").props.onClick(); gameView.render();
const nameButtons = () => nodes(gameView.tree, n => n.type === "button" && PET_LEGAL_NAMES.includes(text(n)));
assert.deepEqual(nameButtons().map(text), PET_LEGAL_NAMES);
assert.equal(button(gameView.tree, "김경석").props["aria-pressed"], true);
const search = nodes(gameView.tree, n => n.type === "input")[0];
assert.equal(nodes(gameView.tree, n => n.type === "input").length, 1, "only search input remains");
assert.equal(search.props.type, "search");
search.props.onChange({ target: { value: "경석" } }); gameView.render();
assert.deepEqual(nameButtons().map(text), ["김경석"]);
search.props.onChange({ target: { value: "ㄱㄱㅅ" } }); gameView.render(); assert.equal(nameButtons().length, 0);
search.props.onChange({ target: { value: "" } }); gameView.render();
button(gameView.tree, "김보영").props.onClick(); await Promise.resolve(); gameView.render();
assert.equal(game.nickname, "김보영"); assert.equal(button(gameView.tree, "김보영").props["aria-pressed"], true);
button(gameView.tree, "선택 해제").props.onClick.call(game); gameView.render(); assert.equal(game.nickname, "");
assert.equal(nameButtons().some(n => n.props["aria-pressed"]), false);
const gameCss = readFileSync("app/games/pet-game.css", "utf8");
assert.match(gameCss, /\.pet-name-grid button\s*\{[^}]*min-height: 44px/);
console.log("Pet name selection: 21 sorted chips, partial search, selected state, connect and clear passed.");
const cards = tree => nodes(tree.props.children, n => n.props.className === "pet-catalog-card");
const state = { ok: true, code: "OK", serverNow: "", coins: 100, player: { coins: 100, xp: 0, level: 1 }, inventory: [], equipment: [] };
let calls = [], release;
const shop = mount("PetShopSheet", { state, petId: 1, disabled: false, notice: "", onClose() {}, execute: command => { calls.push(command); return new Promise(resolve => { release = resolve; }); } });
shop.render(); cards(shop.tree)[0].props.onClick(); shop.render();
assert.equal(cards(shop.tree).length, 20, "detail keeps the list mounted to preserve its scroll position");
button(shop.tree.props.footer, "도미용 구매 · 40 코인").props.onClick(); shop.render();
assert.equal(calls.length, 0, "opening confirmation never purchases");
assert.match(text(shop.tree.props.footer), /도미용으로 40코인에 살까요/);
button(shop.tree.props.footer, "취소").props.onClick(); shop.render();
assert.equal(calls.length, 0);
button(shop.tree.props.footer, "도미용 구매 · 40 코인").props.onClick(); shop.render();
const purchase = button(shop.tree.props.footer, "구매 확인"); purchase.props.onClick(); purchase.props.onClick(); shop.render();
assert.equal(calls.length, 1, "double taps submit once"); assert.equal(calls[0].kind, "purchase");
assert.equal(calls[0].pet, 1); assert.equal(calls[0].item, "061");
release(); await Promise.resolve(); shop.render();
assert.ok(!text(shop.tree.props.footer).includes("착용하기"), "promise resolution alone never claims ownership");
shop.render({ state: { ...state, inventory: ["061"], coins: 60 } });
assert.ok(button(shop.tree.props.footer, "도미에게 착용하기"), "server purchase result enables equip in the same panel");
button(shop.tree.props.footer, "도미에게 착용하기").props.onClick(); shop.render();
assert.equal(calls.at(-1).kind, "equip");
assert.ok(!text(shop.tree.props.panel).includes("착용했어요"), "no optimistic success before server equipment");
release(); await Promise.resolve(); shop.render();
assert.match(text(shop.tree.props.panel), /아직 적용되지 않았어요/);
shop.render({ state: { ...state, inventory: ["061"], equipment: [{ pet_id: 1, slot: "wearable", item_id: "061" }] } });
assert.match(text(shop.tree.props.panel), /도미에게 착용했어요/);
assert.ok(button(shop.tree.props.footer, "착용 해제"));

const poor = mount("PetShopSheet", { state: { ...state, coins: 0 }, petId: 2, disabled: false, notice: "", onClose() {}, execute: async () => assert.fail("insufficient balance must not execute") });
poor.render(); assert.match(text(cards(poor.tree)[0]), /40코인 부족/); cards(poor.tree)[0].props.onClick(); poor.render();
button(poor.tree.props.footer, "미네용 구매 · 40 코인").props.onClick(); poor.render();
assert.match(text(poor.tree.props.panel), /코인이 부족해요/);

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
const dialog = { showModal() {}, close() {}, style: { setProperty() {} } };
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
