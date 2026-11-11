import { setImmediate as nextTurn } from "node:timers/promises";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { loadTS } from "./pet-test-loader.mjs";

const { createPetMock } = loadTS("tests/pet/rpc-mock.ts");
const { PetRpcError } = loadTS("lib/domine/pet-rpc.ts");
const { secretForName } = loadTS("lib/domine/pet-identity.ts");
const identity = { nickname: "김경석", secret: await secretForName("김경석") };
const source = ts.transpileModule(readFileSync("app/games/usePetController.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Exercise the real controller with deterministic hooks/timers and no browser or database.
function mount(api, saved = [], reduced = false) {
  let imageLoader = async () => true;
  const storage = new Map(saved), slots = [], effects = [], timers = new Map();
  let cursor = 0, dirty = true, game, now = 0, timerId = 0;
  globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) };
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  globalThis.window = { matchMedia: () => ({ matches: reduced }), addEventListener() {}, removeEventListener() {}, setTimeout: (...args) => setTimeout(...args), clearTimeout: id => clearTimeout(id) };
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
  globalThis.setTimeout = (fn,ms) => { const id=++timerId; timers.set(id,{fn,at:now+ms}); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.setInterval = () => 0;
  globalThis.clearInterval = () => {};
  Date.now = () => now;
  const changed = (a,b) => !a || !b || a.some((v,i)=>!Object.is(v,b[i]));
  const hooks = {
    useState(initial) {
      const n=cursor++;
      if (!slots[n]) {
        slots[n]={value:typeof initial==="function"?initial():initial};
        slots[n].set=value=>{ const next=typeof value==="function"?value(slots[n].value):value; if(!Object.is(next,slots[n].value)){slots[n].value=next;dirty=true;} };
      }
      return [slots[n].value,slots[n].set];
    },
    useReducer(reducer,initial) {
      const [value,set]=hooks.useState(initial), n=cursor-1;
      slots[n].dispatch ??= event=>set(value=>reducer(value,event));
      return [value,slots[n].dispatch];
    },
    useRef(value) { const n=cursor++; return slots[n] ??= {current:value}; },
    useCallback(fn,deps) { const n=cursor++; if(changed(slots[n]?.deps,deps)) slots[n]={value:fn,deps}; return slots[n].value; },
    useEffect(fn,deps) {
      const n=cursor++;
      if(changed(slots[n]?.deps,deps)) { const previous=slots[n]; slots[n]={deps}; effects.push(()=>{previous?.cleanup?.();slots[n].cleanup=fn();}); }
    },
  };
  const exports={};
  new Function("require","exports",source)(name=>{
    if(name==="react") return hooks;
    if(name==="@/lib/supabase/client") return {createClient:()=>({})};
    if(name==="@/lib/domine/pet-assets") return {prepareImage:(...args)=>imageLoader(...args),vibrate:()=>{}};
    return loadTS(`${name.slice(2)}.ts`);
  },exports);
  async function flush() {
    for(let n=0;n<30;n++) {
      if(dirty) { dirty=false;cursor=0;game=exports.usePetController(api); }
      while(effects.length) effects.shift()();
      await nextTurn();
    }
    assert.equal(dirty,false,"controller settles without an effect loop");
  }
  return {
    get game(){return game;},storage,flush, setImageLoader(fn){imageLoader=fn;},
    async advance(ms) {
      const end=now+ms;
      for(;;) {
        const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
        if(!next) break;
        now=next[1].at;timers.delete(next[0]);next[1].fn();await flush();
      }
      now=end;await flush();
    },
    close(){for(const slot of slots) slot?.cleanup?.();},
  };
}
const savedToken = [["domine-pet-nick",identity.nickname]];
async function login(h){await h.flush();await h.game.connect(identity.nickname);await h.flush();}
let mock=createPetMock(), h=mount(mock.api);
await h.flush();assert.equal(h.game.registered,false);
h.game.care("feed");await h.flush();
assert.equal(h.game.machine.visual,"acting");
assert.equal(h.game.message,"내 이름을 입력하면 함께 키울 수 있어요");
assert.ok(!mock.calls.includes("action"));h.close();

// A saved name from an earlier visit is never restored or shown; each visit enters a name.
mock=createPetMock();h=mount(mock.api,[...savedToken,[`domine-pet-reg:${identity.nickname}`,"1"]]);await h.flush();
assert.equal(h.game.nickname,"");assert.equal(h.game.identity,null);assert.equal(h.game.registered,false);assert.equal(h.game.personal,null);
assert.ok(!mock.calls.includes("register"));assert.ok(!mock.calls.includes("state"));h.close();

mock=createPetMock();h=mount(mock.api,savedToken);await login(h);
assert.equal(mock.calls.filter(c=>c==="register").length,1,"unconfirmed name registers");
assert.equal(h.game.identity.secret,identity.secret);
assert.equal(h.game.registered,true);assert.equal(h.storage.get(`domine-pet-reg:${identity.nickname}`),"1");h.close();

mock=createPetMock();await mock.api.register(identity);h=mount(mock.api);await login(h);
assert.equal(h.game.registered,true,"already registered with the same token is success");
assert.equal(mock.calls.filter(c=>c==="register").length,2);h.close();

mock=createPetMock();await mock.api.register({...identity,secret:"b".repeat(64)});h=mount(mock.api);await login(h);
assert.equal(h.game.registered,false);assert.ok(!h.storage.has(`domine-pet-reg:${identity.nickname}`));
assert.equal(h.game.message,"이름을 다시 입력해 주세요");h.close();

// Old random tokens are ignored, including when the name has a confirmation flag.
mock=createPetMock();await mock.api.register(identity);
h=mount(mock.api,[...savedToken,[`domine-pet-identity:${identity.nickname}`,"b".repeat(64)],[`domine-pet-reg:${identity.nickname}`,"1"]]);await login(h);
assert.equal(h.game.identity.secret,identity.secret);assert.equal(h.game.registered,true);
assert.equal(mock.calls.filter(c=>c==="register").length,1,"confirmed name reads state without registering again");h.close();

// A stale confirmation is cleared after authentication fails, allowing registration on retry.
mock=createPetMock();h=mount(mock.api,[...savedToken,[`domine-pet-reg:${identity.nickname}`,"1"]]);await login(h);
assert.equal(h.game.message,"이름을 다시 입력해 주세요");assert.equal(h.game.registered,false);
await h.game.checkCapabilities();await h.flush();assert.equal(h.game.registered,true);h.close();

for (const missing of [false,true]) {
  mock=createPetMock({missing});h=mount(mock.api,[["domine-pet-nick","옛별명"],["domine-pet-identity:옛별명","a".repeat(64)],["domine-pet-reg:옛별명","1"]]);await h.flush();
  assert.equal(h.game.nickname,"");assert.equal(h.game.identity,null);assert.equal(h.game.registered,false);
  assert.ok(!mock.calls.includes("register"));assert.ok(!mock.calls.includes("state"));
  for (const invalid of ["옛별명","a!","123456789",`${identity.nickname}:${identity.secret}`]) {
    const before=mock.calls.length;await h.game.connect(invalid);await h.flush();assert.equal(mock.calls.length,before);
  }
  h.game.care("feed");await h.flush();assert.ok(!mock.calls.includes("legacy-action"));h.close();
}

// Two clean device stores join one server record, including coins and inventory.
mock=createPetMock();h=mount(mock.api);await h.flush();await h.game.connect(identity.nickname);await h.flush();
await h.game.execute({kind:"purchase",pet:1,item:"061",requestId:"device-one"});await h.flush();
const firstRecord=h.game.personal;h.close();
h=mount(mock.api);await h.flush();await h.game.connect(identity.nickname);await h.flush();
assert.equal(h.game.identity.secret,identity.secret);assert.equal(h.game.personal.coins,firstRecord.coins);
assert.deepEqual(h.game.personal.inventory,["061"]);assert.equal(mock.calls.filter(c=>c==="register").length,2);
assert.ok([...h.storage.keys()].every(key=>!key.startsWith("domine-pet-identity:")));
h.game.clearIdentity();await h.flush();assert.equal(h.game.nickname,"");assert.equal(h.game.identity,null);assert.equal(h.game.personal,null);assert.equal(h.game.registered,false);assert.ok(!h.storage.has("domine-pet-nick"));
await h.game.connect(identity.nickname);await h.flush();assert.deepEqual(h.game.personal.inventory,["061"]);h.close();

mock=createPetMock();const register=mock.api.register;
mock.api.register=async i=>{await register(i);throw new TypeError("response lost");};
h=mount(mock.api);await h.flush();await h.game.connect(identity.nickname);await h.flush();
assert.equal(h.storage.get("domine-pet-nick"),identity.nickname);
assert.ok(!h.storage.has(`domine-pet-identity:${identity.nickname}`));assert.ok(!h.storage.has(`domine-pet-reg:${identity.nickname}`));
mock.api.register=register;await h.game.connect(identity.nickname);await h.flush();
assert.equal(h.game.identity.secret,identity.secret);assert.equal(h.game.registered,true);h.close();

mock=createPetMock();h=mount(mock.api,savedToken);await login(h);
const command={kind:"action",pet:1,action:"feed",requestId:"error"};
const execute=mock.api.execute;
mock.api.execute=async()=>{throw new PetRpcError("23514",true);};
await h.game.execute(command);await h.flush();
assert.equal(h.game.machine.command,"idle");assert.ok(!h.storage.has(`domine-pet-pending:${identity.nickname}`));
assert.ok(h.game.message.startsWith("서버 점검 중이에요. 잠시 후 다시 해 주세요"));
mock.api.execute=async()=>{throw new TypeError("Failed to fetch");};
await h.game.execute({...command,requestId:"network"});await h.flush();
assert.equal(h.game.machine.command,"uncertain");assert.ok(h.storage.has(`domine-pet-pending:${identity.nickname}`));
mock.api.execute=execute;h.game.retry();await h.flush();
assert.equal(h.game.machine.command,"idle");assert.equal(h.game.personal.player.coins,118);

mock.api.execute=()=>new Promise(()=>{});
void h.game.execute({...command,requestId:"timeout"});await h.flush();
assert.equal(h.game.machine.command,"pending");
h.game.care("pet");await h.flush();assert.equal(h.game.machine.visual,"acting");
assert.equal(h.game.message,"");
await h.advance(8000);assert.equal(h.game.machine.command,"uncertain");
mock.api.operation=async()=>{throw new PetRpcError("42P01",true);};
h.game.retry();await h.flush();assert.equal(h.game.machine.command,"uncertain","lookup failures cannot discard an unresolved mutation");h.close();

mock=createPetMock({v9:false});h=mount(mock.api,savedToken);await login(h);
await h.game.execute({kind:"explore_begin",map:"farm",source:"map",requestId:"old-server"});await h.flush();
assert.ok(!mock.calls.includes("explore_begin"));assert.equal(h.game.machine.command,"idle");
assert.equal(h.game.message,"서버 업데이트 대기 중(새 지역 탐험은 아직)");h.close();

mock=createPetMock({v9:false});await mock.api.register(identity);
h=mount(mock.api,[...savedToken,[`domine-pet-reg:${identity.nickname}`,"1"],[`domine-pet-pending:${identity.nickname}`,JSON.stringify({kind:"explore_begin",map:"farm",source:"map",requestId:"old-pending"})]]);
await login(h);assert.equal(h.game.machine.command,"uncertain");
h.game.retry();await h.flush();assert.ok(mock.calls.includes("operation"));
assert.equal(h.game.machine.command,"idle","old pending themes can still look up and settle without sending to the old server");h.close();

mock=createPetMock();h=mount(mock.api,savedToken);await login(h);
mock.api.execute=async()=>({...mock.state(),version:1,reward:{xp:0,coins:0,levelCoins:0,newEntries:[],newBadges:[],skipped:"DAILY_CAP"}});
await h.game.execute(command);await h.flush();
assert.equal(h.game.rewardNotice, "", "care rewards no longer advertise a daily cap");
await h.advance(2999);assert.ok(h.game.feedback);
await h.advance(1);assert.equal(h.game.feedback,null);assert.equal(h.game.rewardNotice, "");
await h.game.refresh();await h.flush();assert.equal(h.game.rewardNotice, "");
mock.api.execute=async()=>({...mock.state(),version:2,reward:{xp:8,coins:4,levelCoins:0,newEntries:[],newBadges:[]}});
assert.equal(h.game.rewardNotice, "", "care rewards no longer advertise a daily cap");
mock=createPetMock();h=mount(mock.api,savedToken);await login(h);
await h.game.execute({kind:"purchase",pet:1,item:"061",requestId:"domi-item"});await h.flush();
await h.game.execute({...command,pet:1,requestId:"domi-level"});await h.flush();
assert.equal(h.game.personal.player.level,2);assert.deepEqual(h.game.personal.inventory,["061"]);
const state=mock.api.state;let release;
mock.api.state=async(i,pet)=>{await new Promise(resolve=>{release=resolve;});return state(i,pet);};
h.game.pause();await h.flush();
h.game.selectPet(2);await h.flush();
assert.equal(h.game.petId,2,"bag can switch pets while the sheet keeps the scene paused");
assert.equal(h.game.machine.visual,"paused");
assert.equal(h.game.personal.player,undefined);assert.equal(h.game.personal.inventory,undefined,"do not display the previous pet's items while loading");assert.equal(h.game.feedback,null);
release();await h.flush();assert.equal(h.game.personal.player.level,1);assert.deepEqual(h.game.personal.inventory,[]);assert.equal(h.game.personal.coins,78);
mock.api.state=state;
mock.api.execute=async()=>{throw new TypeError("response lost");};
await h.game.execute({...command,pet:2,requestId:"mine-pending"});await h.flush();
h.game.selectPet(1);await h.flush();
// A committed response for pet 2 must not replace the selected pet 1's inventory/XP.
mock.api.operation=async()=>({...mock.state(2),version:99,reward:{xp:8,coins:4,levelCoins:0,newEntries:[],newBadges:[]}});
h.game.retry();await h.flush();assert.equal(h.game.personal.pet,1);assert.deepEqual(h.game.personal.inventory,["061"]);assert.equal(h.game.personal.player.level,2);h.close();
console.log("Pet controller: registration recovery, retries, per-pet switching and stale result isolation passed.");

// Confirmed travel preserves the old map until both departure and decoding finish.
for (const reduced of [false, true]) {
  h=mount(createPetMock().api, [], reduced); await h.flush();
  void h.game.localScene({action:"map",direction:"e",id:0}); await h.flush();
  assert.equal(h.game.travel.phase,"exit"); assert.equal(h.game.travel.direction,"e");
  assert.equal(h.game.machine.visual,"loading-map"); assert.equal(h.game.machine.committedMap,"E5");
  h.game.care("feed"); await h.flush(); assert.equal(h.game.machine.visual,"loading-map");
  if (!reduced) { await h.advance(449); assert.equal(h.game.machine.committedMap,"E5"); }
  await h.advance(reduced ? 0 : 1); assert.equal(h.game.travel.phase,"cross"); assert.equal(h.game.machine.committedMap,"F5");
  await h.advance(200);
  if (!reduced) { assert.equal(h.game.travel.phase,"enter"); await h.advance(450); }
  assert.equal(h.game.machine.visual,"idle"); assert.equal(h.game.travel,null);
  assert.ok(h.game.arrival); h.close();
}
h=mount(createPetMock().api); await h.flush();
let imageReady;
h.setImageLoader(()=>new Promise(resolve=>{imageReady=resolve;}));
void h.game.localScene({action:"map",to:"J10",id:0}); await h.flush();
await h.advance(900); assert.equal(h.game.machine.committedMap,"E5"); assert.equal(h.game.travel.phase,"exit");
imageReady(true); await h.flush(); assert.equal(h.game.travel.phase,"cross");
await h.advance(650); assert.equal(h.game.machine.visual,"idle"); h.close();
for (const failure of ["error", "timeout", "pause", "unmount"]) {
  h=mount(createPetMock().api); await h.flush();
  h.setImageLoader((src,signal)=>failure==="error" ? Promise.resolve(false) : new Promise(resolve=>signal.addEventListener("abort",()=>resolve(false),{once:true})));
  void h.game.localScene({action:"map",direction:"n",id:0}); await h.flush();
  if(failure==="pause") { h.game.pause(); await h.flush(); h.game.resume(); }
  if(failure==="unmount") h.close();
  await h.advance(2500);
  assert.equal(h.game.machine.committedMap,"E5");
  if(failure!=="unmount") { assert.equal(h.game.machine.visual,"idle"); assert.equal(h.game.travel,null); h.close(); }
}
console.log("Pet travel: exit, ready gate, crossfade, entry, reduced motion, failures and cancellation passed.");

// Uncertain requests recover with the same ID, without exposing manual retry early.
for (const restored of [false, true]) {
  mock=createPetMock(); await mock.api.register(identity);
  const savedCommand={kind:"action",pet:1,action:"feed",requestId:`auto-${restored}`};
  const committed=await mock.api.execute(identity,savedCommand);
  const lookup=mock.api.operation; const times=[];
  mock.api.operation=async(i,id)=>{times.push(Date.now());assert.equal(id,savedCommand.requestId);if(times.length<3)throw new TypeError("offline");return lookup(i,id);};
  h=mount(mock.api,[...savedToken,...(restored?[[`domine-pet-pending:${identity.nickname}`,JSON.stringify(savedCommand)]]:[])]);await login(h);
  if(!restored){mock.api.execute=async()=>{throw new TypeError("lost response");};await h.game.execute(savedCommand);await h.flush();}
  assert.equal(h.game.canRetry,false);
  await h.advance(1499);assert.deepEqual(times,[]);
  await h.advance(1);assert.deepEqual(times,[1500]);assert.equal(h.game.canRetry,false);
  await h.advance(3000);assert.deepEqual(times,[1500,4500]);assert.equal(h.game.canRetry,false);
  await h.advance(6000);assert.deepEqual(times,[1500,4500,10500]);
  assert.equal(h.game.machine.command,"idle");assert.equal(h.game.personal.coins,committed.coins);
  assert.ok(!h.storage.has(`domine-pet-pending:${identity.nickname}`));h.close();
}
mock=createPetMock();h=mount(mock.api,savedToken);await login(h);
mock.api.execute=async()=>{throw new TypeError("offline");};let attempts=0;
mock.api.operation=async()=>{attempts++;throw new TypeError("offline");};
await h.game.execute({...command,requestId:"exhausted"});await h.flush();
await h.advance(1500);assert.equal(h.game.canRetry,false);
await h.advance(3000);assert.equal(h.game.canRetry,false);
await h.advance(6000);assert.equal(h.game.canRetry,true);assert.equal(attempts,3);
await h.advance(60000);assert.equal(attempts,3,"automatic retries stop at three");h.close();

mock=createPetMock({busyLock:true});h=mount(mock.api,savedToken);await login(h);
const send=mock.api.execute;let deliver;
mock.api.execute=async(...args)=>{await new Promise(resolve=>{deliver=resolve;});return send(...args);};
h.game.care("feed");await h.flush();
assert.equal(h.game.machine.visual,"idle","wait for server before scene");assert.equal(h.game.requestingAction,"feed");
assert.equal(JSON.parse(h.storage.get(`domine-pet-pending:${identity.nickname}`)).durationMs,2400);
h.game.selectPet(2);await h.flush();
assert.equal(h.game.machine.command,"pending","switching does not abort or mark uncertain");
deliver();await h.flush();
assert.equal(h.game.machine.command,"idle");assert.equal(h.game.personal.pet,2);assert.equal(h.game.personal.player.level,1);
assert.equal(h.game.machine.visual,"idle","a response for another pet does not animate the current one");
h.game.selectPet(1);await h.flush();assert.equal(h.game.personal.player.level,2);assert.ok(h.game.busy);h.close();

mock=createPetMock({busyLock:true});h=mount(mock.api,savedToken);await login(h);
h.game.care("treat");await h.flush();assert.equal(h.game.machine.visual,"acting");assert.equal(h.game.cue.action,"treat");
await h.advance(2200);assert.equal(h.game.machine.visual,"idle");assert.equal(h.game.busy,undefined);h.close();

mock=createPetMock({busyLock:true});h=mount(mock.api,savedToken);await login(h);
await mock.api.register({nickname:"김보영",secret:"b".repeat(64)});
await mock.api.execute({nickname:"김보영",secret:"b".repeat(64)},{...command,pet:2,action:"treat",durationMs:2200,requestId:"someone-else"});
h.game.selectPet(2);await h.flush();assert.equal(h.game.busy.nickname,"김보영");
h.game.care("feed");await h.flush();assert.equal(h.game.machine.visual,"idle");assert.equal(h.game.cue,null);
h.game.selectPet(1);await h.flush();assert.equal(h.game.busy,undefined);h.game.care("pet");await h.flush();assert.equal(h.game.machine.visual,"acting");
await h.advance(1800);mock.advance(1800);h.game.selectPet(2);await h.flush();assert.ok(h.game.busy);
await h.advance(400);assert.equal(h.game.busy,undefined);h.close();

// A racing click receives BUSY, then unlocks automatically without any scene.
mock=createPetMock({busyLock:true});h=mount(mock.api,savedToken);await login(h);
await mock.api.execute(identity,{...command,requestId:"racer",durationMs:500});
h.game.care("pet");await h.flush();assert.equal(h.game.machine.visual,"idle");assert.equal(h.game.busy.action,"feed");assert.equal(h.game.message,"");
await h.advance(500);assert.equal(h.game.busy,undefined);h.close();
console.log("Pet recovery/busy: 1.5/3/6s retries, restored pending, exhaustion, in-flight pet switching, server-first scenes and expiry passed.");

for (const busyLock of [false,true]) {
  mock=createPetMock({busyLock});h=mount(mock.api,savedToken);await login(h);
  h.game.care("pet",true);await h.flush();
  assert.ok(mock.calls.includes("action"));assert.equal(h.game.machine.visual,"idle");assert.equal(h.game.cue,null,"direct strokes already present their own animation");
  if(busyLock) {
    assert.equal(h.game.busy.action,"pet");const count=mock.calls.length;
    h.game.care("pet",true);await h.flush();assert.equal(mock.calls.length,count,"direct strokes respect existing BUSY lock");
  }
  h.close();
}
mock=createPetMock({busyLock:true});h=mount(mock.api,savedToken);await login(h);
await mock.api.execute(identity,{...command,requestId:"stroke-racer",durationMs:500});
h.game.care("pet",true);await h.flush();assert.equal(h.game.machine.visual,"idle");assert.equal(h.game.busy.action,"feed");assert.equal(h.game.cue,null);h.close();

mock=createPetMock({busyLock:true});h=mount(mock.api,savedToken);await login(h);
h.game.care("walk");await h.flush();
await h.advance(4000);assert.ok(mock.calls.includes("explore_begin"),"lock expiry still completes the walk exploration");h.close();

mock=createPetMock({busyLock:true,delayMs:300});h=mount(mock.api,savedToken);await login(h);
h.game.care("feed");await h.flush();assert.equal(h.game.machine.visual,"idle");
await h.advance(300);assert.equal(h.game.machine.visual,"acting");assert.equal(h.game.cue.endsAt,2400,"network delay cannot extend the scene beyond the reservation");
await h.advance(2100);assert.equal(h.game.machine.visual,"idle");assert.equal(h.game.busy,undefined);h.close();

// A local battle holds the existing pause lock and never starts a server request.
mock=createPetMock();h=mount(mock.api,savedToken);await login(h);
const callsBeforeBattle=mock.calls.length, petBeforeBattle=h.game.petId;
h.game.pause(true);await h.flush();
h.game.care("feed");h.game.localScene({action:"map",to:"F5",id:1});h.game.selectPet(2);
await h.game.refresh();await h.game.execute({...command,requestId:"battle-must-not-send"});await h.advance(60000);
assert.equal(h.game.machine.visual,"paused");assert.equal(h.game.petId,petBeforeBattle);
assert.equal(mock.calls.length,callsBeforeBattle);
h.game.resume();await h.flush();assert.equal(h.game.machine.visual,"idle");assert.equal(mock.calls.length,callsBeforeBattle);
await h.game.refresh();assert.equal(mock.calls.length,callsBeforeBattle+1);h.close();

// A timeout is also recovered automatically even if the transport ignores abort.
mock=createPetMock();h=mount(mock.api,savedToken);await login(h);
const commitBeforeTimeout=mock.api.execute;
mock.api.execute=async(...args)=>{await commitBeforeTimeout(...args);return new Promise(()=>{});};
void h.game.execute({...command,requestId:"recover-timeout"});await h.flush();
await h.advance(8000);assert.equal(h.game.machine.command,"uncertain");assert.equal(h.game.canRetry,false);
await h.advance(1500);assert.equal(h.game.machine.command,"idle");assert.ok(mock.calls.includes("operation"));h.close();
