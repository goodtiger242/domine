import assert from "node:assert/strict";
import test from "node:test";
import { loadTS } from "./pet-test-loader.mjs";

const { battleCues, rivalCues, encounterFor, DEFENSE_RESULTS } = loadTS("lib/domine/pet-battle-view.ts");
const { LINES } = loadTS("lib/domine/pet-lines.ts");
const { RIVAL_LINES, RIVAL_TONE_LINES } = loadTS("lib/domine/pet-rival-lines.ts");
const { buildFighter, createBattle, stepRound } = loadTS("lib/domine/battle/engine.ts");
const { MOVES } = loadTS("lib/domine/battle/data.ts");
const names = { player: "도미", opponent: "친구" };
const defense = { guard: "T43", counter: "T31", evade: "T19", stance: "T67" };
const bigMove = MOVES.find(m => m.mode === "charge" && !m.breaksDefense);
const multiMove = MOVES.find(m => m.mode === "multi" && !m.breaksDefense);
const action = moveId => ({ kind: "move", moveId });
const event = fields => ({ round: 1, ...fields });
const defenseResult = cues => cues.find(c => c.defenseResult && c.side === "player");
function fixture(kind, targetAction, seed = 1) {
  const state = createBattle({ seed, player: buildFighter("B001", 30), opponent: buildFighter("B001", 30) });
  state.player.moves = [defense[kind]];
  state.opponent.moves = [targetAction.moveId ?? "T01"];
  state.player.energy = state.opponent.energy = 10;
  state.opponentAction = targetAction;
  if (targetAction.moveId === bigMove.id) state.opponent.charging = bigMove.id;
  return state;
}

test("방어 4종 × 3상황 × 6문구: 고유 문구, 실전 이벤트 판정, 시드 재현·연속 반복 방지", () => {
  const all = Object.values(DEFENSE_RESULTS).flatMap(row => Object.values(row).flat());
  assert.equal(all.length, 72);
  assert.equal(new Set(all).size, 72);
  for (const [kind, rows] of Object.entries(DEFENSE_RESULTS)) {
    for (const [moment, pool] of Object.entries(rows)) {
      assert.equal(pool.length, 6);
      const targetAction = moment === "broken" ? action("K01") : moment === "failure" ? { kind: "rest" }
        : kind === "evade" ? action(bigMove.id) : action("T01");
      let sample;
      for (let seed = 1; seed <= 20 && !sample; seed++) {
        const state = fixture(kind, targetAction, seed), next = stepRound(state, action(defense[kind]));
        const cue = defenseResult(battleCues(next.events, names, { state }));
        if (cue?.playerMoment === moment) sample = { state, next };
      }
      assert.ok(sample, `${kind}:${moment} 실제 이벤트가 있어야 한다`);
      const before = structuredClone(sample), seen = new Set();
      let lastResult = "";
      for (let seed = 0; seed < 150; seed++) {
        const options = { seed, lastResult, state: sample.state };
        const cues = battleCues(sample.next.events, names, options), cue = defenseResult(cues);
        assert.deepEqual(cues, battleCues(sample.next.events, names, options));
        assert.notEqual(cue.result, lastResult);
        assert.ok(cue.result.length <= 22, cue.result);
        const base = pool.find(line => cue.result.startsWith(line));
        assert.ok(base, `${kind}:${moment}: ${cue.result}`);
        seen.add(base); lastResult = cue.result;
      }
      assert.equal(seen.size, 6, `${kind}:${moment} 모든 문구 도달`);
      assert.deepEqual(sample, before, "엔진 이벤트와 상태는 변경하지 않는다");
    }
  }
});

test("실제 기력 이득: 막기 상한·특성 회복 구별, 흘리기 연속 공격·반복 방어·바닥 기력", () => {
  const guardEvents = [
    event({ type: "action", side: "player", action: action("T43") }),
    event({ type: "hit", side: "opponent", target: "player", moveId: "T01" }),
    event({ type: "energy", side: "player", amount: 1, energy: 6, reason: "trait" }),
    event({ type: "momentum", side: "player", amount: 10, momentum: 10 }),
    event({ type: "energy", side: "player", amount: 2, energy: 8, reason: "trait" }),
  ];
  assert.match(defenseResult(battleCues(guardEvents, names)).result, /기력 \+1$/);
  guardEvents[2].amount = 0;
  assert.doesNotMatch(defenseResult(battleCues(guardEvents, names)).result, /기력/);
  assert.equal(battleCues([guardEvents[4]], names).filter(c => c.defenseResult).length, 0);
  for (const [move, amount] of [[bigMove, 2], [bigMove, 1], [multiMove, 1], [multiMove, 0]]) {
    const events = [
      event({ type: "action", side: "player", action: action("T19") }),
      event({ type: "hit", side: "opponent", target: "player", moveId: move.id }),
      event({ type: "energy", side: "opponent", amount: -amount, energy: 0, reason: "cost" }),
      event({ type: "evade", side: "player", target: "opponent" }),
    ];
    const result = defenseResult(battleCues(events, names)).result;
    if (amount) assert.ok(result.endsWith(`상대 기력 −${amount}`), result);
    else assert.doesNotMatch(result, /기력/);
    assert.doesNotMatch(result, /큰 기술|완전/, "연속 공격의 부분 흘리기를 완전 회피라 하지 않는다");
  }
});

test("이어지는 버티기 태세·상태 방어·충전 준비·깨짐·종료 순서", () => {
  const state = fixture("stance", { kind: "rest" });
  state.round = 2; state.player.defense = { kind: "stance", expires: 2, strength: 1, triggered: true };
  for (const reaction of [
    { type: "hit", side: "opponent", target: "player", moveId: "T01" },
    { type: "counter", side: "opponent", target: "player" },
    { type: "status", side: "player", status: "slow", change: "blocked" },
    { type: "break", side: "opponent", target: "player" },
  ]) {
    const events = [{ round: 2, ...reaction }, { round: 2, type: "end", outcome: "draw", reason: "limit" }];
    const cues = battleCues(events, names, { state });
    assert.equal(defenseResult(cues).playerMoment, reaction.type === "break" ? "broken" : "success");
    assert.equal(cues.at(-1).motion, "finish");
  }
  state.player.defense.expires = 1;
  assert.equal(defenseResult(battleCues([event({ type: "hit", round: 2, side: "opponent", target: "player", moveId: "T01" })], names, { state })), undefined);
  const events = [event({ type: "action", side: "player", action: action("T31") }), event({ type: "action", side: "opponent", action: { ...action(bigMove.id), phase: "prepare" } })];
  assert.equal(defenseResult(battleCues(events, names)).playerMoment, "failure");
  assert.equal(defenseResult(battleCues([...events, event({ type: "end", outcome: "quit", reason: "quit" })], names)), undefined);
});

test("우리 강아지 48줄·상대 추가 364줄: 길이·분량·중복", () => {
  const own = Object.entries(LINES).filter(([key]) => key.startsWith("battle_"));
  assert.equal(own.length, 8);
  const lines = own.flatMap(([, pool]) => { assert.equal(pool.length, 6); return pool; });
  assert.equal(new Set(lines).size, 48);
  assert.ok(lines.every(line => line.length <= 28));
  for (const [species, row] of Object.entries(RIVAL_LINES)) {
    assert.equal(row.defend.length, 8);
    assert.equal(row.guard.length, ["dog", "cat"].includes(species) ? 14 : 8);
    for (const tone of Object.values(RIVAL_TONE_LINES[species])) {
      assert.equal(tone.defend.length, 4);
      assert.equal(tone.guard.length, 2);
    }
  }
});

test("성공 대사 40%·시드 재현·직전 대사 회피·라운드 한 번·결과와 순차 표시", () => {
  let foe;
  for (let slot = 0; slot < 100 && !foe; slot++) foe = encounterFor("F5", 30, slot);
  assert.ok(foe);
  const state = fixture("guard", { kind: "rest" });
  const cues = [
    { playerMoment: "start", moveName: "마당 지키기" },
    { result: "막아 냈다!", playerMoment: "success" },
    { rivalMoment: "crit_take" },
  ];
  for (const id of [1, 2]) {
    let count = 0, last = "";
    for (let rng = 0; rng < 1000; rng++) {
      const options = { id, last }, next = { ...state, rng };
      const spoken = rivalCues(cues, foe, next, "", options);
      assert.deepEqual(spoken, rivalCues(cues, foe, next, "", options));
      assert.ok(spoken.cues.filter(c => c.playerText || c.rivalText).length <= 1);
      for (const [index, cue] of spoken.cues.entries()) {
        if (!cue.playerText && !cue.rivalText) continue;
        assert.ok(!cue.result && !cue.moveName);
        assert.equal(cue.duration, 1600);
        if (cue.playerText) {
          count++;
          assert.equal(spoken.cues[index - 1].result, "막아 냈다!");
          assert.ok(LINES[`battle_${id === 1 ? "domi" : "mine"}_success`].includes(cue.playerText));
          assert.notEqual(cue.playerText, last); last = cue.playerText;
        }
      }
    }
    assert.ok(count >= 360 && count <= 440, `${id}: ${count}/1000`);
    for (const moment of ["failure", "broken"]) {
      const seen = new Set();
      for (let rng = 0; rng < 100; rng++) {
        const spoken = rivalCues([{ playerMoment: "start" }, { playerMoment: moment }], foe, { ...state, rng }, "", { id, last: "" });
        const line = spoken.lastPlayer;
        if (line) seen.add(LINES[`battle_${id === 1 ? "domi" : "mine"}_start`].includes(line) ? "start" : moment);
      }
      assert.deepEqual([...seen].sort(), ["start", moment].sort());
    }
  }
});
