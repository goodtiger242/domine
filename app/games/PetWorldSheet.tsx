"use client";
import { useState } from "react";
import type { PetMap } from "@/lib/domine/pet-maps";
import { PET_WORLD, worldCell } from "@/lib/domine/pet-world";
import PetSheet from "./PetSheet";

const THEMES: Record<PetMap, [string, string]> = {
  field: ["🌾", "#e4eac7"], church: ["⛪", "#eadcf0"], street: ["🏪", "#e6e0d6"], park: ["🌳", "#d8e7ca"], home: ["🏠", "#f4dfc7"],
  playground: ["🛝", "#f6e8b9"], stream: ["🌊", "#cee8ed"], churchback: ["⛪", "#e2dfed"], alley: ["🏘️", "#e8ddd2"], market: ["🛒", "#f0dac7"],
  station: ["🚉", "#dce3ec"], mountain: ["⛰️", "#cdddc5"], lake: ["🌊", "#cee5f2"], school: ["🏫", "#f1e7ce"], foodstreet: ["🍜", "#f4d9ce"],
  cafestreet: ["☕", "#e9dacb"], bakery: ["🥐", "#f6e3bf"], apartment: ["🏢", "#dfe2e8"], bikepath: ["🚲", "#d5e6dd"], overlook: ["🔭", "#d5dfea"],
  garden: ["🌷", "#e6e8cb"], bridge: ["🌉", "#d6e3e7"], pilgrimpath: ["🌲", "#cddfd2"], farm: ["🌾", "#e8e4bd"],
};

export default function PetWorldSheet({ current, visited, onMove, onClose }: {
  current: string; visited: string[]; onMove: (to: string) => void; onClose: () => void;
}) {
  const [selected, setSelected] = useState(current);
  const cell = worldCell(selected);
  const [zoom, setZoom] = useState(false);
  return <PetSheet title="우리 동네 지도" onClose={onClose} footer={selected !== current && <div className="pet-world-confirm" role="alertdialog" aria-label={`${cell.name}(으)로 이동할까요?`}>
    <p><strong>{THEMES[cell.theme][0]} {cell.name}</strong><small>{cell.id} · {cell.kind}</small></p>
    <p>이곳으로 이동할까요?</p>
    <div><button type="button" onClick={() => setSelected(current)}>아니요</button>
      <button type="button" data-primary onClick={() => onMove(cell.id)}>이동하기</button></div>
  </div>}>
    <p className="pet-sheet-note">가고 싶은 칸을 누르면 이름이 나오고, 이동할지 물어봐요. 한 칸은 약 200m예요.<br />🐕 현재 위치 · ✓ 다녀온 곳 <button type="button" className="pet-world-zoom" aria-pressed={zoom} onClick={() => { setZoom(!zoom); if (!zoom) requestAnimationFrame(() => document.querySelector(".pet-world-grid [aria-current=location]")?.scrollIntoView({ block: "center", inline: "center" })); }}>{zoom ? "전체 보기" : "확대"}</button></p>
    <div className="pet-world-scroll" data-zoom={zoom} tabIndex={0} aria-label="동네 지도, 확대하면 상하좌우로 스크롤">
      <div className="pet-world-grid" role="group" aria-label="서쪽 A열부터 동쪽 J열, 북쪽 1행부터 남쪽 10행">
        {PET_WORLD.map((place) => {
          const isHere = place.id === current, seen = visited.includes(place.id);
          return <button type="button" key={place.id}
            aria-label={`${place.id} ${place.name}${isHere ? ", 현재 위치" : ", 이동"}${seen ? ", 방문함" : ""}`}
            aria-current={isHere ? "location" : undefined} aria-pressed={place.id === selected}
            data-neighbor={!isHere} data-selected={place.id === selected}
            onClick={() => setSelected(place.id)}>
            <span aria-hidden="true">{isHere ? "🐕" : ""}</span>
            <small>{place.id}{seen && <i aria-hidden="true">✓</i>}</small>
          </button>;
        })}
      </div>
    </div>
    <p className="pet-world-info" role="status">{cell.id} · {cell.name} · {cell.kind}</p>
    <p className="pet-sheet-note">지도 © OpenStreetMap contributors. D5 집 마당은 가상 장소이고, 가게 위치는 대략이에요.</p>
  </PetSheet>;
}
