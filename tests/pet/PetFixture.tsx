"use client";
import { useState } from "react";
import { PetGame } from "../../app/games/PetGame";
import { createPetMock } from "./rpc-mock";
export default function PetFixture() {
  const [mode,setMode]=useState("ready"),[mount,setMount]=useState(0);
  const [mock,setMock]=useState(()=>createPetMock());
  return <main style={{maxWidth:430,margin:"0 auto",padding:16}}>
    <label>Fixture <select aria-label="Fixture" value={mode} onChange={e=>{setMode(e.target.value);localStorage.clear();setMock(createPetMock({missing:e.target.value==="missing",v9:e.target.value!=="v8",delayMs:e.target.value==="slow"?9000:0,error:e.target.value==="constraint"?"constraint":e.target.value==="network"?"network":undefined}));setMount(n=>n+1);}}>
      <option value="ready">v9</option><option value="v8">v9 없음</option><option value="missing">v6 없음</option><option value="slow">9초 응답 유실</option><option value="constraint">SQL 제약 오류</option><option value="network">네트워크 중단</option></select></label>
    <button type="button" onClick={()=>mock.advance(60000)}>보상 시각 60초 진행</button>
    <button type="button" onClick={()=>setMount(n=>n+1)}>게임 다시 마운트</button>
    <PetGame key={mount} api={mock.api} />
  </main>;
}
