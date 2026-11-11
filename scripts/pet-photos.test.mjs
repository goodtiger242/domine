import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { loadTS } from "./pet-test-loader.mjs";
import { backgroundAt, BACKGROUNDS, CHURCH_BACKGROUNDS, poseAt, POSES, PETS, PRIEST, DOGHOUSE, petText } from "../lib/domine/pet-photos.ts";
const { DEFAULT_MAP, PET_MAPS, petMap, actionsForMap, SHOPS } = loadTS("lib/domine/pet-maps.ts");
const { PET_WORLD, DIRECTIONS, neighborCell } = loadTS("lib/domine/pet-world.ts");
import { petRequest } from "../lib/domine/pet-rpc.ts";
import { bubblePosition } from "../lib/domine/pet-bubble.ts";

for (const width of [318, 348, 370, 390]) {
  const height = width * 9 / 16;
  for (const x of [0, 80, 160]) {
    for (const y of [20, 55, 89]) {
      for (const [bubbleWidth, bubbleHeight] of [[52, 28], [200, 44], [Math.min(240, width * .72), 60]]) {
        const p = bubblePosition(x, y, width, height, bubbleWidth, bubbleHeight);
        const left = p.left / 100 * width;
        const top = p.top / 100 * height;
        assert.ok(left >= width * .14 - 1e-9 && left + bubbleWidth <= width * .86 + 1e-9, "Bubble stays inside horizontal edges");
        assert.ok(top >= height * .22 - 1e-9 && top + bubbleHeight <= height - 46 + 1e-9, "Bubble and tail stay inside vertical edges");
        assert.ok(p.tail > 0 && p.tail < 100, "Tail stays on bubble");
        if (x === 0) assert.ok(p.tail < 50, "Left-edge tail points left");
        if (x === 80) assert.equal(p.tail, 50, "Centered tail points to dog");
        if (x === 160) assert.ok(p.tail > 50, "Right-edge tail points right");
      }
    }
  }
}

for (const [hour, expected] of [
  [0, "night"], [4.99, "night"], [5, "dawn"], [6.99, "dawn"],
  [7, "day"], [16.99, "day"], [17, "dusk"], [20.99, "dusk"], [21, "night"],
]) assert.equal(backgroundAt(hour), expected);
assert.equal(poseAt("pet-sit", "sleepy"), "sit");
assert.equal(poseAt("pet-lie", "happy"), "lie");
assert.equal(poseAt(null, "sleepy"), "sleep");
assert.equal(poseAt("pet-trot", "sleepy"), null);
assert.equal(poseAt(null, "happy"), null);
const require = createRequire(import.meta.url);
const petModule = { exports: {} };
new Function("require", "exports", ts.transpileModule(readFileSync(new URL("../lib/domine/pet.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(() => ({}), petModule.exports);
const { availableActionGroups, PET_ACTIONS } = petModule.exports;
assert.deepEqual(availableActionGroups([]), []);
assert.deepEqual(availableActionGroups(["walk"]), [{ category: "놀이", actions: ["walk"] }]);
assert.deepEqual(availableActionGroups(["feed", "pet", "walk"]), [
  { category: "먹이", actions: ["feed"] }, { category: "돌봄", actions: ["pet"] }, { category: "놀이", actions: ["walk"] },
]);
assert.deepEqual(availableActionGroups(PET_ACTIONS).map((g) => g.actions), [
  ["feed", "treat"], ["pet", "brush", "bath"], ["play", "walk", "train"],
]);
const dogModule = { exports: {} };
const dogSource = ts.transpileModule(readFileSync(new URL("../app/games/PetDog.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
new Function("require", "exports", dogSource)(
  (name) => name === "@/lib/domine/pet-photos" ? { PETS, poseAt } : require(name), dogModule.exports,
);
for (const stage of ["baby", "young", "adult"]) {
  for (const [motion, face, pose] of [["pet-sit", "happy", "sit"], ["pet-lie", "happy", "lie"], [null, "sleepy", "sleep"]]) {
    const props = { stage, motion, face, light: 0.8, collar: "purple" };
    const src = POSES[pose].src;
    const ready = renderToStaticMarkup(createElement(dogModule.exports.PetDog, { ...props, photos: { [src]: true } }));
    assert.ok(ready.includes(`href="${src}"`));
    assert.ok(!ready.includes('class="pet-lie"') && !ready.includes('class="pet-sit"'));
    const fallback = renderToStaticMarkup(createElement(dogModule.exports.PetDog, { ...props, photos: {} }));
    assert.ok(fallback.includes(`href="/pet/${stage === "adult" ? "adult" : "puppy"}.webp"`));
  }
}
// Render the scene without effects or network calls, at two feeding depths.
const sceneModule = { exports: {} };
let sceneState = {};
let sceneEffects = [];
const sceneSource = ts.transpileModule(readFileSync(new URL("../app/games/PetScene.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
new Function("require", "exports", sceneSource)((name) => {
  if (name === "./PetDog") return dogModule.exports;
  if (name.startsWith("@/lib/domine/")) return loadTS(`lib/domine/${name.split("/").pop()}.ts`);
  if (name === "react") return {
    ...require("react"),
    useState: (initial) => require("react").useState(initial?.fx ? { ...initial, ...sceneState } : initial),
    useEffect: (effect) => { sceneEffects.push(effect); },
  };
  return require(name);
}, sceneModule.exports);
const renderScene = (props = {}) => renderToStaticMarkup(createElement(sceneModule.exports.PetScene, {
  stage: "adult", face: "happy", light: 0.8, hour: 22, collar: "purple", cue: Object.keys(sceneState).length ? { action: "feed", id: 1 } : null, onSay() {}, bubble: "반가워요!",
  ...props,
}));
assert.ok(!renderScene().includes("/pet/art/bowl.webp"));
assert.ok(!renderScene().includes("foreignObject"));
assert.ok(renderScene().includes('aria-label="도미의 말"'));
for (const cell of PET_WORLD) {
  const map = petMap(cell.theme);
  const html = renderScene({ cellId: cell.id, petId: 2, locked: true });
  assert.equal(html.includes('aria-label="개집"'), map.id === "home");
  assert.equal(html.includes('aria-label="맥도날드 앞으로 가기"'), cell.id === "F6");
  assert.ok(html.includes('aria-label="미네의 말"'));
  assert.equal(html.includes('aria-label="신부님께 인사하기" disabled=""'), map.id === "church");
  assert.ok(html.includes(cell.name));
  for (const direction of DIRECTIONS) {
    const neighbor = neighborCell(cell.id, direction);
    assert.equal(html.includes(`pet-direction-${direction}`), !!neighbor);
    if (neighbor) assert.ok(html.includes(`aria-label="${neighbor.name}(으)로 이동" disabled=""`));
  }
}
assert.ok(renderScene({ speaker: "priest" }).includes('aria-label="신부님의 말"'));
// Verify the sheet's actual click handlers without opening a browser or database.
const sheetModule = { exports: {} }, sheetClicks = new Map(), moves = [];
let selectedCell = "E5";
const sheetSource = ts.transpileModule(readFileSync("app/games/PetWorldSheet.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
new Function("require", "exports", sheetSource)((name) => {
  if (name === "./PetSheet") return { default: ({ children, footer }) => createElement("div", null, children, footer) };
  if (name.startsWith("@/")) return loadTS(`${name.slice(2)}.ts`);
  if (name === "react") return { useState: () => [selectedCell, (id) => { selectedCell = id; }] };
  if (name === "react/jsx-runtime") {
    const runtime = require(name);
    const wrap = (fn) => (type, props, key) => {
      if (type === "button") sheetClicks.set(key ?? props.children, props.onClick);
      return fn(type, props, key);
    };
    return { ...runtime, jsx: wrap(runtime.jsx), jsxs: wrap(runtime.jsxs) };
  }
  return require(name);
}, sheetModule.exports);
const renderSheet = () => renderToStaticMarkup(createElement(sheetModule.exports.default, {
  current: "E5", visited: ["E5", "D5"], onMove: (dir) => moves.push(dir), onClose() {},
}));
const worldSheet = renderSheet();
assert.equal((worldSheet.match(/<button /g) ?? []).length,101);
assert.equal((worldSheet.match(/data-neighbor="true"/g) ?? []).length,99);
assert.ok(worldSheet.includes('aria-current="location"'));
assert.ok(worldSheet.includes("D5 도미네 집 마당, 이동, 방문함"));
sheetClicks.get("E5")(); assert.equal(moves.length,0);
sheetClicks.get("A1")(); assert.deepEqual(moves,[]);
assert.ok(renderSheet().includes("A1 · 군포산본 율곡아파트 · 아파트 단지"));
sheetClicks.get("아니요")(); assert.equal(selectedCell,"E5"); assert.deepEqual(moves,[]);
sheetClicks.get("A1")(); renderSheet(); sheetClicks.get("이동하기")(); assert.deepEqual(moves,["A1"]);
const scales = [];
for (const y of [77, 88]) {
  sceneState = { y, bowl: 110 };
  const scene = renderScene({ cellId: "A5" });
  const bowl = scene.match(/<g transform="translate\(110 ([\d.]+)\) scale\(([\d.]+)\)"[^>]*>(.*?)<\/g>/);
  assert.ok(bowl, "Feeding bowl renders at the dog's depth");
  assert.equal(Number(bowl[1]), y + 1);
  assert.ok(bowl[3].includes("/pet/art/bowl.webp"));
  assert.ok(bowl[3].includes("<ellipse"), "Bowl has a contact shadow");
  scales.push(Number(bowl[2]));
}
assert.ok(scales[1] > scales[0], "Foreground bowl is larger than distant bowl");
const churchScene = renderScene({ cellId: "E5" });
const churchBowl = churchScene.match(/translate\(110 89\) scale\(([\d.]+)\)/);
assert.ok(Number(churchBowl[1]) < scales[1], "Church props match the smaller dogs");
assert.ok(churchScene.includes('transform="translate(-19 0)"'), "Priest stays outside the dog safe zone");
sceneState = {};
for (const petId of [1, 2]) {
  const imageWidth = (map) => Number(renderScene({ cellId: map === "church" ? "E5" : "A5", petId }).match(new RegExp(`href="${PETS[petId].standing.adult}"[^>]*width="([\\d.]+)"`))[1]);
  assert.ok(Math.abs(imageWidth("church") / imageWidth("field") - 0.85) < 1e-9);
}

// Exercise mount loaders with a fake browser: no network or DB calls.
const oldWindow = globalThis.window;
const oldImage = globalThis.Image;
const oldDocument = globalThis.document;
try {
  const requested = [];
  globalThis.Image = class { set src(value) { requested.push(value); } };
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), requestIdleCallback: (cb) => { cb(); return 0; }, cancelIdleCallback() {}, clearTimeout() {} };
  for (const cell of PET_WORLD) for (const hour of [6, 12, 18, 22]) {
    sceneEffects = [];
    requested.length = 0;
    const map = petMap(cell.theme);
    const rendered = renderScene({ cellId: cell.id, hour });
    const cleanups = sceneEffects.map((effect) => effect());
    const expected = map.background ?? (map.id === "church" ? CHURCH_BACKGROUNDS : BACKGROUNDS)[backgroundAt(hour)];
    assert.ok(rendered.includes(`href="${expected}"`), "Only committed background renders");
    assert.deepEqual(requested.filter((src) => src.startsWith("/pet/bg/")), [], "No background preloading outside map preparation");
    assert.ok(!requested.some((src) => src.includes("/mine/")), "Other dog's photos are not preloaded");
    cleanups.forEach((cleanup) => cleanup?.());
  }
} finally {
  globalThis.window = oldWindow;
  globalThis.Image = oldImage;
  globalThis.document = oldDocument;
}
let total = 0;
for (const src of [...Object.values(BACKGROUNDS), ...Object.values(POSES).map((p) => p.src)]) {
  const file = new URL(`../public${src}`, import.meta.url);
  assert.equal(readFileSync(file).toString("ascii", 8, 12), "WEBP");
  const bytes = statSync(file).size;
  assert.ok(bytes <= (src.includes("/bg/") ? 150 : 60) * 1024, src);
  total += bytes;
}
assert.ok(total < 600 * 1024);

assert.equal(DEFAULT_MAP, "church");
for (const saved of ["", "invalid"]) assert.equal(petMap(saved).id, DEFAULT_MAP);
for (const map of PET_MAPS) assert.equal(petMap(map.id).id, map.id, "Remembered maps remain selected");
assert.equal(PET_MAPS.length, 24);
for (const map of PET_MAPS) {
  const actions = actionsForMap(PET_ACTIONS, map.id);
  assert.equal(actions.includes("sleep"), map.id === "home");
  assert.deepEqual(actions.filter((a) => a !== "sleep"), PET_ACTIONS);
  if (map.id === "home") assert.ok(availableActionGroups(actions).find((g) => g.category === "돌봄").actions.includes("sleep"));
}
assert.deepEqual(actionsForMap([], "home"), ["sleep"]);
assert.deepEqual(actionsForMap([], "invalid"), []);
assert.equal(petText("도미는 도미랍니다", 2), "미네는 미네랍니다");
assert.equal(poseAt("pet-sleep", "happy"), "sleep");
for (const [motion, pose] of [[null, null], ["pet-sit", "sit"], ["pet-lie", "lie"], ["pet-sleep", "sleep"]]) {
  const config = PETS[2];
  const src = pose ? config.poses[pose].src : config.standing.adult;
  const html = renderToStaticMarkup(createElement(dogModule.exports.PetDog, {
    petId: 2, stage: "adult", face: "happy", motion, light: 1, collar: "red", photos: { [src]: true },
  }));
  assert.ok(html.includes(`href="${src}"`));
  assert.ok(!html.includes("/pet/adult.webp") && !html.includes('stroke="red"'));
}

const calls = [];
let responses = [];
const rpc = async (name, args) => { calls.push({ name, args }); return responses.shift(); };
const missing = { data: null, error: { code: "PGRST202", message: "missing" } };
const success = { data: { name: "test" }, error: null };
responses = [success];
assert.equal((await petRequest(rpc, 2, "친구")).petId, 2);
assert.deepEqual(calls.pop(), { name: "domine_pet_state_for", args: { p_pet: 2, p_nickname: "친구" } });
responses = [missing, success];
const fallback = await petRequest(rpc, 2, "친구");
assert.equal(fallback.petId, 1);
assert.equal(fallback.legacy, true);
assert.equal(calls.pop().name, "domine_pet_state");
calls.length = 0;
responses = [missing];
assert.ok((await petRequest(rpc, 2, "친구", "walk")).error);
assert.equal(calls.length, 1, "Missing Mine care must never write to Domi");
assert.equal(calls[0].name, "domine_pet_care_for");
calls.length = 0;
responses = [missing, success];
assert.equal((await petRequest(rpc, 1, "친구", "walk")).legacy, true);
assert.equal(calls[1].name, "domine_pet_care");
calls.length = 0;
responses = [{ data: null, error: { code: "42501", message: "permission" } }];
assert.equal((await petRequest(rpc, 2, "친구")).legacy, false);
assert.equal(calls.length, 1, "Other failures must not trigger fallback");

const newBackgrounds = [...Object.values(CHURCH_BACKGROUNDS), ...PET_MAPS.flatMap((map) => map.background ? [map.background] : [])];
assert.ok(!existsSync(new URL("../public/pet/bg/church.webp", import.meta.url)), "Old church photo removed");
const minePhotos = [PETS[2].standing.adult, ...Object.values(PETS[2].poses).map((p) => p.src)];
const newAssets = [...newBackgrounds, PRIEST, DOGHOUSE, ...minePhotos];
const size = (src) => statSync(new URL(`../public${src}`, import.meta.url)).size;
for (const src of newAssets) {
  assert.equal(readFileSync(new URL(`../public${src}`, import.meta.url)).toString("ascii", 8, 12), "WEBP");
  assert.ok(size(src) <= (newBackgrounds.includes(src) ? 90 : src === DOGHOUSE ? 40 : 50) * 1000, src);
}
const addedBytes = newAssets.reduce((sum, src) => sum + size(src), 0);
assert.ok(addedBytes <= 600000 + 19 * 90000);
for (const bg of newBackgrounds) for (const dog of minePhotos) {
  const priest = Object.values(CHURCH_BACKGROUNDS).includes(bg) ? size(PRIEST) : 0;
  const doghouse = bg === "/pet/bg/home.webp" ? size(DOGHOUSE) : 0;
  assert.ok(size(bg) + priest + doghouse + size(dog) < 150000, "Current scene image budget");
}
assert.deepEqual(SHOPS.map((shop) => shop.name), ["술이 좋아", "맥도날드", "쁘니네", "화락"]);
const cutout = spawnSync("python", ["-c", `
import tempfile, subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
for path in Path('public/pet/bg').glob('church-*.webp'):
    assert Image.open(path).size == (1200, 600), 'Church photos keep the 2:1 composition'
with tempfile.TemporaryDirectory(prefix='pet-cut-test-') as d:
    root = Path(d)
    im = Image.new('RGB', (128,128), '#ff00ff')
    draw = ImageDraw.Draw(im)
    draw.rectangle((30,30,98,98), fill=(255,128,255))
    draw.rectangle((34,34,94,94), fill='white')
    im.save(root/'test.png')
    subprocess.run(['python','scripts/cut_sheet.py',str(root/'test.png'),d,'cut','--cols','1','--rows','1','--despill'], check=True, capture_output=True)
    subprocess.run(['python','scripts/optimize_images.py',str(root/'cut.webp'),str(root/'out'),'--kind','character'], check=True, capture_output=True)
    rgba=np.asarray(Image.open(root/'out/cut.webp').convert('RGBA')).astype(float)
    assert rgba[...,3].min()==0 and rgba[...,3].max()==255
    assert ((rgba[...,3]>40)&(rgba[...,3]<220)).any(), 'Soft fur edges preserved'
    visible=rgba[...,3]>40
    spill=np.minimum(rgba[...,0],rgba[...,2])-rgba[...,1]
    assert spill[visible].max()<35, 'No magenta fringe after cut and optimization'
`], { encoding: "utf8" });
assert.equal(cutout.status, 0, cutout.stderr);
console.log(`Maps, local actions, Mine poses, RPC fallback and new assets passed (${addedBytes} bytes).`);
console.log(`Pet photos: time boundaries, poses, feeding depth/shadows and asset budget passed (${total} bytes).`);
