import type { PetApi, PetCommand, V6Result } from "../../lib/domine/pet-rpc";
import type { PetIdentity } from "../../lib/domine/pet-identity";
import type { PetState } from "../../lib/domine/pet";
import { ACTION_REWARDS, levelOf, rewardEligible, type Reward } from "../../lib/domine/pet-progress";
import { SHOP } from "../../lib/domine/pet-catalog";

export function createPetMock(options: { missing?: boolean; delayMs?: number } = {}) {
  const shared: PetState = { name: "도미", fullness: 100, mood: 100, clean: 100, care_total: 120, today_top: [], recent: [], cooldown: { feed:0,treat:0,pet:0,play:0,walk:0,brush:0,bath:0,train:0 } };
  let owner: PetIdentity | null = null, version = 0, xp = 32, coins = 100, now = Date.parse("2026-11-11T09:00:00Z");
  const inventory: string[] = [], album: string[] = [], badges: string[] = [];
  const equipment: NonNullable<V6Result["equipment"]> = [], calls: string[] = [];
  const operations = new Map<string, { input: string; result: V6Result }>();
  let last: number | null = null, daily=0;
  let ticket: V6Result["ticket"] = null;
  const snapshot = (): V6Result => ({ ok:true,code:"OK",serverNow:new Date(now).toISOString(),version,player:{xp,level:levelOf(xp),coins},inventory:[...inventory],album:[...album],badges:[...badges],equipment:equipment.map(e=>({...e})),daily:{reward_actions:daily,explore_finishes:0,walk_claims:0},ticket,season:"ordinary",shared:{applied:false,reason:"공동 수치는 충분해요",pet:{...shared}} });
  const failure = (code: string): V6Result => ["AUTH_FAILED", "NICKNAME_TAKEN"].includes(code)
    ? {ok:false,code,serverNow:new Date(now).toISOString()} : {...snapshot(),ok:false,code};
  const authorized = (i: PetIdentity) => owner?.nickname.toLowerCase()===i.nickname.toLowerCase() && owner.secret===i.secret;
  const api: PetApi = {
    capabilities: async()=>!options.missing,
    legacy: async(pet,nickname,action)=> { calls.push(action ? "legacy-action" : "legacy-state"); return { data: action ? {ok:true} : {...shared,name:pet===1?"도미":"미네"},error:null,petId:pet,legacy:false }; },
    register: async(i)=> { calls.push("register"); if(owner&&!authorized(i)) return failure("NICKNAME_TAKEN"); owner=i; return snapshot(); },
    state: async(i)=> { calls.push("state"); return authorized(i)?snapshot():failure("AUTH_FAILED"); },
    operation: async(i,id)=> { calls.push("operation"); return authorized(i) ? operations.get(id)?.result ?? failure("NOT_FOUND") : failure("AUTH_FAILED"); },
    execute: async(i,command:PetCommand)=> {
      calls.push(command.kind);
      if(!authorized(i)) return failure("AUTH_FAILED");
      const serialized=JSON.stringify(command), existing=operations.get(command.requestId);
      if(existing) return existing.input===serialized ? existing.result : failure("REQUEST_CONFLICT");
      let code="OK", gain=0, money=0, levelCoins=0; const entries:string[]=[],freshBadges:string[]=[];
      let skipped: Reward["skipped"];
      if(command.kind==="action" && !rewardEligible(now,last,daily)) skipped=daily>=120?"DAILY_CAP":"TOO_FAST";
      if(command.kind==="action" && !skipped) {
        [gain,money]=ACTION_REWARDS[command.action]; last=now;daily++;
        if(!badges.includes("A01")){badges.push("A01");freshBadges.push("A01");}
      } else if(command.kind==="purchase") {
        const item=SHOP.find(item=>item.id===command.item);
        if(!item) code="INVALID_INPUT"; else if(inventory.includes(item.id)) code="ALREADY_OWNED";
        else if(coins<item.price!) code="INSUFFICIENT_COINS";
        else { coins-=item.price!; inventory.push(item.id);album.push(item.id);entries.push(item.id); }
      } else if(command.kind==="equip") {
        if(command.item && !inventory.includes(command.item)) code="NOT_OWNED";
        else { const found=equipment.find(e=>e.pet_id===command.pet&&e.slot===command.slot);if(found)found.item_id=command.item;else equipment.push({pet_id:command.pet,slot:command.slot,item_id:command.item}); }
      } else if(command.kind==="explore_begin") {
        ticket={id:"00000000-0000-4000-8000-000000000099",map_id:command.map,eligible_at:new Date(now+15000).toISOString(),expires_at:new Date(now+600000).toISOString()};
      } else if(command.kind==="explore_finish") {
        if(!ticket) code="EXPIRED";
        else { gain=4;money=2;const entry={church:"001",field:"013",street:"025",park:"037",home:"049",playground:"014",stream:"018",churchback:"001",alley:"025",market:"025",station:"027",mountain:"016",lake:"018",school:"027",foodstreet:"026",cafestreet:"026",bakery:"026",apartment:"052",bikepath:"018",overlook:"041",garden:"013",bridge:"018",pilgrimpath:"016",farm:"013"}[ticket.map_id]; if(album.includes(entry))money++;else{album.push(entry);entries.push(entry);}ticket=null; }
      }
      const previous=levelOf(xp); xp=Math.min(9280,xp+gain);
      for(let level=previous+1;level<=levelOf(xp);level++)levelCoins+=10+level*2;
      coins+=money+levelCoins;version++;
      const result={...snapshot(),ok:code==="OK",code,requestId:command.requestId,reward:{xp:gain,coins:money,levelCoins,newEntries:entries,newBadges:freshBadges,...(skipped?{skipped}:{})}};
      operations.set(command.requestId,{input:serialized,result});
      // Commit first, then delay delivery to exercise response-loss recovery.
      if(options.delayMs) await new Promise(r=>setTimeout(r,options.delayMs));
      return result;
    },
  };
  return {api,calls,advance:(ms:number)=>{now+=ms;},state:snapshot};
}
