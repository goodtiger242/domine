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
assert.deepEqual(rewardDisplay({xp:8,coins:4,levelCoins:14}),{xp:8,coins:18,quiet:false,notice:""});
assert.deepEqual(rewardDisplay(),{xp:0,coins:0,quiet:true,notice:""});
for (const [skipped, notice] of [["TOO_FAST","조금 천천히 눌러 주세요"],["DAILY_CAP","오늘 보상은 모두 받았어요"]]) {
  assert.deepEqual(rewardDisplay({xp:0,coins:0,levelCoins:0,skipped}),{xp:0,coins:0,quiet:true,notice});
}
assert.equal(rewardEligible(3000,0,119),true);
assert.equal(rewardEligible(2999,0,0),false);
assert.equal(rewardEligible(60000,0,120),false);
assert.equal(rewardEligible(0,null,0),true);
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
s=reduce(s,{type:"resume"}); s=reduce(s,{type:"map",map:"D5",id:4});
assert.equal(s.committedMap,"E5"); assert.equal(reduce(s,{type:"map-ready",id:3}),s);
s=reduce(s,{type:"map-ready",id:4}); assert.equal(s.committedMap,"D5"); assert.equal(s.visual,"switching-map");
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
const skippedCommand={...command,action:"play",requestId:"reward-zero"};
const skippedReward=await mock.api.execute(identity,skippedCommand);
assert.equal(skippedReward.reward.coins,0); assert.equal(skippedReward.reward.skipped,"TOO_FAST");
mock.advance(2999);
assert.equal((await mock.api.execute(identity,{...command,requestId:"before-boundary"})).reward.skipped,"TOO_FAST");
mock.advance(1);
assert.equal((await mock.api.execute(identity,{...command,requestId:"reward-next"})).reward.coins,4,"same action pays again after 3 seconds");
assert.deepEqual(await mock.api.execute(identity,skippedCommand),skippedReward,"replaying a skipped action cannot pay later");
for(let n=2;n<120;n++) {
  mock.advance(3000);
  assert.equal((await mock.api.execute(identity,{...command,requestId:`daily-${n}`})).reward.coins,4);
}
assert.equal(mock.state().daily.reward_actions,120);
const cappedCoins=mock.state().player.coins;
mock.advance(3000);
assert.equal((await mock.api.execute(identity,{...command,requestId:"daily-cap"})).reward.skipped,"DAILY_CAP");
assert.equal(mock.state().player.coins,cappedCoins);
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
const v7=readFileSync("supabase/migrations/20261111210000_domine_pet_v7.sql","utf8");
assert.ok(v7.trim().endsWith("commit;")); assert.equal((v7.match(/^begin;/gm)||[]).length,1);
assert.ok(!/\b(drop|truncate|delete\s+from)\b/i.test(v7));
assert.match(v7,/on conflict\(id\) do nothing;\s+if found then/);
assert.match(v7,/least\(9280,coalesce\(sum\(xp\),0\)\).*coalesce\(sum\(coins\),0\)/);
assert.match(v7,/distinct on \(e.pet_id,e.slot\)/);
assert.match(v7,/o.payload_hash=extensions.digest\(jsonb_build_object\('pet',e.pet_id,'slot',e.slot,'item',e.item_id\)/);
const commandSQL=v7.slice(v7.indexOf("create or replace function domine_pet_v6.command_v6"));
const poolLock=commandSQL.indexOf("select * into strict wallet from domine_pet_v7.pool where id=1 for update");
assert.ok(poolLock>commandSQL.indexOf("from domine_pet_v6.player where nickname_key="));
assert.ok(poolLock<commandSQL.indexOf("wallet.coins<item.price"));
assert.ok(poolLock<commandSQL.indexOf("old_level:=domine_pet_v6.level_v6(wallet.xp)"));
assert.ok(!/update domine_pet_v6.player set (xp|coins)|domine_pet_v6\.(inventory|equipment|daily)/.test(commandSQL));
assert.ok(!/last_reward_at>now\(\)-interval '(10|60) seconds'/.test(commandSQL));
assert.equal((v7.match(/\(op.result->>'version'\)::bigint<=p.version/g)||[]).length,2,"command retries and operation lookups replace pre-pool snapshots");
assert.match(v7,/\(result->>'version'\)::bigint<=p.version/ ,"completed pre-pool tickets cannot replay personal balances");
for(const rule of ["day.reward_actions>=120", "interval '3 seconds'", "day.explore_starts>=60", "day.explore_finishes<30", "day.walk_claims>=4", "interval '150 seconds'", "sum(10+2*g)", "'skipped',skipped"]) assert.ok(commandSQL.includes(rule),rule);
assert.equal((v7.match(/enable row level security/g)||[]).length,4);
for(const grant of sql.match(/^grant execute .+;$/gm)) assert.ok(v7.includes(grant));
const v7Snapshot=v7.slice(v7.indexOf("create or replace function domine_pet_v6.snapshot_v6"),v7.indexOf("create or replace function domine_pet_v6.badges_v6"));
const v6Snapshot=sql.slice(sql.indexOf("create or replace function domine_pet_v6.snapshot_v6"),sql.indexOf("create or replace function domine_pet_v6.badges_v6"));
const jsonKeys=(source)=>[...source.matchAll(/'([a-zA-Z_]+)',/g)].map(m=>m[1]);
assert.deepEqual(jsonKeys(v7Snapshot),jsonKeys(v6Snapshot),"snapshot JSON keys remain v6-compatible");
const { PET_WORLD, DEFAULT_CELL, DIRECTIONS, neighborCell, worldCell, savedCell, visitedCells } = loadTS("lib/domine/pet-world.ts");
const { PET_MAPS, mapBackground } = loadTS("lib/domine/pet-maps.ts");
assert.equal(PET_WORLD.length,100);
assert.equal(new Set(PET_WORLD.map(c=>c.id)).size,100);
assert.equal(PET_MAPS.length,24);
const opposites={n:"s",s:"n",e:"w",w:"e"};
for(const [i,cell] of PET_WORLD.entries()) {
  assert.equal(cell.id,`${String.fromCharCode(65+i%10)}${Math.floor(i/10)+1}`);
  assert.ok(PET_MAPS.some(m=>m.id===cell.theme));
  for(const dir of DIRECTIONS) {
    const neighbor=neighborCell(cell.id,dir);
    if(neighbor) assert.equal(neighborCell(neighbor.id,opposites[dir]).id,cell.id);
    const edge=dir==="n"?i<10:dir==="s"?i>=90:dir==="w"?i%10===0:i%10===9;
    assert.equal(neighbor===null,edge);
  }
}
assert.equal(DEFAULT_CELL,"E5");
assert.deepEqual(DIRECTIONS.map(d=>neighborCell("E5",d).id),["E4","E6","F5","D5"]);
assert.equal(neighborCell("bad","e"),null);
assert.equal(worldCell("A5").theme,"field"); assert.equal(worldCell("D5").theme,"home");
assert.equal(worldCell("F6").name,"당정동 상가 거리");
assert.deepEqual(PET_WORLD.filter(c=>c.theme==="church").map(c=>c.id),["F1","E5"]);
for(const [old,id] of Object.entries({church:"E5",home:"D5",field:"A5",street:"F6",park:"B1"})) assert.equal(savedCell(null,old),id);
for(const bad of ["", "K1", "A0", "A11", "bad"]) assert.equal(savedCell(bad,"home"),"E5");
assert.equal(savedCell(null,null),"E5"); assert.equal(savedCell(null,"bad"),"E5");
assert.equal(savedCell(null,"__proto__"),"E5"); assert.equal(savedCell(null,"toString"),"E5");
assert.equal(savedCell("J10","home"),"J10");
assert.deepEqual(visitedCells('["A1","A1","E5","bad",1,null]'),["A1","E5"]);
for(const bad of ["", "{}", "null", "[bad"]) assert.deepEqual(visitedCells(bad),[]);
// All source rows survive, apart from the three requested game overrides.
const rows=readFileSync("docs/pet-world-research.md","utf8").split("\n").map(l=>l.split("|").map(s=>s.trim().replaceAll("**",""))).filter(r=>/^[A-J](10|[1-9])$/.test(r[1]??""));
assert.equal(rows.length,100);
for(const row of rows) {
  const cell=worldCell(row[1]);
  if(["A5","D5","F6"].includes(cell.id)) continue;
  assert.equal(cell.theme,row[5]); assert.equal(cell.kind,row[3]);
  assert.equal(cell.name,cell.id==="E5"?"용호성당 마당":row[2].split(" — ")[0]);
}
for(const theme of PET_MAPS) for(const hour of [6,12,18,22]) {
  const file=readFileSync(`public${mapBackground(theme.id,hour)}`);
  assert.equal(file.toString("ascii",8,12),"WEBP");
}
// Reapply the SQL union locally; no database connection or writes.
const v8=readFileSync("supabase/migrations/20261111230000_domine_pet_v8.sql","utf8");
assert.match(v8,/^begin;/); assert.ok(v8.trim().endsWith("commit;"));
assert.ok(!/\b(create|alter|drop|truncate|delete|insert)\b/i.test(v8));
assert.match(v8,/c\.acquisition = 'explore'/);
assert.match(v8,/select distinct theme from unnest\(c\.maps \|\| a\.maps\)/);
const seeds=[...sql.matchAll(/\('([0-9]{3})','([^']*)','[^']*','([^']*)','explore',array\[([^\]]*)\]/g)].map(m=>({id:m[1],rarity:m[3],maps:m[4].match(/[^',]+/g)}));
const additions=[...v8.matchAll(/\('([0-9]{3})', array\[([^\]]*)\]\)/g)].map(m=>({id:m[1],maps:m[2].match(/[^',]+/g)}));
assert.ok(additions.length>0);
for(const a of additions) { assert.ok(seeds.some(s=>s.id===a.id)); for(const map of a.maps) assert.ok(PET_MAPS.some(m=>m.id===map)); }
const expand=items=>items.map(s=>({...s,maps:[...new Set([...s.maps,...(additions.find(a=>a.id===s.id)?.maps??[])])].sort()}));
const expanded=expand(seeds); assert.deepEqual(expand(expanded),expanded);
for(const seed of seeds) assert.ok(seed.maps.every(m=>expanded.find(e=>e.id===seed.id).maps.includes(m)));
for(const theme of PET_MAPS.slice(5)) {
  assert.ok(expanded.filter(s=>s.rarity==="일반"&&s.maps.includes(theme.id)).length>=2,theme.id);
  const explorer=createPetMock(); await explorer.api.register(identity);
  const ticket=await explorer.api.execute(identity,{kind:"explore_begin",map:theme.id,source:"map",requestId:"begin"});
  assert.equal(ticket.ticket.map_id,theme.id);
  explorer.advance(15000);
  const found=await explorer.api.execute(identity,{kind:"explore_finish",ticket:ticket.ticket.id,requestId:"finish"});
  assert.ok(expanded.some(s=>s.id===found.reward.newEntries[0]&&s.maps.includes(theme.id)));
}
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
