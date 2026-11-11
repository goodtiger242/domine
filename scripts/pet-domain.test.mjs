import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { loadTS } from "./pet-test-loader.mjs";
const { levelOf, levelXP, progressOf, rewardEligible, rewardDisplay } = loadTS("lib/domine/pet-progress.ts");
const { normalizeNickname, parseTransfer, createSecret } = loadTS("lib/domine/pet-identity.ts");
const { gameReducer: reduce, initialMachine, visualLocked } = loadTS("lib/domine/pet-machine.ts");
const { SAFE_ZONES, actorBounds, clampActor, buildBallPath, sampleBall } = loadTS("lib/domine/pet-geometry.ts");
const { buildScenePlan, sampleScenePlan } = loadTS("lib/domine/pet-scene-plan.ts");
const { CATALOG, SHOP, ACHIEVEMENTS } = loadTS("lib/domine/pet-catalog.ts");
const { createPetApi, acceptsResult } = loadTS("lib/domine/pet-rpc.ts");
for (let l = 2; l <= 30; l++) {
  assert.equal(levelOf(levelXP(l)-1), l-1); assert.equal(levelOf(levelXP(l)), l); assert.equal(levelOf(levelXP(l)+1), l);
  assert.equal(levelXP(l)-levelXP(l-1), 20*l);
}
assert.equal(levelOf(-1),1); assert.equal(levelOf(99999),30); assert.equal(levelOf(700),8);
assert.deepEqual(progressOf(99999),{ level:30,value:9280,current:0,needed:0 });
assert.deepEqual(rewardDisplay({xp:8,coins:4,levelCoins:14}),{xp:8,coins:18,quiet:false});
assert.deepEqual(rewardDisplay(),{xp:0,coins:0,quiet:true});
assert.equal(rewardEligible(60000,0,50000,39),true);
for (const [last, any, daily] of [[1,0,0],[0,50001,0],[0,0,40]]) assert.equal(rewardEligible(60000,last,any,daily),false);
assert.equal(rewardEligible(0,null,null,0),true);
for (const raw of ["", "아".repeat(9),"!!!","a:b","a b"]) assert.equal(normalizeNickname(raw),null);
assert.equal(normalizeNickname(" 가나 "),"가나"); assert.equal(normalizeNickname("가".normalize("NFD")),"가");
assert.equal(normalizeNickname("a".repeat(8)),"aaaaaaaa");
assert.match(createSecret(),/^[0-9a-f]{64}$/); assert.notEqual(createSecret(),createSecret());
assert.equal(parseTransfer("Nick:"+"a".repeat(64)).nickname,"Nick");
assert.equal(parseTransfer("Nick:"+"A".repeat(64)),null); assert.equal(parseTransfer("x:y:z"),null);
let s=reduce(initialMachine,{type:"act",id:1,now:100,duration:2400});
assert.equal(s.deadlineAt,3000); assert.ok(visualLocked(s));
assert.equal(reduce(s,{type:"done",id:0}),s);
s=reduce(s,{type:"done",id:1}); assert.equal(s.visual,"idle"); assert.equal(reduce(s,{type:"done",id:1}),s);
s=reduce(s,{type:"act",id:2,now:0,duration:1500}); s=reduce(s,{type:"done",id:2,sleep:true});
assert.equal(s.visual,"sleeping"); assert.ok(!visualLocked(s));
s=reduce(s,{type:"act",id:3,now:0,duration:1800}); assert.equal(s.visual,"acting");
s=reduce(s,{type:"request",id:"one"}); s=reduce(s,{type:"uncertain",id:"one"});
assert.equal(s.command,"uncertain"); assert.equal(reduce(s,{type:"request",id:"two"}),s);
assert.equal(reduce(s,{type:"settled",id:"two"}),s); s=reduce(s,{type:"settled",id:"one"});
s=reduce(s,{type:"pause"}); assert.equal(s.epoch,1); assert.equal(s.visual,"paused");
s=reduce(s,{type:"resume"}); s=reduce(s,{type:"map",map:"home",id:4});
assert.equal(s.committedMap,"church"); assert.equal(reduce(s,{type:"map-ready",id:3}),s);
s=reduce(s,{type:"map-ready",id:4}); assert.equal(s.committedMap,"home"); assert.equal(s.visual,"switching-map");
s=reduce(s,{type:"done",id:4}); assert.equal(s.visual,"idle");
const actions=["feed","treat","pet","play","walk","brush","bath","train","tap","priest"];
let plans=0;
for (const [map, zone] of Object.entries(SAFE_ZONES)) for (const scale of [1,.72]) for (const width of [18,22,26]) for (const action of actions) for (let seed=1;seed<=20;seed++) {
  let x=seed; const random=()=>((x=(x*1664525+1013904223)>>>0)/2**32);
  const w=width*scale*(map==="church"?.85:1), bounds=actorBounds(w);
  const plan=buildScenePlan({action,id:1},{map,width:w,ratio:.76},random);
  assert.ok(plan.durationMs<=4500);
  for (const f of [...plan.keyframes,{pose:plan.finalPose}]) {
    assert.ok(f.pose.x+bounds.left>=zone.left-1e-9 && f.pose.x+bounds.right<=zone.right+1e-9);
    assert.ok(f.pose.y>=zone.top && f.pose.y+bounds.bottom<=zone.bottom);
    if (f.pose.ball) assert.ok(f.pose.ball.x>=6.2 && f.pose.ball.x<=153.8 && f.pose.ball.y>=18 && f.pose.ball.y<=80.8);
  }
  for(let t=0;t<=plan.durationMs;t+=125) assert.ok(Number.isFinite(sampleScenePlan(plan,t).x));
  assert.deepEqual(sampleScenePlan(plan,plan.durationMs),plan.finalPose); plans++;
}
for (const zone of Object.values(SAFE_ZONES)) for (const x of [-100,80,999]) {
  const p=clampActor({x,y:999},actorBounds(26),zone); assert.ok(p.x-24.8>=zone.left-1e-9 && p.x+24.8<=zone.right+1e-9);
}
const path=buildBallPath({x:-100,y:-100},{x:999,y:999});
for(let t=0;t<=1;t+=.025) { const p=sampleBall(path,t); assert.ok(p.x>=6.2-1e-9 && p.x<=153.8 && p.y>=18 && p.y<=80.8); }
assert.equal(CATALOG.length,96); assert.equal(new Set(CATALOG.map(i=>i.id)).size,96);
assert.deepEqual(CATALOG.map(i=>i.id),Array.from({length:96},(_,i)=>String(i+1).padStart(3,"0")));
assert.equal(SHOP.length,20); assert.equal(SHOP.filter(i=>i.slot==="wearable").length,12);
assert.equal(CATALOG.filter(i=>i.core).length,80); assert.equal(CATALOG.filter(i=>i.storage==="device").length,4);
for(const i of CATALOG) { assert.ok(i.name && i.condition && i.category); if(i.price!==null) assert.ok(Number.isInteger(i.price)&&i.price>0&&i.slot&&i.asset); else assert.equal(i.slot,null); }
assert.deepEqual(SHOP.map(i=>i.price),[40,60,80,100,120,140,180,200,240,260,320,400,40,60,80,120,160,180,240,360]);
assert.equal(ACHIEVEMENTS.length,30); assert.equal(new Set(ACHIEVEMENTS.map(i=>i.id)).size,30);
let bytes=0;
for(const i of SHOP) { const path=`public${i.asset}`; bytes+=statSync(path).size; assert.equal(readFileSync(path).toString("ascii",8,12),"WEBP"); }
assert.ok(bytes<=180000); assert.equal(readdirSync("public/pet/catalog").length,20);
const calls=[]; let response;
const api=createPetApi(async(name,args)=>{calls.push({name,args});return response;});
response={data:null,error:{code:"PGRST202",message:"missing"}}; assert.equal(await api.capabilities(),false);
for(const code of ["42501","500","NETWORK_ERROR"]) {response={data:null,error:{code,message:"error"}}; await assert.rejects(api.capabilities());}
response={data:{version:6},error:null};assert.equal(await api.capabilities(),true);
const identity={nickname:"테스트",secret:"a".repeat(64)};
const command={kind:"action",pet:2,action:"feed",requestId:"00000000-0000-4000-8000-000000000001"};
response={data:{ok:true,code:"OK",serverNow:"2026-11-11T00:00:00Z",version:1,player:{xp:8,level:1,coins:4}},error:null};
await api.execute(identity,command); await api.execute(identity,command);
assert.deepEqual(calls.at(-1),calls.at(-2)); assert.equal(calls.at(-1).name,"domine_pet_action_v6");
assert.equal(calls.at(-1).args.p_pet,2); assert.ok(!("xp" in calls.at(-1).args));
await api.execute(identity,{kind:"equip",pet:1,slot:"wearable",item:null,requestId:command.requestId}); assert.equal(calls.at(-1).args.p_item,null);
await api.operation(identity,command.requestId); assert.equal(calls.at(-1).name,"domine_pet_operation_v6");
const controller=new AbortController(); let receivedSignal;
const abortable=createPetApi(async(_name,_args,signal)=>{receivedSignal=signal;return response;});
await abortable.register(identity,controller.signal); assert.equal(receivedSignal,controller.signal);
await abortable.state(identity,2,controller.signal); assert.equal(receivedSignal,controller.signal);
response={data:null,error:{code:"PGRST202",message:"missing"}};
const before=calls.length; await assert.rejects(api.execute(identity,command)); assert.equal(calls.length,before+1,"v6 mutation errors never replay through legacy");
assert.equal(acceptsResult({version:8},{version:7,player:{}}),false); assert.equal(acceptsResult({version:8},{version:8,player:{}}),true);
assert.equal(acceptsResult({version:8},{version:9}),false);
const { createPetMock } = loadTS("tests/pet/rpc-mock.ts");
const mock=createPetMock(); await mock.api.register(identity);
const paid=await mock.api.execute(identity,command);
assert.equal(paid.player.level,2); assert.equal(paid.player.coins,118); assert.equal(paid.reward.levelCoins,14);
const replay=await mock.api.execute(identity,command); assert.deepEqual(replay,paid); assert.equal(mock.state().player.coins,118);
assert.equal((await mock.api.execute(identity,{...command,action:"walk"})).code,"REQUEST_CONFLICT");
assert.equal((await mock.api.state({...identity,secret:"b".repeat(64)},1)).code,"AUTH_FAILED");
assert.equal((await mock.api.execute(identity,{...command,requestId:"reward-zero"})).reward.coins,0);
mock.advance(60000); assert.equal((await mock.api.execute(identity,{...command,requestId:"reward-next"})).reward.coins,4);
const wallet=createPetMock();await wallet.api.register(identity);
const buys=await Promise.all(["062","063"].map(item=>wallet.api.execute(identity,{kind:"purchase",item,requestId:item})));
assert.equal(buys.filter(r=>r.ok).length,1); assert.equal(wallet.state().player.coins,40);
await wallet.api.execute(identity,{kind:"equip",pet:1,slot:"wearable",item:"062",requestId:"equip"});
assert.equal(wallet.state().equipment[0].item_id,"062");assert.ok(!wallet.state().equipment.some(e=>e.pet_id===2));
assert.equal((await wallet.api.execute(identity,{kind:"purchase",item:"062",requestId:"repeat-purchase"})).code,"ALREADY_OWNED");
assert.equal(wallet.state().player.coins,40);

const sql=readFileSync("supabase/migrations/20261111180000_domine_pet_v6.sql","utf8");
assert.ok(sql.trim().endsWith("commit;")); assert.equal((sql.match(/^begin;/gm)||[]).length,1);
assert.ok(!/\b(drop\s+table|truncate|delete\s+from|execute\s+format)\b/i.test(sql));
assert.equal((sql.match(/create table if not exists domine_pet_v6\./g)||[]).length,13);
assert.equal((sql.match(/enable row level security/g)||[]).length,13);
assert.equal((sql.match(/create or replace function public\.domine_pet_/g)||[]).length,13);
for(const item of CATALOG) assert.ok(sql.includes(`('${item.id}','${item.name}'`));
assert.ok(sql.includes("date_trunc('hour',now()),60")); assert.ok(sql.includes("'Asia/Seoul',300"));
assert.ok(!/last_submit_at\s*>/.test(sql),"No per-player care submission cooldown");
assert.ok(sql.includes("pg_advisory_xact_lock(20261111,120000)"));
assert.ok(sql.includes("payload_hash<>payload")); assert.ok(sql.includes("ticket.finished_at is not null"));
assert.ok(sql.includes("c.slot=command_v6.slot"));
const alpha=spawnSync("python",["-c",`
import tempfile,subprocess
from pathlib import Path
from PIL import Image,ImageDraw
with tempfile.TemporaryDirectory() as d:
 p=Path(d); im=Image.new('RGBA',(100,50)); draw=ImageDraw.Draw(im)
 draw.rectangle((10,10,40,40),fill=(255,255,255,255));draw.ellipse((60,10,90,40),fill=(255,0,255,128));im.save(p/'sheet.png')
 subprocess.run(['python','scripts/cut_sheet.py',str(p/'sheet.png'),str(p/'out'),'white,purple','--cols','2','--rows','1'],check=True,capture_output=True)
 for name in ['white','purple']:
  a=Image.open(p/'out'/f'{name}.webp').convert('RGBA').getchannel('A');assert a.getextrema()[1]>0
 assert Image.open(p/'out/purple.webp').getchannel('A').getextrema()[1]<255
`],{encoding:"utf8"}); assert.equal(alpha.status,0,alpha.stderr);
console.log(`Pet domain: level edges, rewards, identity, reducer, ${plans} safe plans, RPC fallback/replay, catalog/SQL contracts and transparent cut passed (${bytes} image bytes).`);
