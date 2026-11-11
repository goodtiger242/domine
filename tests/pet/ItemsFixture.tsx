import { useState } from "react";
import { createRoot } from "react-dom/client";
import PetShopSheet from "../../app/games/PetShopSheet";
import PetEncounterSheet from "../../app/games/PetEncounterSheet";
import PetBattleSheet from "../../app/games/PetBattleSheet";
import { usePetKing } from "../../app/games/usePetKing";
import { createKingApi } from "../../lib/domine/pet-king-rpc";
import { spawnsFor, encounterSlot } from "../../lib/domine/pet-battle-view";
import { PET_WORLD } from "../../lib/domine/pet-world";
import type { V6Result } from "../../lib/domine/pet-rpc";

const identity = { nickname: "김경석", secret: "a".repeat(64) };
const api = createKingApi(async (_name,args) => ({data:await (await fetch("/rpc",{method:"POST",body:JSON.stringify(args)})).json(),error:null}));
const refreshWallet = async () => {};
function Fixture() {
  const [mode,setMode]=useState("shop"),[pet,setPet]=useState<1|2>(1),[items,setItems]=useState<string[]>([]),[support,setSupport]=useState("");
  const king=usePetKing(api,identity,"F5",undefined,false,refreshWallet);
  const progress=king.state?.pets.find(p=>p.pet===pet);
  const [encounter]=useState(()=>PET_WORLD.flatMap(c=>spawnsFor(c.id,1,encounterSlot())).find(e=>e.level<=8)!);
  const close=()=>setMode("home");
  const personal={coins:king.state?.coins??0,player:{},inventory:[],equipment:[]} as unknown as V6Result;
  return <><nav><button onClick={()=>setMode("shop")}>테스트 상점</button><button onClick={()=>setMode("bag")}>테스트 가방</button><button onClick={()=>setMode("encounter")}>테스트 반입</button></nav>
    {(mode==="shop"||mode==="bag") && <PetShopSheet pendingPurchase={king.pendingPurchase} bag={mode==="bag"} petId={pet} onSelectPet={setPet} state={personal} kingState={king.state} buyItem={king.buyItem} disabled={!king.state} notice="" execute={refreshWallet} onClose={close} onShop={()=>setMode("shop")} />}
    {mode==="encounter" && <PetEncounterSheet petId={pet} encounters={[encounter]} selected={encounter} onSelect={()=>{}} inventory={progress?.inventory} items={items} onItems={setItems} supportMove={support} onSupportMove={setSupport} onStart={()=>setMode("battle")} onClose={close} />}
    {mode==="battle" && <PetBattleSheet encounter={encounter} petId={pet} items={items} supportMove={support} stage="adult" hour={12} identity={identity} kingApi={api} onSettled={king.settled} onInventoryRefresh={king.refresh} onClose={close} baseSpeed={30} />}
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
