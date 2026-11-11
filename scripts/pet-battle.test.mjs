import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { loadTS } from "./pet-test-loader.mjs";

const { createBattle, stepRound, availableActions, buildFighter, opponentFor, turnOrder, MAX_ENERGY, START_ENERGY, REST_ENERGY } = loadTS("lib/domine/battle/engine.ts");
const { BREEDS, MOVES, ITEMS, GROWTH, MOVE_BY_ID, PUSH, FINISHERS, CONSUMABLES, ITEM_BY_ID, powerBudget } = loadTS("lib/domine/battle/data.ts");
const { matchup, sizeMultiplier, temperamentBonus, damageAt, previewDamage, effectHint, effectiveStat, hitChance, statusChance, recoveryLeft, moveFor, cumulativeXp, levelFromXp, xpToNext, growthQ, growthScale, normalizedStat, recommendedAllocation, conditionPenalty, critChance } = loadTS("lib/domine/battle/rules.ts");
const { chooseOpponentAction } = loadTS("lib/domine/battle/ai.ts");
const { random } = loadTS("lib/domine/battle/rng.ts");
const { THEME_POOLS } = loadTS("lib/domine/battle/opponents.ts");
const { PET_WORLD } = loadTS("lib/domine/pet-world.ts");
const move = moveId => ({ kind: "move", moveId });
const rest = { kind: "rest" };
const make = (player = "B001", opponent = "B002", level = 10, seed = 27) => createBattle({ seed, player: buildFighter(player,level), opponent: buildFighter(opponent,level) });
function freeze(value) { Object.freeze(value); for (const child of Object.values(value)) if (child && typeof child === "object" && !Object.isFrozen(child)) freeze(child); return value; }
function quiet(state) { state.opponentAction = rest; return state; }

test("12종·33기술·8기존아이템과 학습/성장/슬롯 무결성", () => {
  assert.equal(BREEDS.length,12); assert.equal(MOVES.length,33); assert.equal(ITEMS.length,8);
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
      const q = growthQ(level), total = 3*(level-1);
      for (const key of Object.keys(breed.base)) assert.equal(fighter.stats[key],Math.floor(breed.base[key]*(1+q/20*(.8+1.2*(total ? fighter.allocation[key]/total : 0)))));
    }
  }
  assert.deepEqual(new Set(BREEDS.flatMap(b => b.learn.map(l => l.move))),new Set(MOVES.filter(m => !m.common || m.kind === "defense").map(m => m.id)));
  assert.ok(ITEMS.filter(i => i.slot === "bag").length <= 2);
  for (const item of ITEMS) for (const [stat,rate] of Object.entries(item.rates ?? {})) assert.ok(rate > 0 && rate <= (stat === "hp" ? .1 : .08));
  for (const item of ITEMS.filter(i => i.slot === "bag")) assert.ok(item.energy > 0 && item.energy <= 10 || item.heal > 0 && item.heal <= .25);
  const plain = buildFighter("B001",10), equipped = buildFighter("B001",10,["I04","I08","I13"]);
  assert.deepEqual(equipped.stats,plain.stats);
  assert.ok(buildFighter("B001",10,["I04"],{equipmentStats:true}).stats.attack > plain.stats.attack);
});

test("입력 경계: 견종·레벨·기술·장비·시드 검증", () => {
  for (const level of [0,1000,1.5,NaN,Infinity]) assert.throws(() => buildFighter("B001",level));
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
  assert.equal(damageAt(attack,state.player,state.opponent,1),Math.floor((attack.power*1.5+.45*normalizedStat(state.player,"attack"))*40/(40+normalizedStat(state.opponent,"defense"))*growthScale(10)));
  for (const m of MOVES) {
    const preview = previewDamage(m,state.player,state.opponent);
    for (const r of [.95,1,1.05]) assert.ok(damageAt(m,state.player,state.opponent,r) >= preview.perHit.min && damageAt(m,state.player,state.opponent,r) <= preview.perHit.max);
  }
  assert.equal(effectHint(MOVE_BY_ID.T25,state.player,buildFighter("B002",10)),"good");
  assert.equal(effectHint(MOVE_BY_ID.T01,state.player,buildFighter("B004",10)),"weak");
  assert.equal(effectHint(MOVE_BY_ID.T43,state.player,state.opponent),"normal");
  state.player.statuses = [{ id: "blur", applied: 1, expires: 2 }];
  assert.equal(hitChance(PUSH,state.player,state.opponent),Math.round(Math.max(70,Math.min(99,95+.3*(normalizedStat(state.player,"focus")-normalizedStat(state.opponent,"speed"))-10))*10)/10);
  assert.equal(statusChance(MOVE_BY_ID.T16,state.player,state.opponent),Math.max(10,Math.min(65,25+.4*(normalizedStat(state.player,"focus")-normalizedStat(state.opponent,"calm")))));
  state.player.buffs = [{ stat: "attack", expires: 2 }]; state.player.statuses = [{ id: "stagger", applied: 1, expires: 2 }];
  assert.equal(effectiveStat(state.player,"attack"),Math.floor(state.player.stats.attack*1.15*.85));
});

test("기력 10/10·숨 고르기 +5·자동 회복 없음", () => {
  const state = quiet(make());
  assert.equal(state.player.energy,START_ENERGY); assert.equal(MAX_ENERGY,10); assert.equal(REST_ENERGY,5);
  assert.equal(createBattle({ seed: 1, player: state.player, opponent: state.opponent, startEnergyBonus: 1 }).player.energy,10);
  state.player.energy = 0;
  let result = stepRound(state,rest); assert.equal(result.state.player.energy,5);
  result = stepRound(quiet(result.state),rest); assert.equal(result.state.player.energy,10);
  state.player.statuses = [{ id: "winded", applied: 1, expires: 2 }];
  result = stepRound(state,{kind:"push"}); assert.equal(result.state.player.energy,0);
  assert.ok(!result.events.some(e => e.type === "energy" && e.reason === "round"));
  assert.ok(availableActions(result.state,"player").some(a => a.kind === "push"));
});

test("회복 총량 60%·3개 가방·실손실 제한·매 판 초기화", () => {
  let state = createBattle({ seed: 2, player: buildFighter("B001",18,[],{ items: ["P03","P03","P03"] }), opponent: buildFighter("B001",18) });
  const max = state.player.stats.hp;
  for(let i=0;i<2;i++) { state.player.hp=1; state=stepRound(quiet(state),{kind:"item",itemId:"P03"}).state; }
  assert.equal(state.player.healed,Math.floor(max*.6));
  assert.equal(recoveryLeft(state.player),0);
  assert.ok(!availableActions(state,"player").some(a => a.kind === "item"));
  const fresh=createBattle({seed:2,player:state.player,opponent:state.opponent});
  assert.equal(fresh.player.healed,0); assert.deepEqual(fresh.player.usedItems,[]);
  fresh.player.hp--;
  const healed=stepRound(quiet(fresh),{kind:"item",itemId:"P03"}).state;
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
  assert.ok(result.events.some(e=>e.type==="shield"&&e.change==="applied"&&Math.abs(e.multiplier-.4)<1e-9));
  result = stepRound(quiet(result.state),move("T43")); assert.ok(result.events.some(e=>e.type==="shield"&&e.change==="applied"&&Math.abs(e.multiplier-.7)<1e-9));
  result = stepRound(quiet(result.state),rest); assert.equal(result.state.player.shield,undefined);
  let missed = false, hit = false, ended = false;
  for (let seed = 0; seed < 150 && !(missed && hit && ended); seed++) {
    state = quiet(make("B001","B001",10,seed));
    state.opponent.shield = { multiplier: .65, expires: 2 };
    result = stepRound(state,move("T01"));
    if (result.events.some(e => e.type === "miss")) {
      missed = true; assert.ok(result.state.opponent.shield); assert.equal(result.state.player.energy,8);
      assert.ok(!result.events.some(e => e.type === "damage"));
    } else { hit = true; assert.equal(result.state.opponent.shield,undefined); }
    state = make("B002","B001",10,seed); state.opponent.hp = 1; state.opponentAction = move("T01");
    result = stepRound(state,move("T13"));
    if (result.state.outcome === "player") {
      ended = true; assert.equal(result.state.opponent.energy,10);
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
  assert.equal(stepRound(state,rest).state.player.energy,7);
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
  const expected = (m.power*1.5+.45*normalizedStat(state.player,"focus"))*40/(40+normalizedStat(state.opponent,"defense"))*growthScale(10)*1.04*.92;
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
  for (const level of [1,10,20,30,200,500,999]) for (const breed of BREEDS) for (const difficulty of ["normal","hard"]) {
    const learned = breed.learn.filter(l => l.level <= level).map(l => l.move).slice(-4);
    const opponent = buildFighter(breed.id,level,["I02","I08","I13"],{ moves: learned, consumable: "I19" });
    let state = createBattle({ seed: 99, player: buildFighter("B002",level,["I01","I07","I13"],{ consumable: "I21" }), opponent, difficulty });
    while (!state.outcome) {
      const result = stepRound(state,greedy(state));
      for (const side of ["player","opponent"]) {
        const a = result.state[side];
        assert.ok(a.hp >= 0 && a.hp <= a.stats.hp);
        assert.ok(a.energy >= 0 && a.energy <= 10);
        assert.ok(a.healed <= Math.floor(a.stats.hp*.6));
        assert.ok(a.statuses.length <= 2);
      }
      state = result.state;
    }
    assert.ok(state.round <= 12);
  }
  const input = buildFighter("B001",10,[],{ consumable: "I19" });
  const state = createBattle({ seed: 20, player: input, opponent: input });
  state.player.energy = 0; state.opponent.energy = 7; state.opponentAction = { kind: "item", itemId: "I19" };
  const result = stepRound(state,{ kind: "item", itemId: "I19" });
  assert.equal(result.state.player.energy,3);
  assert.equal(result.state.opponent.energy,10);
  assert.ok(result.state.player.itemUsed && result.state.opponent.itemUsed);
});

test("999레벨 XP 경계·포인트 보존·옵션 검증·성장 정규화", () => {
  assert.equal(cumulativeXp(1),0); assert.equal(cumulativeXp(999),44700430);
  for (let level=1; level<=999; level++) {
    const xp=cumulativeXp(level);
    assert.equal(levelFromXp(xp),level);
    if (level>1) assert.equal(levelFromXp(xp-1),level-1);
    assert.equal(xpToNext(xp),level===999 ? 0 : cumulativeXp(level+1)-xp);
  }
  assert.equal(levelFromXp(Number.MAX_SAFE_INTEGER),999); assert.equal(xpToNext(Number.MAX_SAFE_INTEGER),0);
  for (const xp of [-1,NaN,Infinity,1.2,Number.MAX_SAFE_INTEGER+1]) assert.throws(()=>levelFromXp(xp));
  for (const level of [1,2,10,30,60,100,200,500,999]) for (const breed of BREEDS) {
    const a=buildFighter(breed.id,level), total=3*(level-1);
    assert.equal(Object.values(a.allocation).reduce((s,n)=>s+n,0),total);
    assert.ok(Object.values(a.allocation).every(n=>n<=Math.max(1,Math.floor(total*.4))));
    assert.ok(Object.values(a.stats).every(n=>Number.isInteger(n)&&n>0));
    assert.ok(critChance(a)>=5&&critChance(a)<=25);
    assert.ok(hitChance(PUSH,a,a)>=70&&hitChance(PUSH,a,a)<=99);
  }
  for (const options of [{allocation:{hp:12}},{allocation:{hp:-1}},{allocation:{hp:NaN}},{allocation:{bad:1}},{allocation:{hp:10,attack:10,defense:10}},{job:{attack:.09}},{job:{hp:NaN}},{mastery:{T01:6}},{mastery:{bad:1}},{condition:{fullness:101,mood:0,clean:0}},{movementType:"bad"},{environment:{weather:"bad"}}]) assert.throws(()=>buildFighter("B001",10,[],options));
  assert.throws(()=>buildFighter("B001",1,[],{allocation:{hp:1}}));
  const bare=buildFighter("B001",100,[],{allocation:{}}), full=buildFighter("B001",100);
  assert.ok(full.stats.hp>bare.stats.hp);
  const options=freeze({allocation:recommendedAllocation("B001",30),job:{attack:.08,defense:-.08},condition:{fullness:50,mood:50,clean:100},mastery:{T01:5},movementType:"companion",habitats:["H"],activeBands:["morning"],environment:{habitat:"H",time:"morning",weather:"clear"}});
  const fighter=freeze(buildFighter("B001",30,[],options));
  const state=createBattle({seed:9,player:fighter,opponent:fighter});
  const next=stepRound(freeze(state),{kind:"push"}).state;
  next.player.mastery.T01=1; next.player.allocation.hp=0; next.player.environment.weather="snow"; next.player.habitats.push("G");
  assert.equal(fighter.mastery.T01,5); assert.equal(state.player.environment.weather,"clear"); assert.equal(options.habitats.length,1);
  assert.equal(opponentFor("E5",1,999).levelDifference,-998);
});

test("컨디션 모든 구간·체력 제외·양쪽 적용·직업과 숙련도", () => {
  for (const [v,p] of [[100,0],[60,0],[59,.05],[40,.05],[39,.1],[20,.1],[19,.15],[0,.15]]) assert.equal(conditionPenalty({fullness:v,mood:100,clean:100}),p);
  assert.equal(conditionPenalty({fullness:0,mood:0,clean:0}),.3);
  for (const v of [-1,NaN,Infinity,101,undefined]) assert.throws(()=>conditionPenalty({fullness:v,mood:60,clean:60}));
  const normal=buildFighter("B001",30), tired=buildFighter("B001",30,[],{condition:{fullness:30,mood:30,clean:30}});
  assert.equal(tired.stats.hp,normal.stats.hp);
  for (const s of ["attack","defense","speed","focus","calm"]) assert.equal(tired.stats[s],Math.floor(normal.stats[s]*.7));
  assert.deepEqual(createBattle({seed:1,player:tired,opponent:tired}).opponent.stats,tired.stats);
  const job=buildFighter("B001",30,[],{job:{attack:.08,defense:-.08}});
  assert.equal(job.stats.attack,Math.floor(normal.stats.attack*1.08)); assert.equal(job.stats.defense,Math.floor(normal.stats.defense*.92));
  const mastered=buildFighter("B001",30,[],{mastery:{T01:5,T43:5}});
  assert.equal(damageAt(MOVE_BY_ID.T01,mastered,normal,1),damageAt({...MOVE_BY_ID.T01,power:MOVE_BY_ID.T01.power*1.16},normal,normal,1));
  assert.equal(damageAt(MOVE_BY_ID.T43,mastered,normal,1),0);
});

test("종 상성 36칸·환경 상한·활동 시간·합산 힌트", () => {
  const types=["companion","agile","flying","runner","heavy","waterside"];
  const rates=[[1,1.04,.96,1,.96,1.04],[.96,1,1.04,.96,1.06,1],[1.04,.96,1,1.04,1,.96],[1,1.04,.96,1,.96,1.04],[1.04,.94,1,1.04,1,.96],[.96,1,1.04,.96,1.04,1]];
  for(let i=0;i<6;i++) for(let j=0;j<6;j++) {
    const a=buildFighter("B001",10,[],{movementType:types[i]}), d=buildFighter("B001",10,[],{movementType:types[j]});
    assert.equal(matchup("neutral","bond",a,d),rates[i][j]);
  }
  const a=buildFighter("B002",10,[],{movementType:"agile",habitats:["H"],activeBands:["night"],environment:{habitat:"H",time:"night",weather:"clear"}});
  const d=buildFighter("B001",10,[],{movementType:"heavy"});
  assert.equal(matchup("neutral","bond",a,d),1.12);
  assert.equal(effectHint(PUSH,a,d),"good");
  assert.equal(effectiveStat(a,"focus"),Math.floor(a.stats.focus*1.03));
  for(const weather of ["clear","rain","wind","snow"]) for(const movementType of types) for(const group of ["rush","trick","track","guard","bond","endure"]) {
    const f=buildFighter("B001",10,[],{movementType,environment:{weather}});
    const factor=matchup(group,"bond",f,d)/matchup(group,"bond");
    assert.ok(factor>=.88&&factor<=1.12);
  }
});

test("크리티컬 1.5배·방어 예고 억제·정책 독립", () => {
  let found=false;
  for(let seed=0;seed<120;seed++) {
    const state=quiet(make("B001","B001",10,seed));
    const normal=stepRound({...state,criticals:false},move("T01"));
    const critical=stepRound(state,move("T01"));
    const event=critical.events.find(e=>e.type==="damage"&&e.critical);
    if(event) { found=true; assert.equal(event.amount,Math.floor(normal.events.find(e=>e.type==="damage").amount*1.5)); }
    state.opponentAction=move("T43");
    assert.ok(!stepRound(state,move("T01")).events.some(e=>e.type==="damage"&&e.critical));
    assert.deepEqual(chooseOpponentAction({...state,criticals:true}),chooseOpponentAction({...state,criticals:false}));
  }
  assert.ok(found);
  const a=buildFighter("B001",1); a.stats.focus=10000; assert.equal(critChance(a),25);
});

test("충전 예고·선불 기력·강제 발동·취소·연속 개별 명중·반동", () => {
  for(const id of ["C01","C02"]) {
    let state=createBattle({seed:42,player:buildFighter("B001",10,[],{moves:[id]}),opponent:buildFighter("B001",10)});
    state.player.energy=10;
    assert.equal(availableActions(state,"player").find(a=>a.moveId===id).phase,"prepare");
    const prep=stepRound(quiet(state),move(id)); state=prep.state;
    assert.equal(state.player.charging,id); assert.ok(!prep.events.some(e=>e.type==="damage"));
    assert.equal(state.player.energy,10-MOVE_BY_ID[id].energy);
    assert.equal(availableActions(state,"player")[0].phase,"release");
    assert.throws(()=>stepRound(state,rest));
    assert.equal(previewDamage(MOVE_BY_ID[id],state.player,state.opponent).preparationRounds,0);
    assert.equal(stepRound(state,{kind:"quit"}).state.outcome,"quit");
    state.player.energy=0;
    const release=stepRound(quiet(state),move(id));
    assert.equal(release.state.player.charging,undefined);
    assert.ok(!release.events.some(e=>e.type==="energy"&&e.side==="player"&&e.reason==="cost"));
    state=make(); state.opponent=prep.state.player; state.opponentAction={kind:"move",moveId:id,phase:"release"};
    assert.deepEqual(chooseOpponentAction(state).action,state.opponentAction);
  }
  for(const id of ["C03","C04"]) {
    let mixed=false;
    for(let seed=0;seed<100;seed++) {
      let state=createBattle({seed,player:buildFighter("B001",10,[],{moves:[id]}),opponent:buildFighter("B001",10)});
      state.opponent.hp=10000;
      const result=stepRound(quiet(state),move(id)), hits=result.events.filter(e=>e.type==="hit"||e.type==="miss");
      assert.equal(hits.length,MOVE_BY_ID[id].hits);
      if(hits.some(e=>e.type==="miss")&&hits.some(e=>e.type==="hit")) mixed=true;
    }
    assert.ok(mixed);
  }
  for(const id of ["C05","C06"]) {
    let state=createBattle({seed:3,player:buildFighter("B001",10,[],{moves:[id]}),opponent:buildFighter("B001",10)});
    state.player.energy=10; state=stepRound(quiet(state),move(id)).state;
    if(id==="C05") assert.equal(state.player.energy,4);
    else assert.equal(effectiveStat(state.player,"defense",2),Math.floor(state.player.stats.defense*.85));
    state=stepRound(quiet(state),rest).state; assert.equal(state.player.recoil,undefined);
  }
  assert.ok(MOVES.every(m=>Number.isInteger(m.energy)&&m.energy>=0&&m.energy<=8));
  assert.equal(MOVES.filter(m=>m.mode==="normal").length,27);
});

test("연속 공격 프리뷰 방어막 1회 소비·신규 기술 AI 선택과 종료", () => {
  const counts = new Set();
  for (const id of ["C01","C02","C03","C04","C05","C06"]) {
    for(let seed=0;seed<30;seed++) {
      let state=createBattle({seed,player:buildFighter("B001",10),opponent:buildFighter("B004",10,[],{moves:[id]})});
      state.opponent.energy=10;
      const pick=chooseOpponentAction(state); if(pick.action.moveId===id) counts.add(id);
      state.opponentAction=pick.action; state.rng=pick.rng;
      while(!state.outcome) state=stepRound(freeze(state),greedy(state)).state;
      assert.ok(state.round<=12);
    }
  }
  assert.equal(counts.size,6);
  let checked=false;
  for(let seed=0;seed<100&&!checked;seed++) {
    const state=createBattle({seed,criticals:false,player:buildFighter("B001",10,[],{moves:["C04"]}),opponent:buildFighter("B004",10)});
    state.opponent.shield={multiplier:.65,expires:2};
    const before=structuredClone(state), preview=previewDamage(MOVE_BY_ID.C04,state.player,state.opponent);
    assert.deepEqual(state,before);
    const result=stepRound(quiet(state),move("C04"));
    if(result.events.filter(e=>e.type==="hit").length===3) {
      const total=result.events.filter(e=>e.type==="damage").reduce((s,e)=>s+e.amount,0);
      assert.ok(total>=preview.min&&total<=preview.max); checked=true;
    }
  }
  assert.ok(checked);
});

function greedy(state) {
  const attacks = availableActions(state,"player").filter(a => moveFor(a)?.kind === "attack");
  return attacks.sort((a,b) => {
    const score = action => { const m = moveFor(action); return damageAt(m,state.player,state.opponent,1,state.round) * hitChance(m,state.player,state.opponent,state.round) / 100; };
    return score(b)-score(a);
  })[0] ?? rest;
}
function play(player,opponent,seed,criticals = true) {
  let state = createBattle({ seed, player, opponent, criticals });
  while (!state.outcome) state = stepRound(state,greedy(state)).state;
  return state;
}

test("위력 예산·유료 공격의 평균 피해 단조성·무료 기본기", () => {
  for(const m of MOVES.filter(m=>m.kind==="attack")) assert.equal(m.power,powerBudget(m.energy,m),m.id);
  assert.equal(PUSH.power,10);
  assert.equal(FINISHERS.length,6); assert.ok(FINISHERS.every(m=>m.energy===0&&m.power===34));
  const average=m=>{
    let total=0;
    for(const level of [1,10,30,60,100]) for(const a of BREEDS) for(const d of BREEDS) {
      const p=previewDamage(m,buildFighter(a.id,level),buildFighter(d.id,level)); total+=(p.min+p.max)/2;
    }
    return total/(5*12*12);
  };
  const free=average(PUSH), paid=MOVES.filter(m=>m.kind==="attack").map(m=>({m,damage:average(m)}));
  for(const {m,damage} of paid) assert.ok(damage>free,`${m.id}: ${damage} <= ${free}`);
  const plain=paid.filter(({m})=>!m.status&&!m.buff&&!m.priority&&!m.breaksDefense&&m.mode==="normal");
  for(const a of plain) for(const b of plain) if(a.m.energy>b.m.energy) assert.ok(a.damage>b.damage,`${a.m.id}/${b.m.id}`);
});

function duel(playerMove, opponentMove, seed=1, options={}) {
  const state=createBattle({seed,criticals:false,player:buildFighter("B001",10,[],{moves:[playerMove],...options}),opponent:buildFighter("B001",10,[],{moves:[opponentMove]})});
  state.opponentAction=move(opponentMove);
  return state;
}
function hitResult(state, action, input) {
  for(let seed=0;seed<100;seed++) {
    const result=stepRound({...state,rng:seed},action,input);
    if(!result.events.some(e=>e.type==="miss")) return result;
  }
  assert.fail("명중 표본 없음");
}

test("방어 4종·반격 피해·헛돌기·연속 약화·흔들기와 휘청", () => {
  const attack=MOVE_BY_ID.T01, base=duel("T43","T01"); base.player.energy=5;
  const guarded=hitResult(base,move("T43"));
  assert.equal(guarded.state.player.energy,6); assert.equal(guarded.state.player.momentum,18);
  assert.ok(guarded.events.some(e=>e.type==="shield"&&e.change==="applied"));
  const actor={...base.player,defense:{kind:"guard",strength:1,expires:1}};
  assert.equal(damageAt(attack,base.opponent,actor,1),Math.floor(damageAt(attack,base.opponent,base.player,1)/.95*.95*.4));
  const counter=hitResult(duel("T31","T01"),move("T31"));
  assert.equal(counter.state.player.hp,counter.state.player.stats.hp);
  assert.ok(counter.events.some(e=>e.type==="counter")); assert.equal(counter.state.player.momentum,30);
  assert.ok(counter.events.some(e=>e.type==="damage"&&e.side==="player"&&e.amount>0));
  const missed=stepRound(quiet(duel("T31","T01")),move("T31"));
  assert.equal(missed.state.player.exposedUntil,2);
  const normal={...missed.state.player,exposedUntil:undefined};
  assert.ok(damageAt(attack,missed.state.opponent,missed.state.player,1,2)>=damageAt(attack,missed.state.opponent,normal,1,2)*1.25-1);
  const repeat={...counter.state,opponentAction:move("T01")};
  const repeated=hitResult(repeat,move("T31")); assert.ok(repeated.state.player.hp<repeat.player.hp);
  const switched=structuredClone(repeat); switched.player.moves=["T21","T31"]; switched.player.lastAction=move("T21");
  assert.equal(hitResult(switched,move("T31")).state.player.hp,repeated.state.player.hp);
  const protectedState=duel("T31","T01"); protectedState.opponent.defense={kind:"stance",strength:1,expires:2}; protectedState.opponent.shield={multiplier:.5,expires:12};
  const protectedCounter=hitResult(protectedState,move("T31"));
  const retaliation=counter.events.find(e=>e.type==="damage"&&e.side==="player").amount;
  assert.equal(protectedCounter.events.find(e=>e.type==="damage"&&e.side==="player").amount,Math.floor(retaliation*.5*.7));
  assert.equal(protectedCounter.state.opponent.shield,undefined);
  for(const id of ["C01","C04","F01"]) {
    const state=duel("T19",id==="F01" ? "T01" : id);
    if(id==="C01") state.opponent.charging=id;
    if(id==="F01") { state.opponent.finisher=id; state.opponent.momentum=100; }
    state.opponentAction=move(id);
    const result=hitResult(state,move("T19"));
    assert.ok(result.events.some(e=>e.type==="evade"));
    if(id!=="C04") assert.equal(result.state.player.hp,state.player.hp);
    else assert.ok(result.state.player.hp<state.player.hp);
    assert.equal(result.state.opponent.energy,10-(id==="C04" ? MOVE_BY_ID.C04.energy+1 : 2));
  }
  const stance=hitResult(duel("T67","T01"),move("T67"));
  assert.equal(stance.state.player.defense.kind,"stance"); assert.equal(stance.state.player.defense.expires,2);
  const after=hitResult({...stance.state,opponentAction:move("T01")},rest);
  assert.equal(after.state.player.defense,undefined);
  const broken=hitResult(duel("K01","T43"),move("K01"));
  assert.ok(broken.events.some(e=>e.type==="break")); assert.ok(broken.events.some(e=>e.type==="stagger"));
  assert.equal(broken.state.opponent.defense,undefined);
  assert.ok(!availableActions(broken.state,"opponent").some(a=>moveFor(a)?.kind==="defense"));
  assert.throws(()=>stepRound({...broken.state,opponentAction:move("T43")},rest));
  const clear=stepRound({...broken.state,opponentAction:rest},rest).state;
  assert.ok(availableActions(clear,"opponent").some(a=>moveFor(a)?.kind==="defense"));
  let blocked=false;
  for(let seed=0;seed<100&&!blocked;seed++) {
    const state=duel("T67","K01",seed);
    state.opponent=buildActor("B018",["T16"],seed); state.opponentAction=move("T16");
    blocked=stepRound(state,move("T67")).events.some(e=>e.type==="status"&&e.change==="blocked");
  }
  assert.ok(blocked);
});
function buildActor(id,moves,seed=1,options={}) {
  const fighter=buildFighter(id,10,[],{moves,...options});
  return createBattle({seed,player:fighter,opponent:fighter}).player;
}

test("소모품 8분류·중복 강화·보호·급소·취소·대장·버티기·주인 AI", () => {
  assert.equal(CONSUMABLES.length,14); assert.equal(new Set(CONSUMABLES.map(i=>i.category)).size,8);
  for(const options of [{items:["P01","P01","P01","P01"]},{items:["bad"]},{items:["I01"]},{items:["P01"],consumable:"I19"},{owned:1},{boss:"yes"},{equipmentStats:1},{finisher:"T01"}]) assert.throws(()=>buildFighter("B001",10,[],options));
  for(const item of CONSUMABLES.filter(i=>i.buff)) {
    const state=quiet(duel("T01","T01",1,{items:[item.id,item.id]}));
    const used=stepRound(state,{kind:"item",itemId:item.id}).state;
    assert.equal(effectiveStat(used.player,item.buff,2),Math.floor(state.player.stats[item.buff]*1.2));
    assert.ok(!availableActions(used,"player").some(a=>a.kind==="item"));
    assert.equal(used.player.buffs[0].expires,3);
    const expired=stepRound(quiet(stepRound(quiet(used),rest).state),rest).state;
    assert.ok(availableActions(expired,"player").some(a=>a.kind==="item"));
  }
  for(const [id,amount] of [["P04",3],["P05",6]]) {
    const state=quiet(duel("T01","T01",1,{items:[id]})); state.player.energy=0;
    assert.equal(stepRound(state,{kind:"item",itemId:id}).state.player.energy,amount);
  }
  const dirty=quiet(duel("T01","T01",1,{items:["P10"]})); dirty.player.statuses=[{id:"stagger",applied:1,expires:2}]; dirty.player.exposedUntil=2;
  const clean=stepRound(dirty,{kind:"item",itemId:"P10"}).state;
  assert.deepEqual(clean.player.statuses,[]); assert.equal(clean.player.exposedUntil,undefined);
  const shield=hitResult(duel("T01","T01",1,{items:["P11"]}),{kind:"item",itemId:"P11"});
  assert.equal(shield.state.player.shield,undefined);
  assert.ok(shield.events.some(e=>e.type==="shield"&&e.multiplier===.5));
  let sweet=stepRound(quiet(duel("T01","T01",1,{items:["P12"]})),{kind:"item",itemId:"P12"}).state;
  sweet.criticals=true;
  const crit=hitResult(quiet(sweet),move("T01"));
  assert.ok(crit.events.some(e=>e.type==="damage"&&e.critical)); assert.equal(crit.state.player.guaranteedCritical,false);
  for(const boss of [false,true]) {
    const state=duel("T01","T01",1,{items:["P13"]}); state.opponent.boss=boss;
    const result=hitResult(state,{kind:"item",itemId:"P13"});
    assert.equal(result.events.some(e=>e.type==="cancel"),!boss);
    assert.equal(result.events.some(e=>e.type==="action"&&e.side==="opponent"),boss);
  }
  const dying=duel("T01","T01",1,{items:["P14","P14"]}); dying.player.hp=1;
  const saved=hitResult(dying,{kind:"item",itemId:"P14"});
  assert.equal(saved.state.player.hp,1); assert.equal(saved.state.player.survivalUsed,true);
  assert.ok(!availableActions(saved.state,"player").some(a=>a.kind==="item"));
  const dead=hitResult({...saved.state,opponentAction:move("T01")},rest);
  assert.equal(dead.state.outcome,"opponent");
  const state=make(); state.opponent.items=["P05"]; state.opponent.energy=0;
  for(let rng=0;rng<50;rng++) assert.notEqual(chooseOpponentAction({...state,rng}).action.kind,"item");
  state.opponent.owned=true;
  assert.ok(Array.from({length:50},(_,rng)=>chooseOpponentAction({...state,rng}).action).some(a=>a.kind==="item"));
});

test("기세·결정기·타이밍 입력·순서 미리보기·깊은 복사", () => {
  let state=duel("T01","T01",1,{items:["P01"],finisher:"F02"}); state.player.momentum=100;
  assert.ok(availableActions(state,"player").some(a=>a.moveId==="F02"));
  const before=structuredClone(state), result=hitResult(freeze(state),move("F02"));
  assert.deepEqual(state,before); assert.ok(result.events.some(e=>e.type==="finisher"));
  assert.ok(result.events.some(e=>e.type==="momentum"&&e.amount===-100));
  assert.equal(result.state.player.energy,10); assert.ok(result.state.player.momentum<100);
  result.state.player.items.push("P02"); result.state.player.usedItems.push("P02");
  assert.deepEqual(state.player.items,["P01"]); assert.deepEqual(state.player.usedItems,[]);
  state=quiet(duel("T01","T01"));
  const normal=hitResult(state,move("T01")), perfect=hitResult(state,move("T01"),{attackTiming:"perfect"}), good=hitResult(state,move("T01"),{attackTiming:"good"});
  const amount=r=>r.events.find(e=>e.type==="damage").amount;
  assert.equal(amount(perfect),Math.floor(amount(normal)*1.1)); assert.equal(amount(good),Math.floor(amount(normal)*1.05));
  assert.deepEqual(stepRound(state,move("T01")),stepRound(state,move("T01"),{attackTiming:"miss",guardTiming:"miss"}));
  state=duel("T43","T01"); state.player.energy=4;
  const guard=hitResult(state,move("T43")), timed=hitResult(state,move("T43"),{guardTiming:"perfect"});
  assert.equal(amount(timed),Math.floor(amount(guard)*.8)); assert.equal(timed.state.player.energy,6);
  assert.throws(()=>stepRound(state,rest,{attackTiming:"bad"}));
  for(let seed=0;seed<50;seed++) for(const action of [move("T01"),rest,{kind:"quit"}]) {
    const s=duel("T01","T01",seed), before=structuredClone(s), order=turnOrder(freeze(s),action);
    assert.deepEqual(s,before); assert.equal(stepRound(s,action).events.find(e=>e.type==="action").side,order[0]);
  }
  const finish=quiet(duel("T01","T01")); finish.opponent.hp=1;
  const ended=hitResult(finish,move("T01")); assert.equal(ended.events.at(-1).type,"end");
  const reflect=duel("T31","T01"); reflect.opponent.hp=1;
  const reflected=hitResult(reflect,move("T31")); assert.equal(reflected.events.at(-1).type,"end");
  assert.equal(reflected.state.outcome,"player");
});

function expected(action, actor, target, round) {
  const m=moveFor(action); if(!m || m.kind!=="attack") return 0;
  const p=previewDamage(m,actor,target,round);
  return (p.min+p.max)/2*p.hitChance/100/(1+p.preparationRounds);
}
function policy(state, kind) {
  const actions=availableActions(state,"player"), actor=state.player, target=state.opponent;
  if(actor.charging) return actions[0];
  const attacks=actions.filter(a=>moveFor(a)?.kind==="attack").sort((a,b)=>expected(b,actor,target,state.round)-expected(a,actor,target,state.round));
  const best=attacks[0] ?? rest, damage=expected(best,actor,target,state.round);
  if(kind==="attack") return actor.energy<2 && damage<target.hp && !moveFor(best)?.finisher ? rest : best;
  if(kind==="items") {
    const threat=expected(state.opponentAction,target,actor,state.round);
    const item=actions.find(a=>a.kind==="item" && (ITEM_BY_ID[a.itemId].heal && actor.hp<=actor.stats.hp*.45 && (threat>=actor.hp || threat<actor.stats.hp*ITEM_BY_ID[a.itemId].heal*.7)
      || ITEM_BY_ID[a.itemId].energy && actor.energy<=1 || ITEM_BY_ID[a.itemId].category==="critical" && threat===0 && actor.energy>=3 && target.hp>damage*2));
    if(item && damage<target.hp) return item;
  }
  if(kind==="read" || kind==="items") {
    const incoming=moveFor(state.opponentAction), threat=expected(state.opponentAction,target,actor,state.round);
    const counter=actions.find(a=>moveFor(a)?.defense==="counter");
    if(counter && incoming?.contact && incoming.energy>=2 && !incoming.breaksDefense && threat>=damage*1.05 && actor.lastAction?.moveId!==counter.moveId) return counter;
    const guard=actions.find(a=>moveFor(a)?.defense==="guard");
    if(guard && threat>0 && !incoming?.breaksDefense && actor.energy<2 && threat>actor.stats.hp*.15 && actor.lastAction?.moveId!==guard.moveId) return guard;
  }
  if((actor.energy<2 || kind==="manage" && actor.energy<=4 && expected(state.opponentAction,target,actor,state.round)===0) && damage<target.hp && !moveFor(best)?.finisher) return rest;
  return best;
}

test("2차 정책 시뮬레이션", () => {
  const start=performance.now(), samples=Number(process.env.BATTLE_SAMPLES ?? 32), rows=[];
  assert.ok(Number.isInteger(samples)&&samples>0);
  for(const level of [1,10,30,60,100]) for(const id of BREEDS.map(b=>b.id)) for(const kind of ["attack","manage","read","items"]) {
    const player=buildFighter(id,level,[],{moves:[...BREEDS.find(b=>b.id===id).learn.filter(l=>l.level<=level&&MOVE_BY_ID[l.move].kind==="attack").slice(0,2).map(l=>l.move),"T43","T31"],...(kind==="items" ? {items:["P02","P05","P12"]} : {})});
    let wins=0, rounds=0, limit=0, stuck=0, exhausted=0, uses=0;
    for(const breed of BREEDS) {
      const opponent=buildFighter(breed.id,level);
      for(let seed=10000;seed<10000+samples;seed++) {
        let state=createBattle({seed,player,opponent});
        while(!state.outcome) {
          const actions=availableActions(state,"player");
          stuck+=!actions.some(a=>a.kind!=="quit");
          exhausted+=!actions.some(a=>moveFor(a)?.kind==="attack" && moveFor(a).energy>0);
          state=stepRound(state,policy(state,kind)).state;
        }
        wins+=state.outcome==="player"; rounds+=state.round; limit+=state.round===12; uses+=state.player.usedItems.length;
      }
    }
    const n=BREEDS.length*samples;
    rows.push({level,id,kind,rate:wins/n*100,rounds:rounds/n,limit:limit/n*100,stuck:stuck/rounds*100,exhausted:exhausted/rounds*100,uses:uses/n});
  }
  const elapsed=(performance.now()-start)/1000;
  const summary=[1,10,30,60,100].flatMap(level=>["attack","manage","read","items"].map(kind=>{
    const group=rows.filter(r=>r.level===level&&r.kind===kind), result={level,kind};
    for(const key of ["rate","rounds","limit","stuck","exhausted","uses"]) result[key]=group.reduce((s,r)=>s+r[key],0)/group.length;
    return result;
  }));
  console.log(JSON.stringify({samples,elapsed,rows:summary}));
  if(samples>=32) {
    for(const row of summary) {
      assert.ok(row.rate>=55&&row.rate<=75,`정책 승률 ${JSON.stringify(row)}`);
      assert.ok(row.rounds>=6&&row.rounds<=10,`정책 라운드 ${JSON.stringify(row)}`);
      assert.ok(row.limit<=15,`정책 12라운드 ${JSON.stringify(row)}`);
      assert.ok(row.stuck<=10);
    }
    for(const row of summary.filter(r=>r.kind==="read")) {
      const attack=summary.find(r=>r.level===row.level&&r.kind==="attack");
      const items=summary.find(r=>r.level===row.level&&r.kind==="items");
      assert.ok(row.rate-attack.rate>=5&&row.rate-attack.rate<=12,`방어 이득 ${row.id}/${row.level}: ${row.rate-attack.rate}`);
      assert.ok(items.rate-row.rate<=15,`소모품 이득 ${items.rate-row.rate}`);
    }
    assert.ok(elapsed<28,`실행 시간 ${elapsed}`);
  }
  if(process.env.BATTLE_REPORT==="1") {
    const names={attack:"공격",manage:"기력 관리",read:"방어 읽기",items:"소모품"}, f=n=>n.toFixed(2);
    const lines=[`12견종 × 12상대 × 5레벨 × 4정책 × ${samples}시드 = ${12*12*5*4*samples}판. 시드 10000~${9999+samples}, 시뮬레이션 ${f(elapsed)}초.`,"",
      "| 레벨 | 정책 | 승률 | 평균 라운드 | 12라운드 도달 | 행동 불가 | 유료 공격 불가 | 평균 소모품 사용 |",
      "|---:|---|---:|---:|---:|---:|---:|---:|"];
    for(const r of summary) lines.push(`| ${r.level} | ${names[r.kind]} | ${f(r.rate)}% | ${f(r.rounds)} | ${f(r.limit)}% | ${f(r.stuck)}% | ${f(r.exhausted)}% | ${f(r.uses)} |`);
    lines.push("","| 레벨 | 방어 읽기 − 공격 | 소모품 − 방어 읽기 |","|---:|---:|---:|");
    for(const level of [1,10,30,60,100]) {
      const rate=kind=>summary.find(r=>r.level===level&&r.kind===kind).rate;
      lines.push(`| ${level} | +${f(rate("read")-rate("attack"))}%p | ${f(rate("items")-rate("read"))}%p |`);
    }
    const range=rows.filter(r=>r.kind==="read").map(r=>r.rate);
    lines.push("",`견종별 방어 읽기 승률 범위는 ${f(Math.min(...range))}~${f(Math.max(...range))}%다. 평균 합격이 모든 견종·상대 조합의 균형을 뜻하지는 않는다.`);
    const path="docs/pet-battle-sim.md", doc=readFileSync(path,"utf8");
    assert.ok(doc.includes("<!-- simulation:start -->")&&doc.includes("<!-- simulation:end -->"));
    writeFileSync(path,doc.replace(/<!-- simulation:start -->[\s\S]*?<!-- simulation:end -->/,`<!-- simulation:start -->\n${lines.join("\n")}\n<!-- simulation:end -->`));
  }
});
