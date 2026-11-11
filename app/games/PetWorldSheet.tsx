"use client";
import { spawnsFor } from "@/lib/domine/pet-battle-view";
import { useState } from "react";
import { PET_WORLD, worldCell } from "@/lib/domine/pet-world";
import PetSheet from "./PetSheet";

export default function PetWorldSheet({ current, visited, onMove, onClose, slot, wins, careLevel = 1, showAnimals = false, onAnimals }: {
  current: string; visited: string[]; onMove: (to: string) => void; onClose: () => void;
  slot: number; wins: readonly string[]; careLevel?: number; showAnimals?: boolean; onAnimals?: (visible: boolean) => void;
}) {
  const [selected, setSelected] = useState(current);
  const cell = worldCell(selected);
  const [zoom, setZoom] = useState(false);
  const [animals, setAnimals] = useState(showAnimals);
  return <PetSheet title="우리 동네 지도" onClose={onClose} footer={selected !== current && <div className="pet-world-confirm" role="alertdialog" aria-label={`${cell.name}(으)로 이동할까요?`}>
    <p>{cell.name}(으)로 갈까요?</p>
    <div><button type="button" data-primary onClick={() => onMove(cell.id)}>이동</button>
      <button type="button" onClick={() => setSelected(current)}>취소</button></div>
  </div>}>
    <p className="pet-sheet-note"><button type="button" className="pet-world-zoom" aria-pressed={animals} onClick={() => { setAnimals(!animals); onAnimals?.(!animals); }}>{animals ? "🐾 동물 숨기기" : "🐾 동물 보기"}</button> <button type="button" className="pet-world-zoom" aria-pressed={zoom} onClick={() => { setZoom(!zoom); if (!zoom) requestAnimationFrame(() => document.querySelector(".pet-world-grid [aria-current=location]")?.scrollIntoView({ block: "center", inline: "center" })); }}>{zoom ? "전체 보기" : "확대"}</button></p>
    <div className="pet-world-scroll" data-zoom={zoom} tabIndex={0} aria-label="동네 지도, 확대하면 상하좌우로 스크롤">
      <div className="pet-world-grid" role="group" aria-label="서쪽 A열부터 동쪽 J열, 북쪽 1행부터 남쪽 10행">
        {PET_WORLD.map((place) => {
          const isHere = place.id === current;
          const foes = animals ? spawnsFor(place.id, careLevel, slot, wins) : [];
          return <button type="button" key={place.id}
            aria-label={`${place.id} ${place.name}${isHere ? ", 현재 위치" : ", 이동"}${foes.length ? `, 동물 ${foes.length}마리, ${foes.map(e => `${e.name} Lv.${e.level}`).join(", ")}` : ""}`}
            aria-current={isHere ? "location" : undefined} aria-pressed={place.id === selected}
            data-neighbor={!isHere} data-selected={place.id === selected}
            onClick={() => setSelected(place.id)}>
            <span aria-hidden="true">{isHere ? "🐕" : ""}</span>
            <small>{place.id}</small>
            {foes.length > 0 && <em className="pet-world-animals" aria-hidden="true"><span>{"🐾".repeat(foes.length)}</span><small>Lv.{Math.max(...foes.map(e => e.level))}</small></em>}
          </button>;
        })}
      </div>
      <small className="pet-world-credit">© OpenStreetMap</small>
    </div>
  </PetSheet>;
}
