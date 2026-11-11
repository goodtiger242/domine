import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { backgroundAt, BACKGROUNDS, poseAt, POSES } from "../lib/domine/pet-photos.ts";

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
const dogModule = { exports: {} };
const dogSource = ts.transpileModule(readFileSync(new URL("../app/games/PetDog.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
new Function("require", "exports", dogSource)(
  (name) => name === "@/lib/domine/pet-photos" ? { POSES, poseAt } : require(name), dogModule.exports,
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
const renderScene = () => renderToStaticMarkup(createElement(sceneModule.exports.PetScene, {
  stage: "adult", face: "happy", light: 0.8, hour: 22, collar: "purple", cue: null, onSay() {},
}));
assert.ok(!renderScene().includes("/pet/art/bowl.webp"));
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
console.log(`Pet photos: time boundaries, poses, feeding depth/shadows and asset budget passed (${total} bytes).`);
