import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import ts from "typescript";
import { loadTS } from "./pet-test-loader.mjs";

const require = createRequire(import.meta.url);
const { default: Sheet, PetHistoryList, historyText } = loadTS("app/games/PetHistorySheet.tsx");
const at = new Date(Date.now() - 120000).toISOString();
const entries = [
  {nickname:"민수",pet:1,kind:"action",detail:"feed",at},
  {nickname:"민수",pet:2,kind:"purchase",detail:"061",at},
  {nickname:"민수",pet:1,kind:"equip",detail:null,at},
  {nickname:"민수",pet:1,kind:"levelup",detail:"5",at},
  {nickname:"민수",pet:2,kind:"discover",detail:"001",at},
];
const html = renderToStaticMarkup(createElement(PetHistoryList,{entries}));
assert.match(html,/<ul[^>]+aria-label="최근 활동"/);assert.equal((html.match(/<li>/g)||[]).length,5);
for(const text of ["2분 전","민수님이 도미에게 밥을 줬어요","미네에게","도미의 착용을 해제했어요","도미 Lv.5 달성","새 도감 발견"]) assert.ok(html.includes(text),text);
assert.ok(!html.includes("secret"));
assert.match(historyText({...entries[0],detail:"unknown"}),/돌봄/);
assert.match(historyText({...entries[2],detail:"061"}),/착용해 줬어요/);
const initial = renderToStaticMarkup(createElement(Sheet,{history:async()=>entries,onClose(){}}));
assert.match(initial,/<dialog/);assert.match(initial,/함께한 이력/);assert.match(initial,/새로고침/);assert.match(initial,/불러오는 중/);
const Shop=loadTS("app/games/PetShopSheet.tsx").default,Progress=loadTS("app/games/PetProgress.tsx").default;
const shopProps={disabled:false,notice:"",execute:async()=>{},onClose(){}};
const domiShop=renderToStaticMarkup(createElement(Shop,{...shopProps,petId:1,state:{inventory:["061"],player:{coins:60}}}));
const mineShop=renderToStaticMarkup(createElement(Shop,{...shopProps,petId:2,state:{inventory:[],player:{coins:60}}}));
assert.ok(domiShop.includes("✓ 도미 보유"));assert.ok(mineShop.includes("미네용 구매 · 40 코인"));assert.ok(!mineShop.includes("✓ 미네 보유"));
assert.ok(mineShop.includes("우리 코인(공용)"));
for(const [name,xp,level] of [["도미",40,2],["미네",32,1]]) {
  const progress=renderToStaticMarkup(createElement(Progress,{name,xp,coins:60}));assert.ok(progress.includes(`${name} Lv. ${level}`));assert.ok(progress.includes("우리 코인(공용) 60"));
}

// Run the sheet's actual effects and refresh handler without installing a DOM/test library.
const source = ts.transpileModule(readFileSync("app/games/PetHistorySheet.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const slots=[],effects=[];let cursor=0,tree,loads=0,reject=false,cleanup;
const hooks={
  useState(initial){const i=cursor++;slots[i]??={value:initial};return [slots[i].value,v=>{slots[i].value=typeof v==="function"?v(slots[i].value):v;}];},
  useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((d,n)=>d!==slots[i].deps[n])){slots[i]={deps};effects.push(fn);}},
};
const exports={};new Function("require","exports",source)(name=>name==="react"?hooks:name.startsWith("@/")?loadTS(`${name.slice(2)}.ts`):name==="./PetSheet"?loadTS("app/games/PetSheet.tsx"):require(name),exports);
const history=async()=>{loads++;if(reject)throw new Error("offline");return entries;};
async function render(){cursor=0;tree=exports.default({history,onClose(){}});while(effects.length){cleanup?.();cleanup=effects.shift()();}await Promise.resolve();await Promise.resolve();await Promise.resolve();cursor=0;tree=exports.default({history,onClose(){}});return renderToStaticMarkup(tree);}
assert.match(await render(),/밥을 줬어요/);assert.equal(loads,1);
await render();assert.equal(loads,1,"opening loads once; ordinary renders do not fetch");
const button=()=>tree.props.children.find(child=>child?.type==="button");
button().props.onClick();assert.match(await render(),/밥을 줬어요/);assert.equal(loads,2);
reject=true;button().props.onClick();assert.match(await render(),/이력을 불러오지 못했어요/);assert.equal(button().props.disabled,false);
reject=false;button().props.onClick();assert.ok(!(await render()).includes("이력을 불러오지 못했어요"));cleanup();
console.log("Pet history: Korean list rendering, one load, refresh and recoverable errors passed.");
