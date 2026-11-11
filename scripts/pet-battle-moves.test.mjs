import assert from "node:assert/strict";
import test from "node:test";
import { loadTS } from "./pet-test-loader.mjs";
const { MOVES, MOVE_BY_ID, FINISHERS, PUSH, BREEDS, powerBudget }=loadTS("lib/domine/battle/data.ts");
const { ELEMENTS, SPECIES, MOVE_TAGS, SIGNATURE_BREEDS }=loadTS("lib/domine/battle/moves.ts");
const { learnset, moveSlots, autoMoves, validateJob }=loadTS("lib/domine/battle/learnset.ts");
const { JOBS, jobBonus, skillPoints }=loadTS("lib/domine/battle/jobs.ts");
const { buildFighter, damageAt, previewDamage, affinity, availableActions, moveEnergy, moveFor }=loadTS("lib/domine/battle/rules.ts");
const { createBattle, stepRound }=loadTS("lib/domine/battle/engine.ts");
const { chooseAction, AI_TIERS }=loadTS("lib/domine/battle/ai.ts");
const move=moveId=>({kind:"move",moveId}), rest={kind:"rest"};

test("성향: 스탯 총합·정수·재시작·확률·기세·휴식·급소 미리보기",()=>{
  const { BATTLE_PROFILES, profileFor }=loadTS("lib/domine/battle/profiles.ts");
  const { critChance, hitChance, statusChance }=loadTS("lib/domine/battle/rules.ts");
  const total = stats => Object.values(stats).reduce((a,b)=>a+b,0);
  for(const species of SPECIES) for(const breed of BREEDS) for(const level of [1,10,30,100,999]) {
    const plain=buildFighter(breed.id,level), fighter=buildFighter(breed.id,level,[],{species});
    assert.equal(total(fighter.baseStats),total(plain.baseStats));
    for(const key of Object.keys(fighter.stats)) {
      assert.ok(Number.isInteger(fighter.stats[key]) && fighter.stats[key]>0);
      assert.ok(Math.abs(fighter.stats[key]-plain.stats[key])<=plain.stats[key]*.12+1);
    }
    assert.deepEqual(fighter.battleProfile,profileFor(species,breed.id));
    assert.deepEqual(createBattle({seed:1,player:fighter,opponent:plain}).player.battleProfile,fighter.battleProfile);
  }
  assert.equal(buildFighter("B001",10).battleProfile,undefined);
  const plain=buildFighter("B001",30), cat=buildFighter("B001",30,[],{species:"cat"}), target=buildFighter("B001",30,[],{species:"duck"});
  const sameStats={...plain,battleProfile:cat.battleProfile};
  assert.equal(critChance(sameStats)-critChance(plain),2);
  assert.equal(critChance({...sameStats,stats:{...sameStats.stats,focus:10000}}),25);
  assert.equal(hitChance(PUSH,plain,{...plain,battleProfile:BATTLE_PROFILES.sparrow}),hitChance(PUSH,plain,plain)-1);
  const status={...PUSH,status:"slow",chance:40};
  const raccoon={...plain,battleProfile:BATTLE_PROFILES.raccoon}, duck={...plain,battleProfile:BATTLE_PROFILES.duck};
  assert.ok(Math.abs(statusChance(status,raccoon,duck)-statusChance(status,plain,plain)*1.15*.9)<1e-9);
  assert.equal(previewDamage(PUSH,cat,target).criticalMax,damageAt(PUSH,cat,target,1.05,1,1.54));
  for(const species of ["pigeon","magpie"]) {
    const fighter=buildFighter("B001",30,[],{species});
    let state=createBattle({seed:3,player:fighter,opponent:plain});
    state.player.energy=0; state.opponentAction=rest;
    assert.equal(stepRound(state,rest).state.player.energy,fighter.battleProfile.restEnergy);
    state.player.momentum=100;state.player.energy=10;
    const result=stepRound(state,move(state.player.finisher));
    assert.ok(result.events.some(e=>e.type==="momentum"&&e.side==="player"&&e.amount===-100));
    state=createBattle({seed:3,player:plain,opponent:fighter});state.opponentAction=rest;
    const damaged=stepRound(state,{kind:"push"});
    assert.ok(damaged.events.some(e=>e.type==="momentum"&&e.side==="opponent"&&e.amount===8*fighter.battleProfile.momentumRate));
    damaged.state.opponent.battleProfile.statTilt.hp=123;
    assert.notEqual(state.opponent.battleProfile.statTilt.hp,123);
  }
});

test("성향 전투 선공 재현·우선도·미리보기 일치와 최종 피해 0.5~2배",()=>{
  const { BATTLE_PROFILES }=loadTS("lib/domine/battle/profiles.ts");
  const { turnOrder }=loadTS("lib/domine/battle/rules.ts");
  const player=buildFighter("B003",30,[],{species:"deer",moves:["T43"]}),opponent=buildFighter("B003",30,[],{species:"duck"});
  const state=createBattle({seed:1,player,opponent}), first=new Set();
  state.opponentAction={kind:"push"};
  for(let rng=0;rng<100;rng++) {
    const input={...state,rng},before=structuredClone(input),action={kind:"push"};
    const order=turnOrder(input,action);first.add(order[0]);
    assert.equal(stepRound(input,action).events.find(e=>e.type==="action").side,order[0]);
    assert.equal(turnOrder(input,move("T43"))[0],"player");
    assert.deepEqual(input,before);
  }
  assert.equal(first.size,2);
  const stats={hp:10000,attack:20,defense:20,speed:20,focus:20,calm:20};
  const control={...buildFighter("B003",1),stats,baseStats:stats,element:"rush"};
  const base=(1.5*PUSH.power+.45*20)*40/60*.92;
  for(const battleProfile of Object.values(BATTLE_PROFILES)) for(const breaksDefense of [false,true]) {
    const actor={...control,battleProfile},m={...PUSH,breaksDefense};
    assert.equal(damageAt(m,actor,control,1,1,.001),Math.floor(base*.5));
    assert.equal(damageAt(m,actor,control,1,1,100),Math.floor(base*2));
    const target={...control,stats:{...stats,hp:100}};
    for(const extra of [{},{mode:"multi",hits:3},{mode:"charge"},{finisher:true}]) {
      const attack={...PUSH,power:1000,...extra},hits=attack.hits??1;
      assert.ok(damageAt(attack,actor,target,1.05,1,battleProfile.critMultiplier*1.1)*hits<=100*(attack.finisher||attack.mode==="charge"?.5:.35));
    }
  }
});

test("기술 235개: 분류·태그·연출·비용·예산·학습 범위",()=>{
  assert.equal(MOVES.length,235);
  assert.equal(new Set([...MOVES,...FINISHERS,PUSH].map(m=>m.id)).size,242);
  const expanded=MOVES.filter(m=>m.id.startsWith("M"));
  const counts=Object.fromEntries(["common","element","species","breed","job"].map(s=>[s,expanded.filter(m=>m.source===s).length]));
  assert.deepEqual(counts,{common:20,element:72,species:36,breed:44,job:30});
  for(const [index,m] of expanded.entries()) {
    assert.equal(m.id,`M${String(index+1).padStart(3,"0")}`);
    assert.match(m.name,/[가-힣]/); assert.ok(m.name.length<=12);
    assert.ok(m.fx && m.tags.length>=1 && m.tags.length<=2);
    assert.ok(m.tags.every(t=>MOVE_TAGS.includes(t)));
    assert.ok(Number.isInteger(m.energy)&&m.energy>=0&&m.energy<=8);
    assert.ok(m.accuracy>=70&&m.accuracy<=100&&Number.isInteger(m.priority));
    assert.equal(m.kind==="attack" ? m.power : 0,m.kind==="attack" ? powerBudget(m.energy,m) : 0);
    if(m.source==="common") assert.equal(m.group,"neutral");
  }
  const proportions=[m=>m.energy<=1,m=>m.energy>=2&&m.energy<=4,m=>m.energy>=5].map(f=>expanded.filter(f).length/expanded.length);
  for(let i=0;i<3;i++) assert.ok(Math.abs(proportions[i]-[.20,.55,.25][i])<=.05,`${i}: ${proportions[i]}`);
  for(const element of ELEMENTS) {
    const pool=expanded.filter(m=>m.source==="element"&&m.group===element);
    assert.equal(pool.length,12);
    for(const mode of ["charge","multi","recoil"]) assert.ok(pool.some(m=>m.mode===mode));
    for(const kind of ["attack","defense","support"]) assert.ok(pool.some(m=>m.kind===kind));
    assert.ok(pool.some(m=>m.breaksDefense));
  }
  for(const species of SPECIES) for(const element of ELEMENTS) for(const level of [1,10,30,60,100,300]) {
    const breed=species==="cat"?"C01":species==="dog"?"B001":"wild";
    const ids=learnset(species,breed,element,level), equipped=autoMoves(ids,level);
    assert.ok(ids.length>0); assert.equal(equipped.length,moveSlots(level));
    assert.ok(equipped.every(id=>ids.includes(id)));
    for(const id of ids) {
      const m=MOVE_BY_ID[id]; if(!id.startsWith("M")) continue;
      assert.ok(m.learn.level<=level);
      if(m.learn.species) assert.equal(m.learn.species,species);
      if(m.learn.breedId) assert.equal(m.learn.breedId,breed);
      assert.ok(!m.learn.job);
    }
  }
  for(const [breed] of SIGNATURE_BREEDS) {
    const species=breed.startsWith("B")?"dog":"cat", signature=expanded.find(m=>m.learn.breedId===breed);
    assert.ok(learnset(species,breed,"rush",100).includes(signature.id));
    assert.ok(!learnset(species,"other","rush",100).includes(signature.id));
    assert.ok(!learnset(species==="cat"?"dog":"cat",breed,"rush",100).includes(signature.id));
  }
});

test("5직업·전직·선행 노드·포인트·2랭크 비용과 위력",()=>{
  assert.equal(Object.keys(JOBS).length,5); assert.equal(skillPoints(999),12);
  for(const job of Object.keys(JOBS)) for(const tier of [1,2,3]) {
    const bonus=Object.values(jobBonus(job,tier)).sort((a,b)=>a-b), rate=[.04,.06,.08][tier-1];
    assert.deepEqual(bonus,[-rate,rate,rate]);
    assert.throws(()=>buildFighter("B001",[9,29,59][tier-1],[],{job:{id:job,tier}}));
    for(const level of [10,30,60,100]) if(level>=[10,30,60][tier-1]) {
      const ids=learnset("dog","B001","bond",level,{id:job,tier});
      for(const id of ids.filter(id=>MOVE_BY_ID[id].source==="job")) {
        const rule=MOVE_BY_ID[id].learn;
        assert.equal(rule.job,job); assert.ok(rule.tier<=tier&&rule.level<=level);
      }
    }
  }
  const nodes=MOVES.filter(m=>m.learn?.job==="rush"), [attack,support,middle]=nodes;
  assert.throws(()=>validateJob({id:"rush",tier:2,nodes:{[middle.id]:1}},40));
  assert.throws(()=>validateJob({id:"rush",tier:1,nodes:{[attack.id]:2}},10));
  assert.throws(()=>jobBonus("unknown",1)); assert.throws(()=>jobBonus("rush",4));
  const options={job:{id:"rush",tier:3,nodes:{[attack.id]:2,[support.id]:2}},mastery:{[attack.id]:5},moves:[attack.id,support.id]};
  const fighter=buildFighter("B001",100,[],options), target=buildFighter("B001",100);
  assert.equal(moveEnergy(support,fighter),1);
  const noMastery={...fighter,mastery:undefined,job:jobBonus("rush",3)};
  assert.equal(damageAt(attack,fighter,target,1),damageAt({...attack,power:attack.power*1.2},noMastery,target,1));
  const state=createBattle({seed:2,player:fighter,opponent:target});state.opponentAction=rest;
  assert.equal(stepRound(state,move(support.id)).state.player.energy,9);
});

test("신규 202개를 습득 조건대로 장착하고 각각 실행",()=>{
  for(const m of MOVES.filter(m=>m.id.startsWith("M"))) {
    const options={moves:[m.id],element:m.group==="neutral"?"rush":m.group,species:m.learn.species??"dog",
      ...(m.learn.breedId?{signatureBreedId:m.learn.breedId}:{}),...(m.learn.job?{job:{id:m.learn.job,tier:3}}:{})};
    const player=buildFighter("B001",100,[],options), opponent=buildFighter("B002",100);
    let state=createBattle({seed:42,player,opponent}); state.opponentAction=rest;
    state.player.hp=Math.floor(state.player.stats.hp*.6);
    const result=stepRound(state,move(m.id));
    assert.ok(result.events.some(e=>e.type==="action"&&e.side==="player"&&e.action.moveId===m.id),m.id);
    assert.equal(result.state.player.energy,Math.max(0,10-m.energy-(m.recoil?.energy??0)),m.id);
    if(m.mode==="charge") {
      assert.equal(result.state.player.charging,m.id);
      state=result.state;state.opponentAction=rest;
      assert.equal(stepRound(state,move(m.id)).state.player.charging,undefined);
    }
    if(m.kind==="defense") assert.ok(result.events.some(e=>e.type==="shield"),m.id);
    if(m.buff) assert.ok(result.state.player.buffs.some(b=>b.stat===m.buff)||result.events.some(e=>e.type==="miss"),m.id);
    if(m.heal) assert.ok(result.state.player.hp>state.player.hp,m.id);
  }
});

test("개체 상성 공개·AI 비밀정보 차단·한방 상한·불변성",()=>{
  const player=buildFighter("B001",30,[],{element:"rush",moves:["T01","C04"],weakTag:"scent",resistTag:"gaze"});
  const opponent=buildFighter("B002",30,[],{element:"trick",weakTag:"contact",resistTag:"sound"});
  assert.equal(affinity(MOVE_BY_ID.T01,player,opponent),1.3*1.06);
  assert.equal(affinity(MOVE_BY_ID.T01,player,opponent,true),1.3);
  const hidden=previewDamage(MOVE_BY_ID.T01,player,opponent);
  assert.deepEqual(hidden,previewDamage(MOVE_BY_ID.T01,player,{...opponent,weakTag:"scent"}));
  const state=createBattle({seed:2,player,opponent}); state.opponentAction=rest;
  let result;
  for(let rng=0;rng<50;rng++) {result=stepRound({...state,rng},move("T01"));if(result.events.some(e=>e.type==="reveal"))break;}
  assert.equal(result.events.filter(e=>e.type==="reveal").length,1);
  assert.equal(state.opponent.knownWeakTag,undefined);
  assert.equal(result.state.opponent.knownWeakTag,true);
  assert.ok(!stepRound({...result.state,opponentAction:rest},move("T01")).events.some(e=>e.type==="reveal"));
  for(const tier of Object.keys(AI_TIERS)) for(let rng=0;rng<30;rng++) {
    const a={...state,rng}, b={...state,rng,player:{...state.player,weakTag:"trick",resistTag:"multi"}};
    assert.deepEqual(chooseAction(a,tier),chooseAction(b,tier));
  }
  for(const m of [...MOVES,...FINISHERS].filter(m=>m.kind==="attack")) {
    const a={...state.player,mastery:{[m.id]:5},buffs:[{stat:"attack",rate:10,expires:10}],charging:m.id};
    const d={...state.opponent,hp:100000,stats:{...state.opponent.stats,hp:100},knownWeakTag:true};
    const hits=m.hits??1, limit=m.finisher||m.mode==="charge"?.5:.35;
    assert.ok(damageAt(m,a,d,1.05,1,100)*hits<=Math.floor(d.stats.hp*limit));
  }
  for(const options of [{element:"bad"},{weakTag:"bad"},{weakTag:"sound",resistTag:"sound"},{aiTier:"bad"},{knownWeakTag:1}]) assert.throws(()=>buildFighter("B001",10,[],options));
});

test("AI 등급·예고·소유 소모품·공개 대응·충전 고정",()=>{
  assert.deepEqual(Object.values(AI_TIERS).map(t=>t.mistake),[.3,.15,.05,.01,0]);
  const fighter=buildFighter("B001",100,[],{element:"rush",items:["P03","P05"],owned:true});
  let state=createBattle({seed:3,player:fighter,opponent:fighter});
  state.opponent.hp=30;state.opponent.energy=0;
  assert.ok(Array.from({length:100},(_,rng)=>chooseAction({...state,rng},"king").action).some(a=>a.kind==="item"));
  state.opponent.owned=false;
  assert.ok(Array.from({length:100},(_,rng)=>chooseAction({...state,rng},"king").action).every(a=>a.kind!=="item"));
  state=createBattle({seed:3,player:fighter,opponent:fighter});
  const before=structuredClone(state), results=new Set(); let obscured=false;
  for(let rng=0;rng<200;rng++) {
    const pick=chooseAction({...state,rng},"boss",move("T31"));
    assert.ok(availableActions(state,"opponent").some(a=>JSON.stringify(a)===JSON.stringify(pick.action)));
    if(pick.hint?.obscured) {assert.ok(pick.hint.clue);obscured=true;}
    results.add(JSON.stringify(pick.action));
  }
  assert.ok(obscured);assert.ok(results.size>1);assert.deepEqual(state,before);
  state.opponent.charging="C01";
  for(const tier of Object.keys(AI_TIERS)) assert.deepEqual(chooseAction(state,tier).action,{kind:"move",moveId:"C01",phase:"release"});
  state.opponent.guaranteedCritical=true;state.opponent.survivalUsed=true;
  const restarted=createBattle({seed:3,player:state.player,opponent:state.opponent});
  assert.equal(restarted.opponent.charging,undefined);
  assert.equal(restarted.opponent.guaranteedCritical,undefined);
  assert.equal(restarted.opponent.survivalUsed,undefined);
});

test("신규 공격 개별 피해·기력 효율 ±35% 및 동일 기운 단조성",()=>{
  const fixtures=BREEDS.map(b=>buildFighter(b.id,60));
  const rows=MOVES.filter(m=>m.id.startsWith("M")&&m.kind==="attack").map(m=>{
    let damage=0;
    for(const a of fixtures) for(const d of fixtures) {
      // Break moves are measured in their intended guarding matchup; the ordinary penalty is tested separately.
      const target=m.breaksDefense?{...d,defense:{kind:"guard",expires:1,strength:1}}:d;
      damage+=damageAt(m,a,target,1)*(m.hits??1);
    }
    return {m,damage:damage/144};
  });
  for(const {m,damage} of rows) {
    const peers=rows.filter(r=>r.m.energy===m.energy), average=peers.reduce((s,r)=>s+r.damage,0)/peers.length;
    assert.ok(damage>=average*.65&&damage<=average*1.35,`${m.id}: ${damage/average}`);
    const efficiency=damage/Math.max(1,m.energy), meanEfficiency=average/Math.max(1,m.energy);
    assert.ok(efficiency>=meanEfficiency*.65&&efficiency<=meanEfficiency*1.35);
  }
  const plain=MOVES.filter(m=>m.kind==="attack"&&m.mode==="normal"&&!m.status&&!m.buff&&!m.priority&&!m.breaksDefense);
  const neutral=buildFighter("B001",60), stats={hp:10000,attack:100,defense:100,speed:100,focus:100,calm:100};
  const control={...neutral,stats,baseStats:stats,element:"rush"};
  for(const a of plain) for(const b of plain) if(a.energy>b.energy) {
    assert.ok(damageAt({...a,group:"neutral"},control,control,1)>damageAt({...b,group:"neutral"},control,control,1),`${a.id}/${b.id}`);
  }
});
