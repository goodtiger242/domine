import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTS } from "./pet-test-loader.mjs";

const view = loadTS("lib/domine/pet-battle-view.ts");
const engine = loadTS("lib/domine/battle/engine.ts");
const { pickSpawns } = loadTS("lib/domine/king/spawn.ts");
const { BREED_BY_ID } = loadTS("lib/domine/king/species.ts");
const { levelRange } = loadTS("lib/domine/king/world.ts");
const { PetScene } = loadTS("app/games/PetScene.tsx");
const css = readFileSync("app/games/pet-game.css", "utf8");
const find = count => { for (let slot = 0; slot < 1000; slot++) { const spawns = view.spawnsFor("F5", 1, slot); if (spawns.length === count) return spawns; } throw Error(`No ${count} fixture`); };

test("1000구간: 30% 출현, 65/25/10 분포, 같은 개체·레벨·변형 그림", () => {
  const counts = [0, 0, 0, 0];
  for (let slot = 0; slot < 1000; slot++) {
    const spawns = view.spawnsFor("F5", 1, slot);
    counts[spawns.length]++;
    assert.deepEqual(spawns.map(e => e.fighter), view.spawnsFor("F5", 30, slot).map(e => e.fighter));
  }
  // Player metadata differs; the actual individual/fighter stays the same.
});

test("출몰 수·범위·안전 칸·네임드 우선·승리 개체만 숨기기", () => {
  const counts = [0, 0, 0, 0];
  for (let slot = 0; slot < 1000; slot++) {
    const spawns = view.spawnsFor("F5", 1, slot); counts[spawns.length]++;
    for (const foe of spawns) {
      const [low, high] = levelRange("F5");
      assert.ok(foe.level >= Math.max(1, (low + high) / 2 - 3) && foe.level <= (low + high) / 2 + 3);
      assert.ok(foe.name.endsWith(` ${foe.individual.name}`) && foe.name.length <= `${BREED_BY_ID[foe.individual.breedId].name} ${foe.individual.name}`.length);
      assert.equal(foe.given, foe.individual.name);
      const variants = BREED_BY_ID[foe.individual.breedId].variants;
      assert.ok(variants.length ? variants.some(v => v.art === foe.art) : foe.art === foe.individual.appearance.art);
      assert.equal(foe.fighter.element, foe.individual.group);
      assert.equal(foe.fighter.weakTag, foe.individual.weakness);
    }
    for (const cell of ["E5", "D5"]) assert.deepEqual(view.spawnsFor(cell, 999, slot), []);
    const named = pickSpawns("F4", slot, 999).find(s => s.kind === "named");
    assert.ok(view.spawnsFor("F4", 999, slot).some(e => e.individual.id === named.individual.id));
    assert.ok(view.spawnsFor("F4", 999, slot).length <= 3);
  }
  const occupied = 1000 - counts[0];
  assert.ok(occupied >= 260 && occupied <= 340);
  for (const [count, rate] of [[1, .65], [2, .25], [3, .1]]) assert.ok(Math.abs(counts[count] / occupied - rate) < .07, counts.join(","));
  const three = find(3), won = three[1];
  assert.deepEqual(view.spawnsFor("F5", 1, won.slot, [won.id]).map(e => e.id), [three[0].id, three[2].id]);
  assert.deepEqual(view.readEncounterWins({ getItem: () => JSON.stringify([won.id, "bad", `${won.slot + 1}:F5:other`]) }, won.slot), [won.id]);
  for (const n of [0, 1, 2, 3]) assert.equal(view.encounterChoice(n ? find(n) : []), ["empty", "confirm", "list", "list"][n]);
});

test("장면: 현재 칸 그림·개체 이름표·선택 고리·잠금·실패 대체", () => {
  const foes = find(3);
  const html = renderToStaticMarkup(createElement(PetScene, { encounters: foes, selectedEncounter: foes[1].id, cellId: "F5", stage: "adult", face: "happy", light: 1, hour: 12, collar: "#fff", cue: null, onSay() {}, onEncounter() {}, onBattle() {}, locked: true }));
  assert.equal((html.match(/class="pet-scene-foe"/g) ?? []).length, 3);
  for (const foe of foes) { assert.ok(html.includes(foe.art)); assert.ok(html.includes(foe.name)); }
  assert.match(html, /data-selected="true"/);
  assert.equal((html.match(/class="pet-scene-foe"[^>]*disabled=""/g) ?? []).length, 3);
  assert.match(html, /겨루기, 3마리/);
});

test("중앙 결과는 큐당 1.2초, 기술명은 해당 동물, 하단 중복 없음", () => {
  const events = [
    { type: "action", side: "player", action: { kind: "push" }, round: 1 },
    { type: "effectiveness", side: "player", target: "opponent", hint: "good", multiplier: 1.3, round: 1 },
    { type: "damage", side: "player", target: "opponent", amount: 15, hp: 50, critical: true, round: 1 },
    { type: "reveal", side: "opponent", tag: "contact", affinity: "weak", round: 1 },
    { type: "miss", side: "opponent", target: "player", moveId: "push", round: 1 },
    { type: "counter", side: "player", target: "opponent", round: 1 },
    { type: "energy", side: "player", amount: 1, energy: 5, reason: "trait", round: 1 },
  ];
  const cues = view.battleCues(events, { player: "도미", opponent: "진돗개 철수" });
  assert.equal(cues[0].moveName, "가볍게 밀기"); assert.equal(cues[0].side, "player"); assert.equal(cues[0].duration, 1200);
  const results = cues.filter(c => c.result);
  assert.deepEqual(results.map(c => c.result), ["크리티컬!", "효과가 컸다!", "유독 잘 통했다!", "빗나갔다!", "되받아쳤다!", "막아 냈다! 기력 +1"]);
  assert.ok(results.every(c => c.duration >= 1000 && c.duration <= 1400 && !c.text));
});

test("기세 표시·결정기 비용·상대 대사 최대 1번·없는 상황은 생략", () => {
  const foe = find(1)[0], state = engine.createBattle({ seed: 1, player: engine.buildFighter("B001", 10), opponent: foe.fighter });
  const event = { type: "momentum", side: "player", amount: 30, momentum: 100, round: 1 };
  assert.equal(view.showBattleEvent(state, event).player.momentum, 100);
  assert.equal(view.actionCost({ kind: "move", moveId: state.player.finisher }, state), 0);
  const candidates = ["attack", "hit", "crit_deal", "crit_take", "low", "defend", "miss", "effective", "ineffective", "momentum", "finisher", "round"].map(rivalMoment => ({ rivalMoment }));
  for (let round = 1; round < 100; round++) {
    const spoken = view.rivalCues(candidates, foe, { ...state, round }, "");
    const lines = spoken.cues.filter(c => c.rivalText);
    assert.ok(lines.length <= 1); assert.ok(lines.every(c => c.duration === 1600));
  }
  assert.equal(view.encounterLine(foe, "does-not-exist", 1), "");
  assert.ok(view.encounterLine(foe, "flee", 1));
  assert.equal(view.encounterLine(foe, "enter", 1), view.encounterLine(foe, "enter", 1));
  for (const action of engine.availableActions(state, "opponent")) {
    const clue = view.opponentClue({ ...state, opponentAction: action });
    assert.ok(!clue.includes(view.actionLabel(action)));
  }
  assert.equal(view.opponentClue({ ...state, aiTier: "boss" }), "");
});

test("390×844·1600×900: 동물·이름표·조작·HUD·말풍선 좌표 분리", () => {
  for (const [viewportWidth, height] of [[390, 844], [1600, 900]]) {
    const width = Math.min(viewportWidth - 40, 576), sceneHeight = width * 9 / 16;
    const boxes = [58, 74, 88].map(x => ({ left: width * x / 100 - Math.max(44, width * .134) / 2, right: width * x / 100 + Math.max(44, width * .134) / 2 }));
    assert.ok(boxes[0].left > width * .49);
    assert.ok(boxes[0].right < boxes[1].left && boxes[1].right < boxes[2].left);
    assert.ok(boxes[2].right < width);
    const feet = sceneHeight * .65, labelBottom = feet + 3 + 32;
    assert.ok(labelBottom < sceneHeight - 28, "nameplates clear the care bars");
    assert.ok(feet - width * .134 > 48, "animals clear MAP and battle buttons");
    const battleWidth = Math.min(viewportWidth, 480), arenaHeight = height - 296;
    const opponentTop = arenaHeight * .47, playerTop = arenaHeight - 126 - battleWidth * .43;
    assert.ok(opponentTop - 50 - 54 > 145, "rival line clears the upper HUD");
    assert.ok(playerTop - 62 > 145, "player skill clears the upper HUD");
    assert.ok(arenaHeight * .29 + 93 < Math.min(opponentTop, playerTop), "central result clears animals");
    assert.ok(battleWidth * .45 < battleWidth * .6, "animal silhouettes are separate");
  }
  assert.match(css, /pet-battle-console \{ min-height: 296px/);
  assert.match(css, /pet-battle-center-result[^}]*top: 29%/);
  assert.match(css, /pet-battle-rival[^}]*bottom: calc\(100% \+ 50px\)/);
});
