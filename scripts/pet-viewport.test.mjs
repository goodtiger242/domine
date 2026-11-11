import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const css = postcss.parse(readFileSync("app/games/pet-game.css", "utf8"));
// Static cascade/geometry regression only; this does not replace browser screenshots.
function style(selectors, width, height) {
  const values = {}, ranks = {};
  css.walkRules(rule => {
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type !== "atrule") continue;
      if (parent.name !== "media") return;
      if (/prefers-/.test(parent.params)) return;
      for (const [, limit, axis, size] of parent.params.matchAll(/(min|max)-(width|height):\s*(\d+)px/g)) {
        const actual = axis === "width" ? width : height;
        if (limit === "min" ? actual < Number(size) : actual > Number(size)) return;
      }
    }
    for (const selector of rule.selectors) {
      if (!selectors.includes(selector)) continue;
      const specificity = (selector.match(/\.|\[/g) ?? []).length;
      rule.walkDecls(decl => {
        const rank = specificity + (decl.important ? 100 : 0);
        if (rank < (ranks[decl.prop] ?? -1)) return;
        ranks[decl.prop] = rank; values[decl.prop] = decl.value;
      });
    }
  });
  return values;
}
const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
for (const [width, height] of [[360, 640], [390, 844], [1600, 900], [844, 390]]) {
  test(`${width}×${height}: static 44px scene targets stay inside, with no shared hit area`, () => {
    const sceneWidth = Math.min(width - (width >= 1024 ? 96 : width >= 768 ? 80 : 40), 576);
    const sceneHeight = sceneWidth * 9 / 16;
    for (const occupied of [false, true]) {
      const boxes = ["map-button", "battle-encounter", "move-toggle"].map(name => {
        const selectors = [`.pet-${name}`, `.pet-scene .pet-${name}`, ...(occupied ? [`.pet-scene[data-occupied=true] .pet-${name}`] : [])];
        const button = style(selectors, width, height);
        const target = style(selectors.map(selector => `${selector}::after`), width, height);
        const targetWidth = parseFloat(target.width), targetHeight = parseFloat(target.height);
        assert.ok(targetWidth >= 44 && targetHeight >= 44, name);
        const x = sceneWidth - parseFloat(button.right) - parseFloat(button.width) / 2;
        const y = parseFloat(button.top) + parseFloat(button.height) / 2;
        return { left: x - targetWidth / 2, right: x + targetWidth / 2, top: y - targetHeight / 2, bottom: y + targetHeight / 2 };
      });
      for (const box of boxes) {
        assert.ok(box.left >= 0 && box.right <= sceneWidth && box.top >= 0 && box.bottom <= sceneHeight);
        for (const other of boxes) if (other !== box) assert.equal(overlap(box, other), false);
      }
      const directions = [
        { x: sceneWidth / 2, y: parseFloat(style([".pet-direction-n"], width, height).top) + 17 },
        { x: sceneWidth / 2, y: sceneHeight - 26 },
        { x: sceneWidth - 26, y: sceneHeight / 2 },
        { x: 26, y: sceneHeight / 2 },
      ].map(({ x, y }) => ({ left: x - 22, right: x + 22, top: y - 22, bottom: y + 22 }));
      for (const box of directions) for (const other of [...boxes, ...directions]) if (box !== other) assert.equal(overlap(box, other), false, "move controls overlap");
    }
    const scene = style([".pet-battle-scene"], width, height);
    if (height <= 700) assert.equal(scene["grid-template-rows"].includes("430px"), false);
    if (width >= 600 && height <= 500) assert.match(scene["grid-template-columns"], /minmax\(280px, 1fr\)/);
    const menu = style(['.pet-battle-actions[data-menu=moves]'], width, height);
    assert.equal(menu["grid-template-rows"], "auto auto auto", "44px tabs must not sit in a 28px row");
  });
}
