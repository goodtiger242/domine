import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { loadTS } from "./pet-test-loader.mjs";
const tap=loadTS("lib/domine/pet-tap.ts");
for(const [ms,phase,care] of [[0,"tap",false],[249,"tap",false],[250,"start",false],[399,"start",false],[400,"hold",false],[1999,"hold",false],[2000,"hold",true]]) {
  assert.deepEqual(tap.pressAt(ms),{phase,care});
}
assert.equal(tap.pressAt(10000,true).care,false);
const source=ts.transpileModule(readFileSync("app/games/usePetStroke.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function mount() {
  let now=0,cursor=0,dirty=true,id=0,result;
  const slots=[],effects=[],timers=new Map(),listeners=new Map(),calls={tap:0,care:0,release:0,contact:false};
  const changed=(a,b)=>!a||!b||a.some((v,i)=>!Object.is(v,b[i]));
  const hooks={
    useRef(value){const n=cursor++;return slots[n]??={current:value};},
    useState(value){const n=cursor++;slots[n]??={value};return[slots[n].value,next=>{slots[n].value=typeof next==="function"?next(slots[n].value):next;dirty=true;}];},
    useEffect(fn,deps){const n=cursor++;if(changed(slots[n]?.deps,deps)){const prev=slots[n];slots[n]={deps};effects.push(()=>{prev?.cleanup?.();slots[n].cleanup=fn();});}},
  };hooks.useLayoutEffect=hooks.useEffect;
  const events={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const doc={...events,hidden:false};
  const exports={};
  new Function("require","exports","setTimeout","clearTimeout","performance","window","document","DOMPoint",source)(
    name=>name==="react"?hooks:tap,exports,(fn,ms)=>{const n=++id;timers.set(n,{fn,at:now+ms});return n;},n=>timers.delete(n),{now:()=>now},events,doc,
    class {constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}});
  let captured=false;
  const target={getScreenCTM:()=>({inverse:()=>({})}),setPointerCapture:()=>{captured=true;},hasPointerCapture:()=>captured,releasePointerCapture:()=>{captured=false;}};
  const options={disabled:false,cancelled:false,width:26,height:18,scale:1,onTap:()=>calls.tap++,onPet:()=>calls.care++,onRelease:()=>calls.release++,onContact:active=>{calls.contact=active;}};
  const flush=()=>{for(let n=0;dirty&&n<20;n++){dirty=false;cursor=0;result=exports.usePetStroke(options);while(effects.length)effects.shift()();}assert.equal(dirty,false);};
  const advance=ms=>{const end=now+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();flush();}now=end;flush();};
  const event=(name,patch={})=>{result.handlers[name]({pointerId:1,isPrimary:true,button:0,currentTarget:target,clientX:4,clientY:-10,preventDefault(){},...patch});flush();};
  flush();return{calls,event,advance,get stroke(){return result.stroke;},get captured(){return captured;},set(patch){Object.assign(options,patch);dirty=true;flush();},hide(){doc.hidden=true;listeners.get("visibilitychange")();flush();},close(){for(const slot of slots)slot?.cleanup?.();assert.equal(timers.size,0);assert.equal(captured,false);}};
}
let h=mount();h.event("onPointerDown");h.advance(249);h.event("onPointerUp");assert.equal(h.calls.tap,1);assert.equal(h.calls.care,0);assert.equal(h.stroke,null);h.close();
h=mount();h.event("onPointerDown");h.advance(250);assert.equal(h.stroke.phase,"start");h.advance(150);assert.equal(h.stroke.phase,"hold");
h.event("onPointerMove",{clientX:12});assert.equal(h.stroke.phase,"hold");assert.equal(h.stroke.point.x,12);
h.event("onPointerDown",{pointerId:2});h.event("onPointerUp",{pointerId:2});assert.equal(h.stroke.phase,"hold");
h.event("onPointerCancel",{pointerId:2});assert.equal(h.stroke.phase,"hold");
h.advance(1599);assert.equal(h.calls.care,0);h.advance(1);assert.equal(h.calls.care,1);
h.set({disabled:true});h.advance(5000);assert.equal(h.calls.care,1);assert.equal(h.stroke.phase,"hold");
h.event("onPointerUp");assert.equal(h.stroke.phase,"release");assert.equal(h.calls.release,1);assert.equal(h.calls.tap,0);assert.equal(h.captured,false);
h.advance(250);assert.equal(h.stroke,null);assert.equal(h.calls.contact,false);h.close();
for(const cancel of ["onPointerCancel","onLostPointerCapture","disabled","cancelled","hide"]) {
 h=mount();h.event("onPointerDown");h.advance(500);
 if(cancel==="hide")h.hide();else if(cancel==="disabled"||cancel==="cancelled")h.set({[cancel]:true});else h.event(cancel);
 h.advance(5000);assert.equal(h.calls.care,0);assert.equal(h.stroke,null);assert.equal(h.calls.contact,false);h.close();
}
h=mount();h.event("onPointerDown");h.advance(1999);h.event("onPointerUp");h.advance(3000);assert.equal(h.calls.care,0);assert.equal(h.calls.tap,0);h.close();
h=mount();h.event("onPointerDown");h.advance(500);h.close();
console.log("Pet stroke: tap/hold boundaries, movement, single care, release, capture and cancellation passed.");
