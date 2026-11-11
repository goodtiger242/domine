import type { PetApi, PetCommand, PetHistoryEntry, V6Result } from "../../lib/domine/pet-rpc";
import type { PetId } from "../../lib/domine/pet-photos";
import { PetRpcError, supportsExploration } from "../../lib/domine/pet-rpc";
import type { PetIdentity } from "../../lib/domine/pet-identity";
import type { PetState } from "../../lib/domine/pet";
import { type Reward } from "../../lib/domine/pet-progress";
import { SHOP } from "../../lib/domine/pet-catalog";

export function createPetMock(options: { missing?: boolean; v9?: boolean; busyLock?: boolean; delayMs?: number; error?: "constraint" | "network" } = {}) {
  const shared: PetState = { name: "도미", fullness: 100, mood: 100, clean: 100, care_total: 120, today_top: [], recent: [], cooldown: { feed:0,treat:0,pet:0,play:0,walk:0,brush:0,bath:0,train:0 } };
  let owner: PetIdentity | null = null, version = 0, coins = 100, now = Date.parse("2026-11-11T09:00:00Z");
  const owners = new Map<string, PetIdentity>();
  const busy: Partial<Record<PetId, { until: number; nickname: string; action: import("../../lib/domine/pet").PetAction }>> = {};
  const xp: Record<PetId, number> = { 1: 0, 2: 0 }, inventory: Record<PetId, string[]> = { 1: [], 2: [] };
  const album: string[] = [], badges: string[] = [], history: PetHistoryEntry[] = [];
  const equipment: NonNullable<V6Result["equipment"]> = [], calls: string[] = [];
  const operations = new Map<string, { input: string; result: V6Result }>();
  let daily=0, exploreStarts=0, exploreFinishes=0, lastStart: number | null = null;
  let ticket: V6Result["ticket"] = null;
  let walk: { id: string; last: number; expires: number; closed: boolean } | null = null, walkClaims = 0;
  const log = (pet: PetId, kind: PetHistoryEntry["kind"], detail: string | null) => {
    history.push({ nickname: owner!.nickname, pet, kind, detail, at: new Date(now).toISOString() });
    while (history.length > 100 || (history.length && Date.parse(history[0].at) < now - 14 * 86400000)) history.shift();
  };
  const snapshot = (pet: PetId = 1): V6Result => ({ ok:true,code:"OK",serverNow:new Date(now).toISOString(),version,pet,coins,levels:{1:1,2:1},player:{xp:xp[pet],level:1,coins},inventory:[...inventory[pet]],album:[...new Set([...album,...inventory[1],...inventory[2]])],badges:[...badges],equipment:equipment.map(e=>({...e})),daily:{reward_actions:daily,explore_finishes:exploreFinishes,walk_claims:walkClaims},ticket,season:"ordinary",shared:{applied:false,reason:"공동 수치는 충분해요",pet:{...shared}}, ...(options.busyLock ? { busy: busy[pet] && busy[pet]!.until > now ? { nickname: busy[pet]!.nickname, action: busy[pet]!.action, remainingMs: busy[pet]!.until - now } : null } : {}) });
  const failure = (code: string): V6Result => ["AUTH_FAILED", "NICKNAME_TAKEN"].includes(code)
    ? {ok:false,code,serverNow:new Date(now).toISOString()} : {...snapshot(),ok:false,code};
  const authorized = (i: PetIdentity) => owners.get(i.nickname.toLowerCase())?.secret === i.secret;
  const api: PetApi = {
    capabilities: async()=>options.missing ? false : {version:6,sharedEconomy:true,explorationThemes:24,v9:options.v9!==false,v10:true,perPetShop:true,history:true,busyLock:options.busyLock===true},
    history: async()=> { calls.push("history"); return history.filter(row=>Date.parse(row.at)>=now-14*86400000).slice(-30).reverse().map(row=>({...row})); },
    legacy: async(pet,nickname,action)=> { calls.push(action ? "legacy-action" : "legacy-state"); return { data: action ? {ok:true} : {...shared,name:pet===1?"도미":"미네"},error:null,petId:pet,legacy:false }; },
    register: async(i)=> {
      calls.push("register");
      if (!/^[가-힣a-zA-Z0-9]{1,8}$/.test(i.nickname) || !/^[0-9a-f]{64}$/.test(i.secret)) return failure("INVALID_INPUT");
      if(owners.has(i.nickname.toLowerCase())&&!authorized(i)) return failure("NICKNAME_TAKEN");
      owner={...i}; owners.set(i.nickname.toLowerCase(), owner); return snapshot();
    },
    state: async(i,pet)=> { calls.push("state"); return authorized(i)?snapshot(pet):failure("AUTH_FAILED"); },
    operation: async(i,id)=> { calls.push("operation"); return authorized(i) ? operations.get(`${i.nickname}:${id}`)?.result ?? failure("NOT_FOUND") : failure("AUTH_FAILED"); },
    execute: async(i,command:PetCommand)=> {
      calls.push(command.kind);
      if(options.error==="constraint") throw new PetRpcError("23514",true);
      if(options.error==="network") throw new TypeError("Failed to fetch");
      if(!authorized(i)) return failure("AUTH_FAILED");
      owner = i;
      const operationKey = `${i.nickname}:${command.requestId}`;
      const serialized=JSON.stringify(command), existing=operations.get(operationKey);
      if(existing) return existing.input===serialized ? existing.result : failure("REQUEST_CONFLICT");
      const pet = "pet" in command ? command.pet ?? 1 : 1;
      if (options.busyLock && command.kind === "action") {
        if ((busy[pet]?.until ?? 0) > now) {
          const result = { ...snapshot(pet), ok: false, code: "BUSY", requestId: command.requestId };
          operations.set(operationKey, { input: serialized, result });
          return result;
        }
        if (command.durationMs !== undefined && !Number.isInteger(command.durationMs)) return failure("INVALID_INPUT");
        busy[pet] = { until: now + Math.max(500, Math.min(20000, command.durationMs ?? 6000)), nickname: i.nickname, action: command.action };
      }
      let code="OK"; const gain=0, money=0, levelCoins=0; const entries:string[]=[],freshBadges:string[]=[];
      let skipped: Reward["skipped"];
      if(command.kind==="action") {
        daily++;
        if(!badges.includes("A01")){badges.push("A01");freshBadges.push("A01");}
      } else if(command.kind==="purchase") {
        const item=SHOP.find(item=>item.id===command.item);
        if(!item) code="INVALID_INPUT"; else if(inventory[pet].includes(item.id)) code="ALREADY_OWNED";
        else if(coins<item.price!) code="INSUFFICIENT_COINS";
        else { coins-=item.price!; inventory[pet].push(item.id);if(!album.includes(item.id)){album.push(item.id);entries.push(item.id);}log(pet,"purchase",item.id); }
      } else if(command.kind==="equip") {
        if(command.item && !inventory[pet].some(id=>id===command.item&&SHOP.find(item=>item.id===id)?.slot===command.slot)) code="NOT_OWNED";
        else { const found=equipment.find(e=>e.pet_id===command.pet&&e.slot===command.slot);if(found)found.item_id=command.item;else equipment.push({pet_id:command.pet,slot:command.slot,item_id:command.item});log(pet,"equip",command.item); }
      } else if(command.kind==="explore_begin") {
        if(!supportsExploration(options.v9!==false,command.map)) code="SERVER_UPDATE_REQUIRED";
        else if(!ticket || ticket.map_id!==command.map || Date.parse(ticket.expires_at)<=now) {
          ticket=null;
          if(exploreStarts>=60 || (lastStart!==null && now-lastStart<10000)) code="RATE_LIMITED";
          else { lastStart=now;exploreStarts++;ticket={id:`ticket-${exploreStarts}`,map_id:command.map,eligible_at:new Date(now+15000).toISOString(),expires_at:new Date(now+600000).toISOString()}; }
        }
      } else if(command.kind==="explore_finish") {
        if(!ticket || ticket.id!==command.ticket || Date.parse(ticket.expires_at)<=now) code="EXPIRED";
        else if(now<Date.parse(ticket.eligible_at)) code="TOO_EARLY";
        else if(exploreFinishes>=30) { skipped="DAILY_CAP";ticket=null; }
        else { exploreFinishes++;const entry={church:"001",field:"013",street:"025",park:"037",home:"049",playground:"014",stream:"018",churchback:"001",alley:"025",market:"025",station:"027",mountain:"016",lake:"018",school:"027",foodstreet:"026",cafestreet:"026",bakery:"026",apartment:"052",bikepath:"018",overlook:"041",garden:"013",bridge:"018",pilgrimpath:"016",farm:"013"}[ticket.map_id]; if(!album.includes(entry)){album.push(entry);entries.push(entry);}ticket=null; }
      } else if(command.kind==="walk_begin") {
        walk={id:command.requestId,last:now,expires:now+1800000,closed:false};
      } else if(command.kind==="walk_claim" || command.kind==="walk_end") {
        if(!walk || walk.id!==command.session) code="INVALID_INPUT";
        else if(command.kind==="walk_end") walk.closed=true;
        else if(walk.closed || now>=walk.expires) code="EXPIRED";
        else if(now-walk.last<150000) code="TOO_EARLY";
        else if(walkClaims>=4) code="RATE_LIMITED";
        else {walk.last=now;walkClaims++;}
      }
      if(command.kind==="action") log(pet,"action",command.action);
      for(const entry of entries) log(pet,"discover",entry);
      coins+=money+levelCoins;version++;
      const result={...snapshot(pet),ok:code==="OK",code,requestId:command.requestId,reward:{xp:gain,coins:money,levelCoins,newEntries:entries,newBadges:freshBadges,...(skipped?{skipped}:{})}};
      operations.set(operationKey,{input:serialized,result});
      // Commit first, then delay delivery to exercise response-loss recovery.
      if(options.delayMs) await new Promise(r=>setTimeout(r,options.delayMs));
      return result;
    },
  };
  return {api,calls,advance:(ms:number)=>{now+=ms;},state:snapshot,historyCount:()=>history.length};
}
