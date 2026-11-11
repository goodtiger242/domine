import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { loadTS } from "./pet-test-loader.mjs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { PET_FX_SHEETS } = loadTS("lib/domine/pet-fx-sheets.ts");
const { BATTLE_MOVE_FX, battleMoveFx, battleAssets, moveImage, fxSheets } = loadTS("lib/domine/pet-battle-fx.ts");
const { MOVE_BY_ID } = loadTS("lib/domine/battle/data.ts");
const { MAX_ROUNDS } = loadTS("lib/domine/battle/rules.ts");

test("전체 기술은 존재하는 그림만 요청하고 기존 26개 그림을 유지", () => {
  for (let i = 1; i <= 67; i++) {
    const id = `T${String(i).padStart(2, "0")}`;
    assert.equal(moveImage(id), existsSync(`public/pet/battle/move/${id.toLowerCase()}.webp`) ? `/pet/battle/move/${id.toLowerCase()}.webp` : undefined);
  }
  for (const id of ["push", "rest", ...Object.keys(MOVE_BY_ID)]) {
    assert.equal(BATTLE_MOVE_FX[id].image, moveImage(id));
    if (moveImage(id)) assert.ok(existsSync(`public${moveImage(id)}`));
  }
  for (const path of battleAssets(Object.keys(MOVE_BY_ID))) assert.ok(existsSync(`public${path}`), path);
});

test("장착 기술만 사전 로드, 모든 기술은 1~2개 시트와 자동 연출을 가진다", () => {
  const paths = battleAssets(["T01", "T43", "T01"]);
  assert.equal(paths.length, new Set(paths).size);
  assert.ok(paths.includes(moveImage("T01")));
  assert.ok(!paths.includes(moveImage("T60")));
  for (const [id, fx] of Object.entries(BATTLE_MOVE_FX)) {
    assert.ok(fx.sheets.length >= 1 && fx.sheets.length <= 2, id);
    for (const sheet of fx.sheets) assert.ok(PET_FX_SHEETS.some(s => s.id === sheet.id));
  }
  assert.equal(battleMoveFx("C01").sheets[0].category, "charge");
  assert.equal(battleMoveFx("C03").sheets[1].category, "slash");
  assert.equal(battleMoveFx("T60").sheets[0].category, "heal");
  for (const id of ["T19", "T21", "T43", "T67"]) assert.equal(battleMoveFx(id).sheets[0].category, "shield");
  assert.equal(battleMoveFx("unknown").motion, BATTLE_MOVE_FX.push.motion);
});

test("80종 이상, 장당 60KB·총 4MB 이하, 모든 시트가 연출에서 도달 가능", () => {
  assert.ok(PET_FX_SHEETS.length >= 80);
  const counts = {};
  let total = 0;
  for (const sheet of PET_FX_SHEETS) {
    const bytes = statSync(`public${sheet.path}`).size;
    assert.ok(bytes <= 60_000, sheet.id); total += bytes;
    assert.ok(sheet.frames >= 2 && sheet.frames <= 16, sheet.id);
    assert.equal(sheet.size, 128);
    assert.ok(["normal", "screen"].includes(sheet.blend));
    counts[sheet.category] = (counts[sheet.category] ?? 0) + 1;
  }
  assert.ok(total <= 4_000_000);
  assert.ok(counts.impact >= 25 && counts.slash >= 15);
  assert.ok(["water", "nature", "light", "arcane", "fire", "lightning"].reduce((n, c) => n + counts[c], 0) >= 20);
  assert.ok(["heal", "buff", "shield", "debuff"].reduce((n, c) => n + counts[c], 0) >= 10);
  assert.ok(["particle", "charge", "smoke"].reduce((n, c) => n + counts[c], 0) >= 10);
  const reachable = new Set();
  for (let variation = 0; variation < MAX_ROUNDS; variation++) {
    for (const id of Object.keys(BATTLE_MOVE_FX)) for (const s of battleMoveFx(id, variation).sheets) reachable.add(s.id);
    for (const category of ["impact", "particle", "heal", "buff", "shield", "debuff", "smoke"]) reachable.add(fxSheets(category, variation).id);
  }
  assert.deepEqual(PET_FX_SHEETS.filter(s => !reachable.has(s.id)), []);
});

test("스프라이트: 준비된 그림만 재생, 늦거나 실패한 그림은 기존 연출 유지", t => {
  const { FxSprite } = loadTS("app/games/PetBattleSheet.tsx");
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const images = [];
  class FakeImage { complete = false; naturalWidth = 0; constructor() { images.push(this); } }
  Object.defineProperty(globalThis, "window", { value: { Image: FakeImage }, configurable: true });
  t.after(() => original ? Object.defineProperty(globalThis, "window", original) : delete globalThis.window);
  const sheet = PET_FX_SHEETS[0];
  const render = reduced => renderToStaticMarkup(createElement(FxSprite, { sheet, reduced }));
  assert.equal(render(false), "");
  images[0].complete = true;
  assert.equal(render(false), "", "failed image has no natural width");
  images[0].naturalWidth = sheet.frames * 128;
  assert.match(render(false), /pet-fx-sprite/);
  assert.match(render(true), /--sprite-time:300ms/);
  assert.equal(images.length, 1, "cached per asset, not per render");
});

test("변환 결과 프레임 크기·알파, 단일 입자는 확대·페이드, PNG 프레임 정렬", () => {
  execFileSync("python", ["-c", `
import json, sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, 'scripts')
from build_fx_sheets import frames_for, make_sheet
rows = json.loads(sys.stdin.read())
for row in rows:
    with Image.open('public' + row['path']) as im:
        assert im.size == (128 * row['frames'], 128), row['id']
        assert im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] == 0, row['id']
root = Path('../domine-ref/free')
if root.exists():
    packs = json.loads((root / 'manifest.json').read_text(encoding='utf-8-sig'))
    for slug in ['particle-pack-80-sprites', '2d-spell-effects']:
        pack = next(p for p in packs if p['slug'] == slug)
        effect = next(e for e in pack['effects'] if e['kind'] == 'frames')
        frames = frames_for(root, pack, effect)
        assert len(frames) > 1
        sheet = make_sheet(frames, min(16, len(frames)))
        assert sheet.height == 128
        if slug == 'particle-pack-80-sprites':
            assert frames[0].getchannel('A').getextrema()[1] > frames[-1].getchannel('A').getextrema()[1]
`], { input: JSON.stringify(PET_FX_SHEETS), stdio: ["pipe", "pipe", "pipe"] });
  const credits = readFileSync("docs/pet-credits.md", "utf8");
  for (const pack of new Set(PET_FX_SHEETS.map(s => s.pack))) assert.ok(credits.split("\n").some(line => line.includes(`/${pack} | 사용 |`)), pack);
});
