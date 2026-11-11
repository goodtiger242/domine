import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { loadTS } from "./pet-test-loader.mjs";

const require = createRequire(import.meta.url);
function mount(file, props, imports = {}) {
  imports["next/image"] ??= { default: "img" };
  let cursor = 0;
  const slots = [];
  const hooks = {
    useState(value) { const i = cursor++; slots[i] ??= { value: typeof value === "function" ? value() : value }; return [slots[i].value, next => { slots[i].value = typeof next === "function" ? next(slots[i].value) : next; }]; },
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useId: () => "onboarding", useEffect() {}, useCallback: fn => fn,
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(`app/games/${file}.tsx`, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "exports", source)(name => imports[name] ?? (name === "react" ? hooks : name.startsWith("@/") ? loadTS(`${name.slice(2)}.ts`) : name.startsWith("./") ? loadTS(`app/games/${name.slice(2)}.tsx`) : require(name)), exports);
  return () => { cursor = 0; return (exports.PetGame ?? exports.default)(props); };
}
function nodes(node, match) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, match));
  if (!node?.props) return [];
  return [...(match(node) ? [node] : []), ...nodes(node.props.children, match)];
}
const text = node => typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node?.props?.children ?? "");
const button = (tree, label) => nodes(tree, node => node.type === "button" && text(node) === label)[0];
const saved = new Map();
globalThis.window = { localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) } };
let checks = 0, connections = 0, fail = false, pending;
const game = {
  machine: { command: "idle", visual: "idle", committedMap: "E5" }, shared: null, personal: null,
  registered: false, capability: "loading", petId: 1, multiPet: true, worldReady: true,
  message: "", api: {}, pause() {}, resume() {}, setMessage(value) { this.message = value; },
  async localScene({ to }) { this.machine.committedMap = to; },
  async checkCapabilities() { checks++; this.capability = "ready"; },
  async connect() { connections++; if (pending) await pending; if (fail) throw Error("storage unavailable"); this.registered = true; },
};
const king = { state: { pets: [{ pet: 1, xp: 0, level: 1, inventory: {} }], coins: 0, encyclopedia: [] }, departed: [], settled(result) { this.result = result; } };
const loading = [];
const render = mount("PetGame", {}, {
  "./usePetController": { usePetController: () => game }, "./usePetKing": { usePetKing: () => king },
  "next/dynamic": { default: (fn, options) => { loading.push(options.loading); return /\.\/(Pet\w+)/.exec(fn.toString())?.[1] ?? "sheet"; } },
  "./PetScene": { PetScene: "scene" }, "./PetProgress": { default: "progress" }, "./PetFeedback": {}, "./pet-game.css": {},
});
let tree = render();
assert.ok(nodes(tree, n => n.type === "input").length);
assert.match(text(tree), /연결 확인 중/);
assert.ok(!button(tree, "지도에서 첫 상대 찾기"));
game.capability = "error";
tree = render(); assert.match(text(tree), /연결을 확인하지 못했어요 · 다시 시도/);
await button(tree, "다시 시도").props.onClick(); await Promise.resolve();
assert.equal(checks, 1); assert.equal(connections, 0, "retry never restores a stored name");
tree = render();
const input = () => nodes(tree, n => n.type === "input")[0];
const submit = () => nodes(tree, n => n.type === "form")[0].props.onSubmit({ preventDefault() {} });
input().props.onChange({ target: { value: "명단에없음" } }); tree = render(); submit(); tree = render();
assert.match(text(tree), /도미네 청년회 이름을 정자로 사용해주세요/);
assert.equal(connections, 0);
input().props.onChange({ target: { value: "김보영" } }); tree = render();
fail = true; submit(); await Promise.resolve(); await Promise.resolve(); tree = render();
assert.match(text(tree), /연결을 확인하지 못했어요 · 다시 시도/);
assert.equal(input().props.value, "김보영", "failed input remains available for retry");
assert.doesNotMatch(text(tree), /정자로 사용해주세요/);
fail = false; let release;
pending = new Promise(resolve => { release = resolve; });
button(tree, "다시 시도").props.onClick(); tree = render();
assert.equal(nodes(tree, n => n.type === "button" && n.props.type === "submit")[0].props.disabled, true);
release(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); pending = null;
tree = render(); button(tree, "지도에서 첫 상대 찾기").props.onClick(); tree = render();
assert.equal(saved.get("domine-pet-map-animals"), "1");
const map = nodes(tree, n => n.type === "PetWorldSheet")[0];
assert.equal(map.props.showAnimals, true);
assert.ok(!button(tree, "지도에서 첫 상대 찾기"), "one guide at a time");
const firstMap = mount("PetWorldSheet", map.props);
const suggestions = nodes(firstMap(), n => n.props["aria-label"] === "순한 동급 이하 상대")[0];
suggestions.props.children[0].props.onClick();
button(firstMap().props.footer, "이동").props.onClick();
assert.notEqual(game.machine.committedMap, "E5", "the recommendation goes through the real map-to-game move handler");
king.state.encyclopedia = [{ wins: 1 }]; tree = render();
assert.ok(!button(tree, "지도에서 첫 상대 찾기"), "confirmed win removes onboarding");
assert.equal(loading.length, 9); assert.ok(loading.every(fn => fn().props["aria-busy"]));

const { spawnsFor, encounterSlot } = loadTS("lib/domine/pet-battle-view.ts");
const { PET_WORLD } = loadTS("lib/domine/pet-world.ts");
const slot = encounterSlot();
const opponents = PET_WORLD.flatMap(cell => spawnsFor(cell.id, 1, slot));
const gentle = opponents.find(e => e.level <= 1 && ["순둥이", "보통"].includes(e.individual.intelligence));
const hard = opponents.find(e => e.level > 1);
assert.ok(gentle && hard);
game.machine.committedMap = gentle.cellId; tree = render();
nodes(tree, n => n.type === "scene")[0].props.onEncounter(gentle); tree = render();
nodes(tree, n => n.type === "PetEncounterSheet")[0].props.onStart(); tree = render();
const battle = nodes(tree, n => n.type === "PetBattleSheet")[0];
assert.equal(nodes(tree, n => n.type === "progress")[0].props.reward, undefined, "local victory is not a confirmed reward");
const settlement = { ticket: "confirmed", outcome: "win", xp: 21, coins: 3, levelBefore: 1, levelAfter: 1,
  progress: { ...king.state.pets[0], xp: 21, version: 2 }, wallet: { coins: 3, version: 2 } };
king.state.pets[0].version = 1;
battle.props.onSettled(settlement); battle.props.onClose(); tree = render();
assert.equal(king.result, settlement);
assert.equal(nodes(tree, n => n.type === "progress")[0].props.reward, settlement);
assert.equal(nodes(tree, n => n.type === "progress")[0].props.xp, 21, "confirmed progress is visible before the background read returns");
assert.equal(nodes(tree, n => n.type === "progress")[0].props.coins, 3);
king.state.version = 3; king.state.coins = 1; king.state.pets[0] = { ...settlement.progress, version: 3, xp: 40, level: 2 };
tree = render();
assert.equal(nodes(tree, n => n.type === "progress")[0].props.xp, 40, "newer server progress wins over the last reward");
assert.equal(nodes(tree, n => n.type === "progress")[0].props.coins, 1, "newer purchases are not overwritten by the last reward");
king.state.encyclopedia = [];
battle.props.onSettled({ ...settlement, ticket: "next", outcome: "lose" }); tree = render();
assert.ok(!button(tree, "지도에서 첫 상대 찾기"), "a later loss cannot restore the first-win guide while the encyclopedia refresh is delayed");
const serverState = king.state; king.state = null;
assert.doesNotThrow(render, "older or unsupported server data keeps the screen usable");
king.state = serverState;
const encounter = mount("PetEncounterSheet", { encounters: [hard, gentle], selected: null, petId: 1, onSelect() {}, onStart() {}, onClose() {} });
const list = nodes(encounter(), n => n.props.className === "pet-encounter-list")[0];
assert.equal(list.props.children[0].key, gentle.id);
const selected = mount("PetEncounterSheet", { encounters: [gentle], selected: gentle, petId: 1, onSelect() {}, onStart() {}, onClose() {} });
assert.doesNotMatch(text(selected()), /상점 가기|전투 물품/);
for (const current of ["D5", "E5"]) {
  const world = mount("PetWorldSheet", { current, visited: [], slot, wins: [], careLevel: 1, showAnimals: true, onMove() {}, onClose() {} });
  assert.match(text(world()), /안전 구역/);
  assert.equal(nodes(world(), n => n.props["aria-label"] === "순한 동급 이하 상대")[0].props.children.length, 3);
}
console.log("Pet onboarding: loading/error/retry/name privacy, first opponent, animal preference, gentle ordering and safe zones passed.");
