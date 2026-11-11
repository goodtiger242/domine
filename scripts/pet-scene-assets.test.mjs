import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { loadTS } from "./pet-test-loader.mjs";

const require = createRequire(import.meta.url);
function nodes(node, match) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, match));
  if (!node?.props) return [];
  return [...(match(node) ? [node] : []), ...nodes(node.props.children, match)];
}
const text = node => typeof node === "string" ? node : Array.isArray(node) ? node.map(text).join("") : text(node?.props?.children ?? "");
test("scene retains a decoded background, retries failures and ignores obsolete image work", async t => {
  const original = { window: globalThis.window, document: globalThis.document };
  globalThis.window = { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) };
  globalThis.document = { hidden: true, addEventListener() {}, removeEventListener() {} };
  t.after(() => Object.assign(globalThis, original));
  const slots = [], effects = [], requests = [];
  let cursor = 0, dirty = true, tree;
  const hooks = {
    memo: fn => fn, useId: () => "scene-assets",
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, next => { const value = typeof next === "function" ? next(slots[index].value) : next; if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; } }];
    },
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useEffect(fn, deps) {
      const index = cursor++, previous = slots[index];
      if (!deps || !previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        slots[index] = { deps };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = fn(); });
      }
    },
  };
  hooks.useLayoutEffect = hooks.useEffect;
  const props = { stage: "adult", face: "happy", light: 1, hour: 12, collar: "white", cue: null, cellId: "E5", onSay() {} };
  const exports = {};
  const source = ts.transpileModule(readFileSync("app/games/PetScene.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "exports", source)(name => {
    if (name === "react") return hooks;
    if (name === "./PetDog") return { DOG_W: { adult: 40 }, PetDog: "dog" };
    if (name === "next/image") return { default: "img" };
    if (name === "@/lib/domine/pet-assets") return { itemAsset: () => null, prepareImage: (src, signal) => new Promise(resolve => requests.push({ src, signal, resolve })) };
    return name.startsWith("@/") ? loadTS(`${name.slice(2)}.ts`) : require(name);
  }, exports);
  async function render(next = {}) {
    Object.assign(props, next); dirty = true;
    for (let i = 0; i < 15; i++) {
      if (dirty) { cursor = 0; dirty = false; tree = exports.PetScene(props); }
      while (effects.length) effects.shift()();
      await Promise.resolve();
      if (!dirty) return tree;
    }
    assert.fail("scene effects did not settle");
  }
  const background = () => nodes(tree, n => n.type === "image" && n.props.preserveAspectRatio === "none")[0]?.props.href;
  await render();
  const first = background();
  assert.match(text(tree), /그림 준비 중/);
  for (const request of requests.splice(0)) request.resolve(true);
  await render();
  assert.doesNotMatch(text(tree), /그림 준비 중/);
  await render({ cellId: "F5" });
  assert.equal(background(), first, "keep the previous photo until the next one decodes");
  const failed = requests.splice(0);
  for (const request of failed) request.resolve(false);
  await render();
  assert.equal(background(), first);
  const retry = nodes(tree, n => n.type === "button" && text(n) === "그림 다시 불러오기")[0];
  assert.ok(retry); retry.props.onClick();
  await render();
  assert.ok(requests.length);
  for (const request of requests.splice(0)) request.resolve(true);
  await render();
  assert.equal(background(), "/pet/cell/F5.webp");
  await render({ cellId: "G5" });
  const stale = requests.splice(0);
  await render({ cellId: "H5" });
  assert.ok(stale.every(request => request.signal.aborted));
  for (const request of requests.splice(0)) request.resolve(true);
  await render();
  const current = background();
  for (const request of stale) request.resolve(false);
  await render();
  assert.equal(background(), current);
  assert.doesNotMatch(text(tree), /그림 다시 불러오기/);

  let mapOpened = false;
  await render({ onMap() { mapOpened = true; }, travel: { id: 1, from: "H5", direction: "n", phase: "exit", reduced: true } });
  await render({ travel: null });
  const moveRetry = nodes(tree, n => n.type === "button" && text(n) === "이동 실패 · 지도 열기")[0];
  assert.ok(moveRetry); moveRetry.props.onClick(); assert.equal(mapOpened, true);
  for (const slot of slots) slot.cleanup?.();
});
