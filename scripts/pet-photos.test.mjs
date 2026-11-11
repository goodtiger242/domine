import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { backgroundAt, BACKGROUNDS, poseAt, POSES, PETS, PRIEST, DOGHOUSE, petText } from "../lib/domine/pet-photos.ts";
import { PET_MAPS, petMap, neighborMap, actionsForMap, SHOPS } from "../lib/domine/pet-maps.ts";
import { petRequest } from "../lib/domine/pet-rpc.ts";
import { bubblePosition } from "../lib/domine/pet-bubble.ts";

for (const width of [318, 348, 370]) {
  const height = width * 9 / 16;
  for (const x of [0, 80, 160]) {
    for (const y of [20, 55, 89]) {
      for (const [bubbleWidth, bubbleHeight] of [[52, 28], [200, 44], [240, 60]]) {
        const p = bubblePosition(x, y, width, height, bubbleWidth, bubbleHeight);
        const left = p.left / 100 * width;
        const top = p.top / 100 * height;
        assert.ok(left >= 6 - 1e-9 && left + bubbleWidth <= width - 6 + 1e-9, "Bubble stays inside horizontal edges");
        assert.ok(top >= 6 - 1e-9 && top + bubbleHeight + 8 <= height, "Bubble and tail stay inside vertical edges");
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
const sceneSource = ts.transpileModule(readFileSync(new URL("../app/games/PetScene.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
new Function("require", "exports", sceneSource)((name) => {
  if (name === "./PetDog") return dogModule.exports;
  if (name.startsWith("@/lib/domine/")) return require(`../lib/domine/${name.split("/").pop()}.ts`);
  if (name === "react") return {
    ...require("react"),
    useState: (initial) => require("react").useState(initial?.fx ? { ...initial, ...sceneState } : initial),
  };
  return require(name);
}, sceneModule.exports);
const renderScene = (props = {}) => renderToStaticMarkup(createElement(sceneModule.exports.PetScene, {
  stage: "adult", face: "happy", light: 0.8, hour: 22, collar: "purple", cue: null, onSay() {}, bubble: "반가워요!",
  ...props,
}));
assert.ok(!renderScene().includes("/pet/art/bowl.webp"));
assert.ok(!renderScene().includes("foreignObject"));
assert.ok(renderScene().includes('aria-label="도미의 말"'));
for (const map of PET_MAPS) {
  const html = renderScene({ map: map.id, petId: 2, locked: true });
  assert.equal(html.includes('aria-label="개집"'), map.id === "home");
  assert.equal(html.includes('aria-label="맥도날드 앞으로 가기"'), map.id === "street");
  assert.ok(html.includes('aria-label="미네의 말"'));
  assert.ok(html.includes('aria-label="신부님께 인사하기" disabled=""'));
  for (const direction of [-1, 1]) assert.ok(html.includes(`aria-label="${neighborMap(map.id, direction).name}(으)로 이동" disabled=""`));
}
assert.ok(renderScene({ speaker: "priest" }).includes('aria-label="신부님의 말"'));
const scales = [];
for (const y of [77, 88]) {
  sceneState = { y, bowl: 110 };
  const scene = renderScene();
  const bowl = scene.match(/<g transform="translate\(110 ([\d.]+)\) scale\(([\d.]+)\)"[^>]*>(.*?)<\/g>/);
  assert.ok(bowl, "Feeding bowl renders at the dog's depth");
  assert.equal(Number(bowl[1]), y + 1);
  assert.ok(bowl[3].includes("/pet/art/bowl.webp"));
  assert.ok(bowl[3].includes("<ellipse"), "Bowl has a contact shadow");
  scales.push(Number(bowl[2]));
}
assert.ok(scales[1] > scales[0], "Foreground bowl is larger than distant bowl");
let total = 0;
for (const src of [...Object.values(BACKGROUNDS), ...Object.values(POSES).map((p) => p.src)]) {
  const file = new URL(`../public${src}`, import.meta.url);
  assert.equal(readFileSync(file).toString("ascii", 8, 12), "WEBP");
  const bytes = statSync(file).size;
  assert.ok(bytes <= (src.includes("/bg/") ? 150 : 60) * 1024, src);
  total += bytes;
}
assert.ok(total < 600 * 1024);

assert.equal(petMap("invalid").id, "field");
assert.deepEqual(PET_MAPS.map((map) => map.id), ["field", "church", "street", "park", "home"]);
for (const direction of [-1, 1]) {
  let map = "field";
  const visited = new Set();
  for (let i = 0; i < PET_MAPS.length; i++) {
    visited.add(map);
    const next = neighborMap(map, direction).id;
    assert.equal(neighborMap(next, -direction).id, map);
    map = next;
  }
  assert.equal(map, "field");
  assert.equal(visited.size, 5);
}
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

const newBackgrounds = PET_MAPS.flatMap((map) => map.background ? [map.background] : []);
const minePhotos = [PETS[2].standing.adult, ...Object.values(PETS[2].poses).map((p) => p.src)];
const newAssets = [...newBackgrounds, PRIEST, DOGHOUSE, ...minePhotos];
const size = (src) => statSync(new URL(`../public${src}`, import.meta.url)).size;
for (const src of newAssets) {
  assert.equal(readFileSync(new URL(`../public${src}`, import.meta.url)).toString("ascii", 8, 12), "WEBP");
  assert.ok(size(src) <= (newBackgrounds.includes(src) ? 90 : src === DOGHOUSE ? 40 : 50) * 1000, src);
}
const addedBytes = newAssets.reduce((sum, src) => sum + size(src), 0);
assert.ok(addedBytes <= 600000);
for (const bg of newBackgrounds) for (const dog of minePhotos) {
  assert.ok(size(bg) + size(PRIEST) + size(dog) < 150000, "Initial additional image budget");
}
assert.deepEqual(SHOPS.map((shop) => shop.name), ["술이 좋아", "맥도날드", "쁘니네", "화락"]);
const cutout = spawnSync("python", ["-c", `
import tempfile, subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
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
