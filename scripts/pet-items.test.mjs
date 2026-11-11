import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadTS } from "./pet-test-loader.mjs";
const {createKingMock}=loadTS("tests/pet/king-mock.ts"), {createKingApi}=loadTS("lib/domine/pet-king-rpc.ts");
const {createKingBattle}=loadTS("lib/domine/pet-king-client.ts"), {spawnsFor}=loadTS("lib/domine/pet-battle-view.ts");
const {selectedItems,purchaseReason,itemEffect}=loadTS("lib/domine/pet-king-items.ts");
const {CONSUMABLES}=loadTS("lib/domine/battle/data.ts"), {buildFighter,createBattle,stepRound,chooseAction}=loadTS("lib/domine/battle/engine.ts");
const {itemUnavailable}=loadTS("lib/domine/battle/rules.ts");
const {PET_WORLD}=loadTS("lib/domine/pet-world.ts");
const identity={nickname:"김경석",secret:"a".repeat(64)},id=()=>crypto.randomUUID();
function fixture(coins=500) {const mock=createKingMock({coins});mock.register(identity);const api=createKingApi(mock.rpc);return {mock,api,encounter:PET_WORLD.flatMap(c=>spawnsFor(c.id,1,mock.slot())).find(e=>e.level<=8)};}

test("14종 가격·효과·3종 선택·서버 보유 상한과 예약 포함·코인 부족",async()=>{
  const {mock,api,encounter}=fixture();
  assert.equal(CONSUMABLES.length,14);CONSUMABLES.forEach(i=>assert.ok(i.price>0&&itemEffect(i)));
  assert.deepEqual(selectedItems(["P01","P01","P02","bad","P03","P04"],{P01:3,P02:1,P03:1,P04:1}),["P01","P02","P03"]);
  const bought=await api.buyItem(identity,id(),{pet:1,item:"P01",quantity:9});assert.equal(bought.data.wallet.coins,365);assert.equal(bought.data.inventory.P01,9);
  const session=createKingBattle(api,identity,1,encounter,["P01"]);await session.start();
  assert.equal((await api.buyItem(identity,id(),{pet:1,item:"P01",quantity:1})).code,"INVENTORY_CAP");
  assert.equal(mock.inspect().coins,365);
  const current=(await api.state(identity)).data;assert.match(purchaseReason(current,1,"P01"),/9/);
  const poor=fixture(0);assert.equal((await poor.api.buyItem(identity,id(),{pet:1,item:"P01",quantity:1})).code,"INSUFFICIENT_COINS");assert.equal(poor.mock.inspect().coins,0);
  assert.match(purchaseReason((await poor.api.state(identity)).data,1,"P01"),/15코인/);
  assert.throws(()=>createKingBattle(api,identity,1,encounter,["P01","P02","P03","P04"]));
});

test("예약·실제 사용 1개 정산·미사용 반환·이른 정산은 같은 결과로 재시도",async()=>{
  for(const failure of [false,true]) {
    const {api,mock,encounter}=fixture();
    for(const item of ["P01","P04"]) await api.buyItem(identity,id(),{pet:1,item,quantity:3});
    const session=createKingBattle(api,identity,1,encounter,["P01","P04"]);await session.start();
    if(!failure) mock.advance(10000);
    const result=await session.finish({outcome:"lose",rounds:2,usedItems:{P01:1}});
    assert.equal(!!result.settlement,!failure);
    if(failure) {
      assert.equal(mock.inspect().pets[1].inventory.P01,2);assert.equal(mock.inspect().pets[1].inventory.P04,2);
      mock.advance(10000);
      assert.ok((await session.finish({outcome:"lose",rounds:2,usedItems:{P01:1}})).settlement);
    }
    assert.equal(mock.inspect().pets[1].inventory.P01,2);assert.equal(mock.inspect().pets[1].inventory.P04,3);
  }
});

test("오프라인 시작은 서버 수량 불변·물품 사용은 한 라운드 행동·AI 주인과 등급",async()=>{
  const {api,mock,encounter}=fixture();await api.buyItem(identity,id(),{pet:1,item:"P06",quantity:2});
  const broken={...api,start:async()=>{throw Error("offline");}};
  await createKingBattle(broken,identity,1,encounter,["P06"]).finish({outcome:"lose",rounds:2,usedItems:{P06:1}});
  assert.equal(mock.inspect().pets[1].inventory.P06,2);
  let state=createBattle({seed:1,player:buildFighter("B001",10,[],{items:["P01","P04","P06"]}),opponent:buildFighter("B002",10,[],{items:["P05"]})});
  assert.match(itemUnavailable(state,"player","P01"),/체력이 가득/);assert.match(itemUnavailable(state,"player","P04"),/기력이 가득/);
  state.opponentAction={kind:"rest"};const used=stepRound(state,{kind:"item",itemId:"P06"});
  assert.equal(used.state.round,2);assert.equal(used.events.filter(e=>e.type==="action"&&e.side==="player").length,1);assert.match(itemUnavailable(used.state,"player","P06"),/이미 사용/);
  state.opponent.energy=0;
  for(const owned of [false,true]) for(const tier of ["gentle","normal","veteran","boss","king"]) {
    state.opponent.owned=owned;
    const picks=Array.from({length:32},(_,rng)=>chooseAction({...state,rng},tier).action);
    assert.equal(picks.some(a=>a.kind==="item"),owned&&["boss","king"].includes(tier));
  }
});

test("v20 SQL ASCII·변수·스키마·상한·응답과 트랜잭션",()=>{
  const sql=readFileSync("supabase/migrations/20261112400000_domine_pet_v20_items.sql","utf8");
  assert.doesNotMatch(sql,/[^\x00-\x7f]/);assert.match(sql,/^begin;/);assert.match(sql,/commit;\s*$/);
  assert.doesNotMatch(sql,/\bdrop\s+(table|function|schema|constraint)\b/i);
  assert.doesNotMatch(sql,/\bdomine_pet_king_v17\.v_\w+/);
  assert.doesNotMatch(sql,/\b(from|join|update|into)\s+(inventory|pet_progress|battle_ticket|pool|item_price)\b/i);
  assert.match(sql,/set search_path=''/);assert.match(sql,/INVENTORY_CAP/);assert.match(sql,/'progress',domine_pet_v17.pet_state/);assert.match(sql,/'wallet'/);
  assert.match(sql,/v_total>3/);assert.match(sql,/NON_ASCII/);assert.match(sql,/QUALIFIED_LOCAL/);assert.match(sql,/UNQUALIFIED_TABLE/);
});
