import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { loadTS } from "./pet-test-loader.mjs";

const { createBattle, stepRound, availableActions, buildFighter, opponentFor } = loadTS("lib/domine/battle/engine.ts");
const { BREEDS, MOVES, ITEMS, GROWTH, MOVE_BY_ID, PUSH } = loadTS("lib/domine/battle/data.ts");
const { matchup, sizeMultiplier, temperamentBonus, damageAt, previewDamage, effectHint, effectiveStat, hitChance, statusChance, recoveryLeft, moveFor } = loadTS("lib/domine/battle/rules.ts");
const { chooseOpponentAction } = loadTS("lib/domine/battle/ai.ts");
const { random } = loadTS("lib/domine/battle/rng.ts");
const { THEME_POOLS } = loadTS("lib/domine/battle/opponents.ts");
const { PET_WORLD } = loadTS("lib/domine/pet-world.ts");
const move = moveId => ({ kind: "move", moveId });
const rest = { kind: "rest" };
const make = (player = "B001", opponent = "B002", level = 10, seed = 27) => createBattle({ seed, player: buildFighter(player,level), opponent: buildFighter(opponent,level) });
function freeze(value) { Object.freeze(value); for (const child of Object.values(value)) if (child && typeof child === "object" && !Object.isFrozen(child)) freeze(child); return value; }
function quiet(state) { state.opponentAction = rest; return state; }

test("12종·24기술·8아이템과 학습/성장/슬롯 무결성", () => {
  assert.equal(BREEDS.length,12); assert.equal(MOVES.length,24); assert.equal(ITEMS.length,8);
  for (const list of [BREEDS,MOVES,ITEMS]) {
    assert.equal(new Set(list.map(v => v.id)).size,list.length);
    assert.equal(new Set(list.map(v => v.name)).size,list.length);
  }
  assert.equal(new Set(BREEDS.map(b => b.group)).size,6);
  assert.equal(new Set(BREEDS.map(b => b.size)).size,3);
  assert.equal(new Set(BREEDS.map(b => b.temperament)).size,4);
  for (const breed of BREEDS) {
    assert.equal(breed.learn.length,6);
    assert.equal(new Set(breed.learn.map(l => l.move)).size,6);
    assert.deepEqual(breed.learn.map(l => l.level),[1,1,5,10,18,26]);
    assert.equal(MOVE_BY_ID[breed.learn[0].move].kind,"attack");
    assert.equal(MOVE_BY_ID[breed.learn[1].move].kind,"defense");
    for (const entry of breed.learn) assert.ok(MOVE_BY_ID[entry.move]);
    for (const level of [1,10,20,21,30]) {
      const fighter = buildFighter(breed.id,level,[]);
      assert.ok(Object.values(fighter.stats).every(s => Number.isInteger(s) && s > 0));
      const q = Math.min(level-1,19)+.8*Math.max(level-20,0);
      for (const key of Object.keys(breed.base)) assert.equal(fighter.stats[key],breed.base[key]+Math.floor(GROWTH[breed.growth][key]*q));
    }
  }
  assert.deepEqual(new Set(BREEDS.flatMap(b => b.learn.map(l => l.move))),new Set(MOVES.map(m => m.id)));
  assert.ok(ITEMS.filter(i => i.slot === "bag").length <= 2);
  for (const item of ITEMS) for (const [stat,rate] of Object.entries(item.rates ?? {})) assert.ok(rate > 0 && rate <= (stat === "hp" ? .1 : .08));
  for (const item of ITEMS.filter(i => i.slot === "bag")) assert.ok(item.energy > 0 && item.energy <= 10 || item.heal > 0 && item.heal <= .25);
  const plain = buildFighter("B001",10), equipped = buildFighter("B001",10,["I04","I08","I13"]);
  assert.equal(equipped.stats.attack,plain.stats.attack+Math.max(1,Math.floor(plain.stats.attack*.07)));
  assert.equal(equipped.stats.hp,plain.stats.hp+Math.max(1,Math.floor(plain.stats.hp*.06)));
});

test("입력 경계: 견종·레벨·기술·장비·시드 검증", () => {
  for (const level of [0,31,1.5,NaN,Infinity]) assert.throws(() => buildFighter("B001",level));
  assert.throws(() => buildFighter("unknown",10));
  for (const gear of [["I01","I02"],["I19"],["missing"]]) assert.throws(() => buildFighter("B001",10,gear));
  for (const moves of [[],["T01","T01"],["T60"],["bad"]]) assert.throws(() => buildFighter("B001",1,[],{ moves }));
  assert.throws(() => buildFighter("B001",10,[],{ consumable: "I01" }));
  const state = make();
  assert.throws(() => createBattle({ seed: NaN, player: state.player, opponent: state.opponent }));
  assert.throws(() => createBattle({ seed: 1, player: state.player, opponent: state.opponent, startEnergyBonus: 2 }));
  assert.throws(() => createBattle({ seed: 1, player: { ...state.player, stats: { ...state.player.stats, hp: Infinity } }, opponent: state.opponent }));
  assert.throws(() => stepRound(state,move("bad")));
  assert.throws(() => stepRound(state,{ kind: "item", itemId: "I19" }));
  state.player.energy = 0;
  assert.throws(() => stepRound(state,move("T01")));
});

test("결정성과 깊은 불변성, 예고한 행동 유지", () => {
  const play = () => {
    let state = make(); const events = [];
    while (!state.outcome) {
      const before = structuredClone(state), forecast = state.opponentAction;
      const result = stepRound(freeze(state),greedy(state));
      assert.deepEqual(state,before);
      const declared = result.events.find(e => e.type === "action" && e.side === "opponent");
      if (declared) assert.deepEqual(declared.action,forecast);
      state = result.state; events.push(...result.events);
    }
    return { state, events };
  };
  assert.deepEqual(play(),play());
  const input = freeze(buildFighter("B001",10));
  const result = createBattle({ seed: 0, player: input, opponent: input });
  result.player.stats.hp++;
  assert.equal(input.stats.hp,buildFighter("B001",10).stats.hp);
  assert.notEqual(random(0).seed,0);
});

test("상성 36칸·체급·기질 전체 행렬과 피해/명중/상태 수식", () => {
  const groups = ["rush","trick","track","guard","bond","endure"];
  const expected = [[1,1.3,1,.75,1,.75],[1,1,.75,1.3,.75,1.3],[1.3,1.3,1,1,.75,.75],[1.3,.75,1,1,1.3,1],[.75,1,1.3,.75,1,1.3],[1,.75,1.3,1.3,1,1]];
  groups.forEach((a,i) => groups.forEach((d,j) => assert.equal(matchup(a,d),expected[i][j])));
  const sizes = ["small","medium","large"], sizeTable = [[1,1.03,1.05],[.97,1,1.03],[.95,.97,1]];
  sizes.forEach((a,i) => sizes.forEach((d,j) => { assert.equal(sizeMultiplier("rush",a,d),sizeTable[i][j]); assert.equal(sizeMultiplier("track",a,d),1); assert.equal(sizeMultiplier("bond",a,d),1); }));
  const temps = ["lively","careful","kind","steady"], tempTable = [[0,-5,5,0],[5,0,0,-5],[0,5,0,-5],[-5,0,5,0]];
  temps.forEach((a,i) => temps.forEach((d,j) => assert.equal(temperamentBonus(a,d),tempTable[i][j])));
  const state = make("B001","B001"), attack = MOVE_BY_ID.T03;
  assert.equal(damageAt(attack,state.player,state.opponent,1),Math.floor((attack.power*1.5+.45*state.player.stats.attack)*40/(40+state.opponent.stats.defense)));
  for (const m of MOVES) {
    const preview = previewDamage(m,state.player,state.opponent);
    for (const r of [.95,1,1.05]) assert.ok(damageAt(m,state.player,state.opponent,r) >= preview.min && damageAt(m,state.player,state.opponent,r) <= preview.max);
  }
  assert.equal(effectHint(MOVE_BY_ID.T25,state.player,buildFighter("B002",10)),"good");
  assert.equal(effectHint(MOVE_BY_ID.T01,state.player,buildFighter("B004",10)),"weak");
  assert.equal(effectHint(MOVE_BY_ID.T43,state.player,state.opponent),"normal");
  state.player.statuses = [{ id: "blur", applied: 1, expires: 2 }];
  assert.equal(hitChance(PUSH,state.player,state.opponent),Math.round(Math.max(70,Math.min(99,95+.3*(state.player.stats.focus-state.opponent.stats.speed)-10))*10)/10);
  assert.equal(statusChance(MOVE_BY_ID.T16,state.player,state.opponent),Math.max(10,Math.min(65,25+.4*(state.player.stats.focus-state.opponent.stats.calm))));
  state.player.buffs = [{ stat: "attack", expires: 2 }]; state.player.statuses = [{ id: "stagger", applied: 1, expires: 2 }];
  assert.equal(effectiveStat(state.player,"attack"),Math.floor(state.player.stats.attack*1.15*.85));
});

test("기력 시작 6/7·최대 10·숨 고르기 +4·종료 +2·숨참 만료", () => {
  const state = quiet(make());
  assert.equal(state.player.energy,6); assert.equal(state.opponent.energy,6);
  assert.equal(createBattle({ seed: 1, player: state.player, opponent: state.opponent, startEnergyBonus: 1 }).player.energy,7);
  state.player.energy = 0;
  let result = stepRound(state,rest);
  assert.equal(result.state.player.energy,6);
  result = stepRound(quiet(result.state),rest); assert.equal(result.state.player.energy,10);
  state.player.statuses = [{ id: "winded", applied: 1, expires: 2 }];
  result = stepRound(state,rest); assert.equal(result.state.player.energy,5);
  result.state.player.energy = 0;
  result = stepRound(quiet(result.state),rest); assert.equal(result.state.player.energy,6);
  assert.ok(result.events.some(e => e.type === "status" && e.change === "removed"));
});

test("회복 총량 25%·실손실 제한·소모품 1회·매 판 초기화", () => {
  let state = createBattle({ seed: 2, player: buildFighter("B001",18,[],{ moves: ["T60"], consumable: "I21" }), opponent: buildFighter("B001",18) });
  const max = state.player.stats.hp;
  state.player.hp = 1; state.player.energy = 10;
  state = stepRound(quiet(state),move("T60")).state;
  state = stepRound(quiet(state),{ kind: "item", itemId: "I21" }).state;
  state = stepRound(quiet(state),move("T60")).state;
  assert.equal(state.player.healed,Math.floor(max*.25));
  assert.equal(state.player.hp,1+Math.floor(max*.25));
  assert.equal(recoveryLeft(state.player),0);
  assert.ok(!availableActions(state,"player").some(a => a.kind === "item" || a.moveId === "T60"));
  const fresh = createBattle({ seed: 2, player: state.player, opponent: state.opponent });
  assert.equal(fresh.player.hp,max); assert.equal(fresh.player.energy,6); assert.equal(fresh.player.healed,0); assert.equal(fresh.player.itemUsed,false);
  fresh.player.hp--;
  const healed = stepRound(quiet(fresh),move("T60")).state;
  assert.equal(healed.player.healed,1); assert.equal(healed.player.hp,max);
});

test("12라운드 HP 비율 판정: 5%p 포함 경계와 그만하기", () => {
  for (const [p,o,expected] of [[100,95,"draw"],[100,94,"player"],[94,100,"opponent"]]) {
    let state = make(); state.player.stats.hp = 100; state.opponent.stats.hp = 100;
    state.player.hp = p; state.opponent.hp = o;
    for (let round = 1; round <= 12; round++) {
      assert.equal(state.round,round); state = stepRound(quiet(state),rest).state;
      if (round < 12) assert.equal(state.outcome,undefined);
    }
    assert.equal(state.outcome,expected); assert.deepEqual(availableActions(state,"player"),[]);
    assert.throws(() => stepRound(state,rest));
  }
  const quit = stepRound(make(),{ kind: "quit" });
  assert.equal(quit.state.outcome,"quit"); assert.equal(quit.events.filter(e => e.type === "action").length,1);
});

test("실행한 행동만 기력 차감·빗나감·방어막 지속/소비·연속 방어", () => {
  let state = quiet(make());
  let result = stepRound(state,move("T43"));
  assert.equal(result.state.player.shield.multiplier,.65);
  result = stepRound(quiet(result.state),move("T43")); assert.equal(result.state.player.shield.multiplier,.85);
  result = stepRound(quiet(result.state),rest); assert.equal(result.state.player.shield,undefined);
  let missed = false, hit = false, ended = false;
  for (let seed = 0; seed < 150 && !(missed && hit && ended); seed++) {
    state = quiet(make("B001","B001",10,seed));
    state.opponent.shield = { multiplier: .65, expires: 2 };
    result = stepRound(state,move("T01"));
    if (result.events.some(e => e.type === "miss")) {
      missed = true; assert.ok(result.state.opponent.shield); assert.equal(result.state.player.energy,6);
      assert.ok(!result.events.some(e => e.type === "damage"));
    } else { hit = true; assert.equal(result.state.opponent.shield,undefined); }
    state = make("B002","B001",10,seed); state.opponent.hp = 1; state.opponentAction = move("T01");
    result = stepRound(state,move("T13"));
    if (result.state.outcome === "player") {
      ended = true; assert.equal(result.state.opponent.energy,6);
      assert.equal(result.events.filter(e => e.type === "action").length,1);
    }
  }
  assert.ok(missed && hit && ended);
});

test("상태 최대 2개·오래된 상태 교체·갱신·면역과 견종 특성", () => {
  let applied = false;
  for (let seed = 0; seed < 100 && !applied; seed++) {
    const state = quiet(make("B018","B018",10,seed));
    state.opponent.traitUsed = true;
    state.opponent.statuses = [{ id: "blur", applied: 0, expires: 2 },{ id: "tense", applied: 1, expires: 2 }];
    const result = stepRound(state,move("T16"));
    if (result.events.some(e => e.type === "status" && e.status === "open")) {
      applied = true;
      assert.deepEqual(result.state.opponent.statuses.map(s => s.id),["tense","open"]);
      const immune = structuredClone(state); immune.opponent.traitUsed = false;
      const blocked = stepRound(immune,move("T16"));
      assert.ok(blocked.events.some(e => e.type === "status" && e.change === "blocked"));
      assert.ok(blocked.state.opponent.traitUsed);
      const refresh = structuredClone(state); refresh.opponent.statuses = [{ id: "open", applied: 0, expires: 1 }];
      const refreshed = stepRound(refresh,move("T16"));
      assert.equal(refreshed.state.opponent.statuses.length,1); assert.equal(refreshed.state.opponent.statuses[0].expires,2);
    }
  }
  assert.ok(applied);
  let state = quiet(make("B007","B001"));
  state = stepRound(state,move("T34")).state;
  assert.equal(state.player.buffs[0].expires,3);
  state = quiet(make("B005","B001")); state.round = 3; state.player.energy = 0;
  assert.equal(stepRound(state,rest).state.player.energy,8);
  state = make("B002","B001");
  assert.equal(effectiveStat(state.player,"speed",1),Math.floor(state.player.stats.speed*1.05));
  assert.equal(effectiveStat(state.player,"speed",3),state.player.stats.speed);
  state = make("B001","B001"); state.player.rested = true;
  const boosted = damageAt(PUSH,state.player,state.opponent,1); state.player.rested = false;
  assert.ok(boosted > damageAt(PUSH,state.player,state.opponent,1));
});

test("지도 모든 칸·날짜 재현·체비쇼프 거리·고정 지역 레벨·장비 공개", () => {
  const before = structuredClone(PET_WORLD);
  assert.equal(opponentFor("E5",3,10).distance,0); assert.equal(opponentFor("E5",3,10).fighter.level,1);
  assert.equal(opponentFor("J10",3,10).distance,5); assert.equal(opponentFor("J10",3,10).fighter.level,11);
  for (const cell of PET_WORLD) {
    const first = opponentFor(cell.id,123,10);
    assert.deepEqual(first,opponentFor(cell.id,123,10));
    assert.ok(THEME_POOLS[cell.theme].includes(first.fighter.breedId));
    assert.equal(first.fighter.level,1+2*first.distance);
    assert.deepEqual(first.fighter,opponentFor(cell.id,123,30).fighter);
    assert.ok(first.npc.name && first.npc.title);
  }
  assert.deepEqual(PET_WORLD,before);
  assert.equal(new Set(Object.values(THEME_POOLS).flat()).size,12);
  assert.throws(() => opponentFor("Z99",1,10));
  assert.throws(() => opponentFor("E5",NaN,10));
  const state = make(); state.opponent.energy = 0;
  assert.deepEqual(chooseOpponentAction(state).action,rest);
  state.difficulty = "hard";
  assert.deepEqual(chooseOpponentAction(state),chooseOpponentAction(state));
});

test("첫 피해/첫 공격/지속 특성과 라운드 시작 행동 순서", () => {
  for (const [id,moveId,rate] of [["B003","T25",1.08],["B009","T50",1.08],["B015","T03",1.08]]) {
    const state = make(id,"B001"); const m = MOVE_BY_ID[moveId];
    const before = damageAt(m,state.player,state.opponent,1);
    state.player.traitUsed = true;
    const after = damageAt(m,state.player,state.opponent,1);
    assert.ok(Math.abs(before-after*rate) < 2);
    assert.ok(before > after);
  }
  const state = make("B017","B004");
  const m = MOVE_BY_ID.T25;
  const expected = (m.power*1.5+.45*state.player.stats.focus)*40/(40+state.opponent.stats.defense)*1.04*.92;
  assert.equal(damageAt(m,state.player,state.opponent,1),Math.floor(expected));
  state.opponent.traitUsed = true;
  assert.equal(damageAt(m,state.player,state.opponent,1),Math.floor(expected/.92));
  const same = make("B001","B001"); same.opponentAction = move("T01");
  const firstSides = new Set();
  for (let seed = 0; seed < 30; seed++) { same.rng = seed; firstSides.add(stepRound(same,move("T01")).events.find(e => e.type === "action").side); }
  assert.equal(firstSides.size,2);
  const quick = make("B022","B001"); quick.opponentAction = move("T43");
  assert.equal(stepRound(quick,move("T14")).events.find(e => e.type === "action").side,"player");
  assert.equal(stepRound(quick,move("T28")).events.find(e => e.type === "action").side,"opponent");
});

test("레벨 1·10·20·30/후반 학습/양쪽 아이템/두 난이도 완료 및 범위 검사", () => {
  for (const level of [1,10,20,30]) for (const breed of BREEDS) for (const difficulty of ["normal","hard"]) {
    const learned = breed.learn.filter(l => l.level <= level).map(l => l.move).slice(-4);
    const opponent = buildFighter(breed.id,level,["I02","I08","I13"],{ moves: learned, consumable: "I19" });
    let state = createBattle({ seed: 99, player: buildFighter("B002",level,["I01","I07","I13"],{ consumable: "I21" }), opponent, difficulty });
    while (!state.outcome) {
      const result = stepRound(state,greedy(state));
      for (const side of ["player","opponent"]) {
        const a = result.state[side];
        assert.ok(a.hp >= 0 && a.hp <= a.stats.hp);
        assert.ok(a.energy >= 0 && a.energy <= 10);
        assert.ok(a.healed <= Math.floor(a.stats.hp*.25));
        assert.ok(a.statuses.length <= 2);
      }
      state = result.state;
    }
    assert.ok(state.round <= 12);
  }
  const input = buildFighter("B001",10,[],{ consumable: "I19" });
  const state = createBattle({ seed: 20, player: input, opponent: input });
  state.player.energy = 0; state.opponentAction = { kind: "item", itemId: "I19" };
  const result = stepRound(state,{ kind: "item", itemId: "I19" });
  assert.equal(result.state.player.energy,5);
  assert.equal(result.state.opponent.energy,10);
  assert.ok(result.state.player.itemUsed && result.state.opponent.itemUsed);
});

function greedy(state) {
  const attacks = availableActions(state,"player").filter(a => moveFor(a)?.kind === "attack");
  return attacks.sort((a,b) => {
    const score = action => { const m = moveFor(action); return damageAt(m,state.player,state.opponent,1,state.round) * hitChance(m,state.player,state.opponent,state.round) / 100; };
    return score(b)-score(a);
  })[0] ?? rest;
}
function play(player,opponent,seed,policy,bonus) {
  let state = createBattle({ seed, player, opponent, startEnergyBonus: bonus });
  let policyRng = (seed ^ 0x512be321) >>> 0;
  while (!state.outcome) {
    let action;
    if (policy === "greedy") action = greedy(state);
    else {
      const actions = availableActions(state,"player").filter(a => a.kind !== "quit");
      const next = random(policyRng); policyRng = next.seed; action = actions[Math.floor(next.value*actions.length)];
    }
    state = stepRound(state,action).state;
  }
  return state;
}

test("밸런스: 두 정책 × 도미/미네 × 12종 × 레벨차 3종 × 300판 × 시작 기력 6/7", () => {
  const start = performance.now(), samples = Number(process.env.BATTLE_SAMPLES ?? 300), rows = [];
  assert.ok(Number.isInteger(samples) && samples > 0);
  for (const policy of ["random","greedy"]) for (const id of ["B001","B002"]) for (const breed of BREEDS) for (const delta of [-3,0,3]) for (const bonus of [0,1]) {
    const player = buildFighter(id,10), opponent = buildFighter(breed.id,10+delta);
    let wins = 0, draws = 0, rounds = 0;
    for (let seed = 0; seed < samples; seed++) {
      const result = play(player,opponent,seed+10000,policy,bonus);
      wins += Number(result.outcome === "player"); draws += Number(result.outcome === "draw"); rounds += result.round;
    }
    rows.push({ policy, id, opponent: breed.id, delta, bonus, wins, draws, rounds, samples, rate: wins/samples*100, meanRounds: rounds/samples });
  }
  const summaries = [];
  for (const id of ["B001","B002"]) for (const bonus of [0,1]) {
    const selected = rows.filter(r => r.id === id && r.bonus === bonus && r.delta === 0 && r.policy === "greedy");
    const rate = selected.reduce((s,r) => s+r.rate,0)/12, rounds = selected.reduce((s,r) => s+r.meanRounds,0)/12;
    const hardest = selected.reduce((a,b) => a.rate < b.rate ? a : b), easiest = selected.reduce((a,b) => a.rate > b.rate ? a : b);
    summaries.push({ id, bonus, rate, rounds, hardest, easiest });
    console.log(`${id} 기력${6+bonus}: 승률 ${rate.toFixed(1)}%, 라운드 ${rounds.toFixed(2)}, 범위 ${hardest.rate.toFixed(1)}~${easiest.rate.toFixed(1)}% (${hardest.opponent}~${easiest.opponent})`);
    console.log(selected.map(r => `${r.opponent}:${r.rate.toFixed(1)}/${r.meanRounds.toFixed(1)}`).join(" "));
  }
  const elapsed = (performance.now()-start)/1000;
  console.log(`${rows.length*samples}판, ${elapsed.toFixed(2)}초`);
  if (process.env.BATTLE_REPORT === "1") {
    assert.equal(samples,300,"보고서는 조합당 300판으로만 저장합니다.");
    writeReport(rows,summaries,elapsed);
  }
  if (samples === 300) {
    for (const summary of summaries.filter(s => s.bonus === 0)) {
      assert.ok(summary.rate >= 55 && summary.rate <= 75,`${summary.id} 평균 승률 ${summary.rate}`);
      assert.ok(summary.hardest.rate >= 20 && summary.easiest.rate <= 95,`${summary.id} 상대별 승률 범위`);
      assert.ok(summary.rounds >= 6 && summary.rounds <= 10,`${summary.id} 평균 라운드 ${summary.rounds}`);
    }
    assert.ok(elapsed < 19,`시뮬레이션 ${elapsed.toFixed(2)}초: 로더 포함 20초 예산`);
  }
});

function writeReport(rows,summaries,elapsed) {
  const name = id => BREEDS.find(b => b.id === id).name;
  const lines = ["# 대결 엔진 시뮬레이션", "", "플레이어 레벨 10, 상대 레벨 7·10·13, 양쪽 무장비·소모품 없음, 기본 장착 기술 4개 이하, 일반 NPC(상위 후보 60/30/10%) 조건이다. 각 조합 300판, 기력 6과 7에 같은 시드 10000~10299를 사용했다. 총 86,400판이다.", "", "승률은 순수 승리/300이며 무승부를 승리에 포함하지 않는다. 기대 승점은 (승리+무승부×0.5)/300이다. 상대 레벨차는 상대−플레이어다. 무작위 정책은 그만하기를 제외한 사용 가능한 행동을 균등 선택하고, 탐욕 정책은 상성·체급·명중을 반영한 즉시 기대 피해가 가장 큰 공격을 고른다. 상대 예고를 활용하는 선행 탐색은 하지 않는다.", "", "| 강아지 | 시작 기력 | 동급 승률 | 상대별 범위 | 평균 라운드 | 가장 어려움 | 가장 쉬움 |", "|---|---:|---:|---:|---:|---|---|"];
  lines.splice(6,0,"아래 요약 표는 탐욕 정책의 동급 결과다.","");
  for (const s of summaries) lines.push(`| ${name(s.id)} | ${6+s.bonus} | ${s.rate.toFixed(1)}% | ${s.hardest.rate.toFixed(1)}~${s.easiest.rate.toFixed(1)}% | ${s.rounds.toFixed(2)} | ${name(s.hardest.opponent)} | ${name(s.easiest.opponent)} |`);
  lines.push("", "| 강아지 | 시작 기력 6→7 승률 변화 |", "|---|---:|");
  for (const id of ["B001","B002"]) lines.push(`| ${name(id)} | +${(summaries.find(s => s.id === id && s.bonus === 1).rate-summaries.find(s => s.id === id && s.bonus === 0).rate).toFixed(1)}%p |`);
  lines.push("",`시뮬레이션 소요 ${elapsed.toFixed(2)}초. 재현: \`node --test scripts/pet-battle.test.mjs\`. 보고서 갱신은 PowerShell에서 \`$env:BATTLE_REPORT='1'\`을 설정한 뒤 같은 명령을 실행한다.`,"", "## 조정한 수치", "", "초기 기본 스탯·위력으로 조합당 40판 사전 측정 시 탐욕 동급 승률은 도미 80.8%, 미네 49.2%, 평균 4.80/3.96라운드였다. 체력을 늘려 판 길이를 확보한 다음 상대별 방어·집중·침착과 공격 선택을 조정했다. 아래는 설계 초안 대비 최종 기본 스탯(H/A/D/V/F/R)이다. 성장 계수·피해 공식·상성·체급·기질·기력·회복 상한은 조정하지 않았다. 기본 스탯 가중합 110은 체력 조정으로 더 이상 유지하지 않는다.", "", "| 견종 | 원안 기본 스탯 | 최종 기본 스탯 |", "|---|---|---|");
  const original = { B001: "84/18/18/18/18/17", B002: "68/13/14/23/24/19", B003: "80/18/17/20/24/11", B004: "96/17/21/13/15/20", B005: "96/21/21/16/12/16", B007: "72/14/14/23/25/16", B009: "68/14/13/24/24/18", B015: "84/22/19/18/15/15", B017: "80/17/16/22/25/10", B018: "76/19/16/23/18/15", B020: "92/20/18/23/14/12", B022: "76/15/15/25/28/8" };
  for (const b of BREEDS) lines.push(`| ${b.name} | ${original[b.id]} | ${Object.values(b.base).join("/")} |`);
  lines.push("", "기술 위력은 앞발 밀기 16→12, 문턱 밀어내기 16→12, 반가운 소리 18→14로 낮췄다. 나머지 기술 수치는 원안 그대로다. 기본 밀기는 별도 행동으로 위력 12·명중 95·기력 0을 유지한다. 도미는 Lv.5 교감과 Lv.10 추적, 미네는 Lv.5 수호와 Lv.10 교감을 배워 불리한 그룹에 대응한다. 나머지도 24개 안에서 학습표를 완결했으며 최종 표는 아래에 있다.", "", "## 적용 범위", "", "지도는 요청한 체비쇼프 거리 max(|x−4|,|y−4|)를 적용한다. E5는 거리 0/레벨 1, J10은 거리 5/레벨 11이다. 지역 등급과 레벨식은 원안대로 1+floor(d/2), 1+2d를 쓴다. 첫 단계에서는 칸당 슬롯 0 한 명만 반환한다. 플레이어 레벨은 비교 표시에만 사용하며 상대를 자동으로 강화하지 않는다. 현재 지도에서는 최대 R3이고, 다중 슬롯·숙련 산책·고정 강자는 후속 범위다. 원안 풀과 선정 12종의 교집합이 없는 풍경에는 활동 이미지가 가까운 견종을 배치했다. 모든 실제 칸은 PET_WORLD에서 읽는다.", "", "기본 장착은 배운 기술의 앞 4개다. buildFighter의 네 번째 인자로 moves와 consumable을 지정할 수 있다. 회복·기력 상한과 슬롯 검사는 엔진에 포함한다. 완료 상태의 round는 실제 진행한 라운드 수, 진행 중 round는 다음 입력 라운드다. 예상 피해는 명중 시 범위이며 명중률은 별도 제공한다. 이 표의 목표 검증은 레벨 10·무장비·일반 난이도·시작 기력 6에 한정한다. 레벨 1·10·20·30, 후반 기술, 장비·소모품, 두 난이도는 정상 종료와 수치 범위를 별도로 검사했다. 시작 기력 +1은 실험 입력만 제공하며 돌봄 데이터에는 연결하지 않았다.", "", "## 선택 데이터", "", `견종: ${BREEDS.map(b => b.name).join(" · ")}.`, "", `기술: ${MOVES.map(m => m.name).join(" · ")}. 기본 행동 가볍게 밀기·숨 고르기·그만하기는 24개에 포함하지 않는다.`, "", `아이템: ${ITEMS.map(i => i.name).join(" · ")}.`, "", "| 견종 | Lv.1 공격 | Lv.1 방어 | Lv.5 | Lv.10 | Lv.18 | Lv.26 |", "|---|---|---|---|---|---|---|");
  for (const b of BREEDS) lines.push(`| ${b.name} | ${b.learn.map(l => MOVE_BY_ID[l.move].name).join(" | ")} |`);
  lines.push("", "## 전체 결과", "", "| 정책 | 우리 강아지 | 상대 | 상대 레벨차 | 시작 기력 | 승률 | 무승부율 | 기대 승점 | 평균 라운드 |", "|---|---|---|---:|---:|---:|---:|---:|---:|");
  for (const r of rows) lines.push(`| ${r.policy === "greedy" ? "탐욕" : "무작위"} | ${name(r.id)} | ${name(r.opponent)} | ${r.delta > 0 ? "+" : ""}${r.delta} | ${6+r.bonus} | ${r.rate.toFixed(1)}% | ${(r.draws/r.samples*100).toFixed(1)}% | ${((r.wins+r.draws*.5)/r.samples*100).toFixed(1)}% | ${r.meanRounds.toFixed(2)} |`);
  writeFileSync("docs/pet-battle-sim.md",lines.join("\n")+"\n","utf8");
}
