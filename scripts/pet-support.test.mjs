import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync,writeFileSync} from "node:fs";
import { loadTS } from "./pet-test-loader.mjs";
const { MOVES, MOVE_BY_ID, BREEDS, FINISHERS } = loadTS("lib/domine/battle/data.ts");
const { buildFighter, damageAt, hitChance, critChance, availableActions, effectiveStat } = loadTS("lib/domine/battle/rules.ts");
const { createBattle, stepRound } = loadTS("lib/domine/battle/engine.ts");
const { chooseAction, AI_TIERS } = loadTS("lib/domine/battle/ai.ts");
const { learnset } = loadTS("lib/domine/battle/learnset.ts");
const { powerBudget } = loadTS("lib/domine/battle/move-budget.ts");
const { supportScale, SUPPORT_ROLES } = loadTS("lib/domine/battle/support.ts");
const supports = MOVES.filter(m => m.kind === "support"), added = supports.filter(m => +m.id.slice(1) > 202);
const rest = { kind: "rest" }, action = m => ({ kind: "move", moveId: m.id });
function fixture(m, seed = 1, breed = "B001") {
  const fighter = buildFighter(breed,100,[],{ moves:[m.id], species:m.learn?.species ?? (m.id.startsWith("M") ? "dog" : "cat"), element:m.id === "T60" ? "guard" : m.group === "neutral" ? "rush" : m.group,
    ...(m.learn?.job ? {job:{id:m.learn.job,tier:3}} : {}) });
  const state = createBattle({seed,player:fighter,opponent:buildFighter("B002",100)});
  state.opponentAction = rest;
  return state;
}
const attack = cost => ({...MOVE_BY_ID.M010, group:"neutral", energy:cost, power:powerBudget(cost), status:undefined, buff:undefined});
const expected = (m,a,b,r) => { a={...a,statuses:a.statuses.filter(s=>s.expires>=r)}; b={...b,statuses:b.statuses.filter(s=>s.expires>=r)}; return damageAt(m,a,b,1,r) * hitChance(m,a,b,r)/100 * (1+critChance(a)/100*.5); };

test("보조 61개: 역할마다 공통·6기운·종, 설명·학습 증가·예산", () => {
  assert.equal(added.length,61);
  assert.equal(new Set(MOVES.map(m=>m.id)).size,MOVES.length);
  for (const role of SUPPORT_ROLES) for (const source of ["common","element","species"]) assert.ok(added.some(m=>m.support.role===role && m.source===source));
  for (const m of supports) { assert.equal(m.power,0); assert.ok(m.energy>=0 && m.energy<=6); assert.ok(m.description && m.fx && m.tags.length && m.learn); }
  const counts = [1,5,10,15,20,25,30,60].map(level=>learnset("dog","B001","bond",level).filter(id=>MOVE_BY_ID[id].kind==="support").length);
  counts.slice(1).forEach((n,i)=>assert.ok(n>counts[i],`${counts}`));
});

test("연속 체감 100/70/40%, 스탯 상한, 기세 한 판 60, 정화·면역", () => {
  const charge = added.find(m=>m.support.role==="energy");
  let state=fixture(charge);
  for (const [scale,amount] of [[1,3],[.7,2],[.4,1]]) {
    state.player.energy=0;state.opponentAction=rest;
    assert.equal(supportScale(state.player,charge.id),scale);
    const next=stepRound(state,action(charge));
    assert.equal(next.state.player.energy,amount);state=next.state;
  }
  state.opponentAction=rest;state=stepRound(state,rest).state; assert.equal(supportScale(state.player,charge.id),1);
  const buff=added.find(m=>m.support.role==="buff");state=fixture(buff);
  for(let i=0;i<3;i++) {state.player.energy=10;state.opponentAction=rest;state=stepRound(state,action(buff)).state;assert.ok(effectiveStat(state.player,buff.buff,state.round)<=Math.floor(state.player.stats[buff.buff]*1.3));}
  const momentum=added.find(m=>m.support.role==="momentum");state=fixture(momentum);
  for(let i=0;i<2;i++) {state.player.energy=10;state.opponentAction=rest;state=stepRound(state,action(momentum)).state;}
  assert.equal(state.player.momentum,60);assert.equal(state.player.momentumCharged,60);
  assert.ok(!availableActions(state,"player").some(a=>a.moveId===momentum.id));
  const heal=added.find(m=>m.support.role==="recover");state=fixture(heal);
  state.player.statuses=[{id:"blur",applied:1,expires:2}];state.player.buffs=[{stat:"attack",rate:-.2,expires:3}];
  const next=stepRound(state,action(heal));assert.deepEqual(next.state.player.statuses,[]);assert.deepEqual(next.state.player.buffs,[]);
  assert.equal(next.state.player.immunityUntil,1);
  const disrupt=added.find(m=>m.support.role==="disrupt");state=fixture(disrupt);state.opponent.immunityUntil=2;
  const blocked=stepRound(state,action(disrupt));assert.equal(blocked.state.opponent.buffs.length,0);assert.equal(blocked.state.opponent.statuses.length,0);
});

test("보조의 조건부 평균 피해 환산: 실제 적용 상태와 3라운드 후속 효과", () => {
  const rows=[];
  for(const m of supports) {
    const values=[];
    for(const breed of BREEDS.slice(0,6)) {
      let before; try { before=fixture(m,17,breed.id); } catch(e) { throw new Error(`${m.id}/${breed.id}: ${e.message}`); }before.player.hp=Math.floor(before.player.stats.hp*.35);before.player.energy=6;
      before.opponent.history=[{kind:"push"},{kind:"push"}];before.opponent.lastAction={kind:"push"};
      if(m.support.cleanse) before.player.statuses=[{id:"blur",applied:1,expires:2}];
      const after=stepRound(before,action(m)).state, a=after.player,b=after.opponent;
      const strike=attack(3), base=expected(attack(m.energy),before.player,before.opponent,1);
      let value=a.hp-before.player.hp;
      for(let round=2;round<=4;round++) {
        const active={...a,prepared:round===2?a.prepared:undefined};
        value+=expected(strike,active,b,round)-expected(strike,before.player,before.opponent,round);
        value+=expected(strike,before.opponent,before.player,round)-expected(strike,b,active,round);
      }
      const energyValue=expected(attack(4),a,b,2)-expected(strike,a,b,2);
      value+=(m.support.restore??0)*energyValue+(a.discount??0)*energyValue;
      value+=(a.momentum??0)/100*expected(FINISHERS[0],a,b,2);
      value+=(a.prepared?.guard??0)*.6*expected(strike,b,a,2);
      value+=(a.prepared?.read??0)*(expected(strike,b,a,2)+expected(strike,a,b,2)*.35);
      values.push(value/base);
    }
    rows.push({id:m.id,role:m.support.role,cost:m.energy,ratio:values.reduce((a,b)=>a+b)/values.length});
  }
  if(process.env.SUPPORT_REPORT==="1") {
    const roles={energy:"충전",buff:"강화",disrupt:"약화·교란",recover:"회복·정화",prepare:"준비·연계",read:"정보·심리전",momentum:"기세"};
    const lines=["| ID | 기술 | 역할 | 기력 | 효과·지속 | 같은 비용 공격 대비 가치 |","|---|---|---|---:|---|---:|",...rows.map(row=>{
      const m=MOVE_BY_ID[row.id];return `| ${m.id} | ${m.name} | ${roles[row.role]} | ${m.energy} | ${m.description} | ${(row.ratio*100).toFixed(1)}% |`;
    })];
    const path="docs/pet-battle-sim.md",block=`<!-- support-audit:start -->\n${lines.join("\n")}\n<!-- support-audit:end -->`,doc=readFileSync(path,"utf8");
    writeFileSync(path,doc.includes("<!-- support-audit:start -->")?doc.replace(/<!-- support-audit:start -->[\s\S]*?<!-- support-audit:end -->/,block):doc+"\n"+block+"\n");
  }
  for(const row of rows) assert.ok(row.ratio >= .65 && row.ratio <= 1.35, `${row.id}: ${row.ratio}`);
  console.log("보조 가치", JSON.stringify(Object.fromEntries(SUPPORT_ROLES.map(role=>{const v=rows.filter(r=>r.role===role).map(r=>r.ratio);return [role,{min:Math.min(...v),mean:v.reduce((a,b)=>a+b)/v.length,max:Math.max(...v)}];}))));
});

test("모든 AI 등급의 보조 사용·보조만 사용 승률 55% 이하", () => {
  const charge=added.find(m=>m.support.role==="energy");
  for(const tier of Object.keys(AI_TIERS)) {
    const state=fixture(charge);[state.player,state.opponent]=[state.opponent,state.player];state.opponent.energy=0;
    assert.ok(Array.from({length:32},(_,rng)=>chooseAction({...state,rng},tier).action).some(a=>a.moveId===charge.id),tier);
  }
  let wins=0,total=0;
  for(const m of added.filter(m=>m.source==="common")) for(const tier of Object.keys(AI_TIERS)) for(let seed=0;seed<16;seed++) {
    let state=fixture(m,seed);state.aiTier=tier;
    while(!state.outcome) {
      state.opponentAction=chooseAction(state,tier).action;
      const actions=availableActions(state,"player"), use=actions.find(a=>a.kind==="move" && MOVE_BY_ID[a.moveId]?.kind==="support");
      state=stepRound(state,use??rest).state;
    }
    wins+=state.outcome==="player";total++;
  }
  console.log(`보조만 사용 ${wins}/${total} = ${(wins/total*100).toFixed(2)}%`);assert.ok(wins/total<=.55);
});



test("노련 AI 회복·정화·강화 감지와 실제 조우의 보조 장착",()=>{
  for(const role of ["recover","buff","prepare","disrupt"]) {
    const m=added.find(m=>m.source==="common"&&m.support.role===role),state=fixture(m);
    [state.player,state.opponent]=[state.opponent,state.player];
    if(role==="recover") {state.opponent.hp=Math.floor(state.opponent.stats.hp*.2);state.opponent.statuses=[{id:"blur",applied:1,expires:3}];}
    if(role==="disrupt") state.player.buffs=[{stat:"attack",rate:.2,expires:3}];
    assert.ok(Array.from({length:32},(_,rng)=>chooseAction({...state,rng},"veteran").action).some(a=>a.moveId===m.id),role);
  }
  const {spawnsFor}=loadTS("lib/domine/pet-battle-view.ts"),{PET_WORLD}=loadTS("lib/domine/pet-world.ts");
  const encounters=PET_WORLD.flatMap(c=>spawnsFor(c.id,30,100));assert.ok(encounters.length);
  for(const e of encounters) assert.ok(e.fighter.moves.some(id=>MOVE_BY_ID[id]?.kind==="support"));
});
