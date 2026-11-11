import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { loadTS } from "./pet-test-loader.mjs";

const { createBattle, stepRound, availableActions, buildFighter, opponentFor } = loadTS("lib/domine/battle/engine.ts");
const { BREEDS, MOVES, ITEMS, GROWTH, MOVE_BY_ID, PUSH } = loadTS("lib/domine/battle/data.ts");
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

test("12종·30기술·8아이템과 학습/성장/슬롯 무결성", () => {
  assert.equal(BREEDS.length,12); assert.equal(MOVES.length,30); assert.equal(ITEMS.length,8);
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
  assert.deepEqual(new Set(BREEDS.flatMap(b => b.learn.map(l => l.move))),new Set(MOVES.filter(m => !m.common).map(m => m.id)));
  assert.ok(ITEMS.filter(i => i.slot === "bag").length <= 2);
  for (const item of ITEMS) for (const [stat,rate] of Object.entries(item.rates ?? {})) assert.ok(rate > 0 && rate <= (stat === "hp" ? .1 : .08));
  for (const item of ITEMS.filter(i => i.slot === "bag")) assert.ok(item.energy > 0 && item.energy <= 10 || item.heal > 0 && item.heal <= .25);
  const plain = buildFighter("B001",10), equipped = buildFighter("B001",10,["I04","I08","I13"]);
  assert.equal(equipped.stats.attack,plain.stats.attack+Math.max(1,Math.floor(plain.stats.attack*.07)));
  assert.equal(equipped.stats.hp,plain.stats.hp+Math.max(1,Math.floor(plain.stats.hp*.06)));
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
    assert.equal(state.player.energy,12-MOVE_BY_ID[id].energy);
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
    if(id==="C05") assert.equal(state.player.energy,6);
    else assert.equal(effectiveStat(state.player,"defense",2),Math.floor(state.player.stats.defense*.85));
    state=stepRound(quiet(state),rest).state; assert.equal(state.player.recoil,undefined);
  }
  assert.ok(MOVES.every(m=>Number.isInteger(m.energy)&&m.energy>=0&&m.energy<=8));
  assert.equal(MOVES.filter(m=>m.mode==="normal").length,24);
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

function concentrated(id,level,stat) {
  const allocation = recommendedAllocation(id,level), total = 3*(level-1), cap = Math.max(1,Math.floor(total*.4));
  if (!total) return allocation;
  while (allocation[stat] < cap) {
    const donor = Object.keys(allocation).filter(s => s !== stat).sort((a,b) => allocation[b]-allocation[a])[0];
    allocation[donor]--; allocation[stat]++;
  }
  return allocation;
}

test("밸런스: 레벨별 동급·크리티컬·컨디션·분배·숙련도", () => {
  const start = performance.now(), samples = Number(process.env.BATTLE_SAMPLES ?? 300), rows = [];
  assert.ok(Number.isInteger(samples) && samples > 0);
  const variants = ["base","noCrit","condition10","condition20","condition30",...Object.keys(BREEDS[0].base).map(s => `allocation:${s}`),"mastery5"];
  for (const level of [1,10,30,60,100]) for (const id of ["B001","B002"]) for (const variant of variants) {
    const count = variant === "base" ? samples : Math.min(samples,100);
    const options = {};
    if (variant.startsWith("condition")) options.condition = { fullness: 30, mood: variant === "condition10" ? 100 : 30, clean: variant === "condition30" ? 30 : 100 };
    if (variant.startsWith("allocation:")) options.allocation = concentrated(id,level,variant.split(":")[1]);
    if (variant === "mastery5") options.mastery = Object.fromEntries([...MOVES,PUSH].map(m => [m.id,5]));
    const player = buildFighter(id,level,[],options);
    let wins=0, rounds=0, limit=0, draws=0, pairedWins=0;
    for (const breed of BREEDS) {
      const opponent = buildFighter(breed.id,level);
      for (let seed=10000; seed<10000+count; seed++) {
        const state=play(player,opponent,seed,variant !== "noCrit");
        wins += state.outcome === "player"; if(seed<10100) pairedWins += state.outcome === "player"; draws += state.outcome === "draw"; rounds += state.round; limit += state.round === 12;
      }
    }
    const n = count*BREEDS.length;
    rows.push({level,id,variant,count,pairedRate:pairedWins/(Math.min(count,100)*12)*100,rate:wins/n*100,rounds:rounds/n,limit:limit/n*100,draws:draws/n*100});
  }
  const elapsed=(performance.now()-start)/1000;
  console.log(JSON.stringify({samples,elapsed,summary:rows.filter(r=>r.variant === "base").map(b=>({...b, changes:rows.filter(r=>r.level===b.level&&r.id===b.id).map(r=>[r.variant,+(r.rate-b.pairedRate).toFixed(1)])}))}));
  if (samples === 300) {
    for (const row of rows.filter(r => r.variant === "base")) {
      assert.ok(row.rate >= 55 && row.rate <= 75,`${row.id} Lv.${row.level} 승률 ${row.rate}`);
      assert.ok(row.rounds >= 6 && row.rounds <= 10,`${row.id} Lv.${row.level} 라운드 ${row.rounds}`);
      assert.ok(row.limit <= 15,`${row.id} Lv.${row.level} 12라운드 도달 ${row.limit}`);
      for (const v of rows.filter(r => r.id === row.id && r.level === row.level && (r.variant.startsWith("allocation:") || r.variant === "mastery5"))) assert.ok(Math.abs(v.rate-row.pairedRate) <= 10,`${row.id} Lv.${row.level} ${v.variant} 변화 ${v.rate-row.pairedRate}`);
    }
    assert.ok(elapsed < 28,`로더 포함 30초 예산: 시뮬레이션 ${elapsed.toFixed(2)}초`);
  }
  if (process.env.BATTLE_REPORT === "1") writeReport(rows,samples,elapsed);
});

function writeReport(rows,samples,elapsed) {
  const f=n=>n.toFixed(2), name=id=>id === "B001" ? "도미" : "미네";
  const lines=["# 싸움왕 1단계 전투 엔진 검증", "", `12견종, Lv.1·10·30·60·100, 무장비·소모품 없음, 시작 기력 6, 기본 장착 기술, 일반 AI. 기준 조합당 ${samples}개 시드, 영향 비교 조합당 ${Math.min(samples,100)}개 시드(10000부터), 총 ${rows.reduce((s,r)=>s+r.count*12,0)}판. 시뮬레이션 ${f(elapsed)}초. 탐욕 정책은 명중률을 반영한 즉시 기대 피해 최대 공격을 고르며 예고를 선행 탐색하지 않는다. 승률은 순수 승리 비율이며 무승부를 승리에 포함하지 않는다. 12라운드 도달률은 마지막 라운드 KO도 포함한다.`, "", "| 레벨 | 강아지 | 승률 | 평균 라운드 | 12라운드 도달 |", "|---:|---|---:|---:|---:|"];
  for (const r of rows.filter(r=>r.variant === "base")) lines.push(`| ${r.level} | ${name(r.id)} | ${f(r.rate)}% | ${f(r.rounds)} | ${f(r.limit)}% |`);
  lines.push("", "영향 비교는 같은 상대·레벨·처음 100개 시드를 짝지었다. 아래 기준 승률은 이 100개 시드의 결과라 위 300개 시드 표와 조금 다르다. 크리티컬 끄기는 양쪽에 적용하고, 다른 옵션은 플레이어만 바꾼다. 한 스탯 편중은 40% 상한까지 올리고 나머지 추천 분배에서 많은 순으로 옮긴다. Lv.1은 포인트가 없어 분배 효과가 없다. 숙련도는 기본 밀기를 포함한 모든 공격 Lv.1→5 비교다.", "", "| 레벨 | 강아지 | 크리티컬 전→후 승률 | 컨디션 0/10/20/30% 승률 | 체력/공격/방어/민첩/집중/침착 편중 변화(%p) | 숙련도 1→5 변화(%p) |", "|---:|---|---|---|---|---:|");
  for (const b of rows.filter(r=>r.variant === "base")) {
    const get=v=>rows.find(r=>r.level===b.level&&r.id===b.id&&r.variant===v);
    lines.push(`| ${b.level} | ${name(b.id)} | ${f(get("noCrit").rate)}→${f(b.pairedRate)}% | ${[b.pairedRate,...[10,20,30].map(n=>get(`condition${n}`).rate)].map(f).join(" / ")}% | ${Object.keys(BREEDS[0].base).map(s=>f(get(`allocation:${s}`).rate-b.pairedRate)).join(" / ")} | ${f(get("mastery5").rate-b.pairedRate)} |`);
  }
  lines.push("", "## 조정한 수치", "", "성장식만 교체한 첫 12개 시드 표본에서 도미 승률은 Lv.1 19.4%, Lv.10 42.4%였고, Lv.100 체력 편중은 +29.9%p, 숙련도는 +25.7%p였다. 집중 보정·분배·숙련도 비율을 낮추지 않고 기본 체력과 앞발 밀기 위력을 조정했다. 체력이 낮은 상대와 오래 버티는 상대의 차이가 커졌으므로, 전체 평균 합격이 상대별 균형을 뜻하지는 않는다.", "", "| 견종 | 체력 변경 |", "|---|---:|");
  const old={B001:121,B002:140,B003:140,B004:135,B005:166,B007:142,B009:128,B015:144,B017:140,B018:136,B020:180,B022:136};
  for(const b of BREEDS) lines.push(`| ${b.name} | ${old[b.id]} → ${b.base.hp} |`);
  lines.push("", "앞발 밀기 위력 12→16. 다른 기본 스탯·기존 기술 위력은 유지했다. 크리티컬은 5 + 정규화 집중×0.2(%), 상한 25%, 피해 ×1.5로 도입했고 추가 조정하지 않았다. 분배 자동 80%·분배 20%, 숙련도 레벨당 +4%도 유지했다. 일반 AI는 기존 후보 가중치 60/30/10%를 유지하면서 명중률·운용 시간을 반영한다.", "", "## 규칙과 호환성", "", "누적 XP와 Q·S 성장 감쇠는 설계식 그대로다. 레벨당 3점, 한 스탯 최대 max(1, floor(총점×0.4)), Lv.1은 0점이다. 체력의 4배 단위를 보존하며 추천 비율이 없는 견종은 체력/4를 분배 가중치로 쓴다. 도미·미네는 설계서 추천 비율을 사용한다. allocation 생략은 추천 자동 분배, 빈 객체는 전부 미분배다. xpToNext(xp)는 다음 레벨까지 남은 XP이며 Lv.999는 0이다.", "", "conditionPenalty는 0~0.30 비율이며 체력을 제외한 최종 스탯에 적용한다. 직업은 스탯별 비율 표(±8%)만 받는다. 전투 생성 때 분배·직업·컨디션·숙련도·환경을 포함해 다시 검증하고 복사한다. 실제 저장이나 재분배 처리는 포함하지 않는다.", "", "기존 24기술은 normal. C01/C02는 charge(6/8기력), C03/C04는 multi(2/3회, 타격별 명중 판정), C05/C06는 recoil(다음 라운드 기력 −3/방어 −15%)다. 새 기술은 공통으로 선택 가능하지만 기본 장착에는 넣지 않는다. 충전은 준비 때 비용을 지불하고 다음 라운드 강제 발동한다. 예고 phase=prepare/release로 구분한다. 기력 반동은 라운드 종료 회복 후 다음 행동 예고 전에 적용한다.", "", "미리보기 min/max는 비크리티컬 전타 명중 기준이다. perHit·hits·criticalMax·criticalChance·preparationRounds·recoil을 추가했다. damageAt은 타격 1회의 피해다. 그 라운드 상대가 방어를 선택하면 행동 순서와 무관하게 크리티컬이 없다. AI는 크리티컬 확률을 평가에 쓰지 않는다. 비교용 createBattle({criticals:false})도 난수 1회를 소비하므로 분기가 갈라지기 전까지 같은 난수열이다.", "", "움직임·서식지·환경은 FighterOptions 선택 필드다. 종/환경 정보가 없는 기존 견종은 해당 보정 1.0이며 체급 보정은 유지한다. 보조 배율은 0.88~1.12, 힌트는 합산 1.10 이상/0.90 이하로 판정한다. 활동 시간은 집중 +3%다. 기존 export 이름·인자·필드와 이벤트 종류를 유지하고 선택 필드만 추가했다.", "", "SQL·화면·서버·저장·직업 데이터·실기기·빌드는 범위 밖이다. 같은 시드와 행동열의 결정성, 입력 불변성, XP 전 레벨 경계, 옵션 검증, 신규 기술을 단위 테스트로 확인한다. 기본 장착에 없는 공통 예시 기술의 조합별 승률은 이번 기본 12견종 시뮬레이션에 포함하지 않았다. 재현: `node --test scripts/pet-battle.test.mjs`; 보고서 갱신: PowerShell에서 `$env:BATTLE_REPORT='1'` 후 같은 명령.");
  writeFileSync("docs/pet-battle-sim.md",lines.join("\n")+"\n");
}
