import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { loadTS } from "./pet-test-loader.mjs";
const require=createRequire(import.meta.url), {webpack}=require("next/dist/compiled/webpack/webpack");
const run=promisify(execFile);
const executable=process.env.AGENT_BROWSER_EXECUTABLE ?? join(process.env.APPDATA??"", "npm/node_modules/agent-browser/bin/agent-browser-win32-x64.exe");

// Slow real-browser regression (needs agent-browser): run it with PET_BROWSER_TESTS=1. The default suite stays fast and deterministic.
test("실제 브라우저: 상점 구매·3종 반입·사용·정산과 390/360/1600 좌표", {timeout:35000, skip:process.env.PET_BROWSER_TESTS?false:"set PET_BROWSER_TESTS=1 to run the real-browser items flow"}, async t=>{
  assert.ok(existsSync(executable),"Install/configure agent-browser for the UI regression test");
  const output=resolve("tests/pet/items-browser");mkdirSync(output,{recursive:true});
  await new Promise((ok,fail)=>{
    const compiler=webpack({mode:"development",devtool:false,entry:resolve("tests/pet/ItemsFixture.tsx"),output:{path:output,filename:"fixture.js"},
      resolve:{extensions:[".tsx",".ts",".js"],alias:{"@":resolve("."),"next/image":resolve("tests/pet/image-stub.tsx")}},
      module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:resolve("tests/pet/tsx-loader.cjs")}]}});
    compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?fail(error??Error(stats.toString({all:false,errors:true}))):ok()));
  });
  const {createKingMock}=loadTS("tests/pet/king-mock.ts"),{createKingApi}=loadTS("lib/domine/pet-king-rpc.ts");
  const identity={nickname:"김경석",secret:"a".repeat(64)},mock=createKingMock({coins:500});mock.register(identity);
  const api=createKingApi(mock.rpc);
  for(const item of ["P04","P06","P10"]) await api.buyItem(identity,crypto.randomUUID(),{pet:1,item,quantity:3});
  const server=createServer(async (req,res)=>{
    if(req.url==="/rpc") {let body="";for await(const chunk of req) body+=chunk; const args=JSON.parse(body);if(args.p_kind==="finish") mock.advance(60000); const reply=await mock.rpc("domine_pet_king_v17",args);res.setHeader("content-type","application/json");res.end(JSON.stringify(reply.data));return;}
    if(req.url==="/") {res.setHeader("content-type","text/html; charset=utf-8");res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/pet-game.css"><style>body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}</style><div id="root"></div><script src="/fixture.js"></script>');return;}
    const file=req.url==="/fixture.js"?join(output,"fixture.js"):req.url==="/pet-game.css"?resolve("app/games/pet-game.css"):resolve("public",`.${decodeURIComponent(req.url.split("?")[0])}`);
    if(!file.startsWith(resolve("public"))&&!file.startsWith(output)&&file!==resolve("app/games/pet-game.css")) {res.writeHead(403);res.end();return;}
    try {res.setHeader("content-type",file.endsWith(".js")?"application/javascript":file.endsWith(".css")?"text/css":file.endsWith(".webp")?"image/webp":"application/octet-stream");res.end(readFileSync(file));} catch {res.writeHead(404);res.end();}
  });
  await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
  const session=`pet-items-${process.pid}`;
  const browser=async (...args)=>{const {stdout}=await run(executable,["--session",session,...args],{timeout:10000,maxBuffer:2**20,windowsHide:true});return stdout;};
  // agent-browser here has no :text-is/:text-matches selectors, so click by text through eval.
  const clickText=async(text,{scope="button",exact=true}={})=>{
    const ok=await browser("eval",`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(scope)})].find(b=>!b.closest("[inert]")&&(${exact}?b.textContent.trim()===${JSON.stringify(text)}:b.textContent.includes(${JSON.stringify(text)})));if(!el)return false;el.click();return true})()`);
    assert.match(ok,/true/,`button "${text}" exists`);
  };
  const waitText=async(text)=>{for(let i=0;i<40;i++){if(/true/.test(await browser("eval",`[...document.querySelectorAll("button")].some(b=>b.textContent.trim()===${JSON.stringify(text)})`)))return;await new Promise(ok=>setTimeout(ok,150));}assert.fail(`"${text}" never appeared`);};
  t.after(async()=>{await browser("close").catch(()=>{});await new Promise(ok=>server.close(ok));if(existsSync(join(output,"fixture.js"))) unlinkSync(join(output,"fixture.js"));});
  try { await browser("open",`http://127.0.0.1:${server.address().port}`); }
  catch(error) { if (/CDP response channel closed|Auto-launch failed/.test(error.stderr ?? "")) { t.skip("Local browser launch blocked: CDP response channel closed"); return; } throw error; }
  await browser("snapshot","-i");
  await clickText("전투 물품");
  await browser("click",'[aria-label="작은 물약 구매"]');
  assert.equal(mock.inspect().pets[1].inventory.P01,1);
  const geometry=async(selector)=>{
    const result=await browser("eval",`JSON.stringify((()=>{const rects=[...document.querySelectorAll('${selector}')].filter(e=>!e.closest('[inert]')).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});return {count:rects.length,outside:rects.filter(r=>r.x<0||r.x+r.w>innerWidth+1),overlap:rects.some((a,i)=>rects.slice(i+1).some(b=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+1&&Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y)+1))}})())`);
    const data=JSON.parse(JSON.parse(result.trim()));assert.ok(data.count>0);assert.deepEqual(data.outside,[]);assert.equal(data.overlap,false);
  };
  for(const [w,h] of [[390,844],[360,640],[1600,900]]) {await browser("set","viewport",String(w),String(h));await geometry(".pet-combat-product");}
  await browser("press","Escape");await clickText("테스트 반입");await browser("snapshot","-i");
  for(const name of ["작은 물약","시원한 물","힘나는 간식"]) await clickText(name,{scope:".pet-encounter-items button",exact:false});
  assert.match(await browser("eval",'document.querySelector(".pet-encounter-items").textContent'),/3\/3/);
  assert.match(await browser("eval",'[...document.querySelectorAll(".pet-encounter-items button")].find(b=>b.textContent.includes("정신 번쩍 껌")).disabled'),/true/);
  await clickText("겨루기");
  await browser("wait",'.pet-battle-scene[data-phase="command"]');
  await browser("snapshot","-i");await clickText("가방",{scope:".pet-battle-actions button",exact:false});
  for(const [w,h] of [[390,844],[360,640],[1600,900]]) {
    await browser("set","viewport",String(w),String(h));await geometry(".pet-battle-item-grid .pet-battle-card");
    await geometry(".pet-battle-hud, .pet-battle-console");
  }
  assert.match(await browser("eval",'document.querySelector(".pet-battle-item-grid").textContent'),/체력이 가득/);
  await browser("click",'[aria-label="힘나는 간식 사용"]');await browser("wait",'.pet-battle-scene[data-phase="command"]');
  await clickText("가방",{scope:".pet-battle-actions button",exact:false});
  assert.match(await browser("eval",'document.querySelector(".pet-battle-item-grid").textContent'),/이미 사용/);
  await browser("press","Escape");await browser("press","Escape");
  await waitText("테스트 반입");
  for(let i=0;i<40&&mock.inspect().pets[1].inventory.P06!==2;i++) await new Promise(ok=>setTimeout(ok,150)); // the settlement request is asynchronous
  const state=mock.inspect();assert.equal(state.pets[1].inventory.P06,2);assert.equal(state.pets[1].inventory.P01,1);assert.equal(state.pets[1].inventory.P04,3);
});
