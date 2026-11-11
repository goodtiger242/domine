"use client";
import { useState } from "react";
import type { PetMap } from "@/lib/domine/pet-maps";
import { DIRECTIONS, PET_WORLD, neighborCell, worldCell, type Direction } from "@/lib/domine/pet-world";
import PetSheet from "./PetSheet";

const THEMES: Record<PetMap, [string, string]> = {
  field: ["🌾", "#e4eac7"], church: ["⛪", "#eadcf0"], street: ["🏪", "#e6e0d6"], park: ["🌳", "#d8e7ca"], home: ["🏠", "#f4dfc7"],
  playground: ["🛝", "#f6e8b9"], stream: ["🌊", "#cee8ed"], churchback: ["⛪", "#e2dfed"], alley: ["🏘️", "#e8ddd2"], market: ["🛒", "#f0dac7"],
  station: ["🚉", "#dce3ec"], mountain: ["⛰️", "#cdddc5"], lake: ["🌊", "#cee5f2"], school: ["🏫", "#f1e7ce"], foodstreet: ["🍜", "#f4d9ce"],
  cafestreet: ["☕", "#e9dacb"], bakery: ["🥐", "#f6e3bf"], apartment: ["🏢", "#dfe2e8"], bikepath: ["🚲", "#d5e6dd"], overlook: ["🔭", "#d5dfea"],
  garden: ["🌷", "#e6e8cb"], bridge: ["🌉", "#d6e3e7"], pilgrimpath: ["🌲", "#cddfd2"], farm: ["🌾", "#e8e4bd"],
};

export default function PetWorldSheet({ current, visited, onMove, onClose }: {
  current: string; visited: string[]; onMove: (direction: Direction) => void; onClose: () => void;
}) {
  const [selected, setSelected] = useState(current);
  const cell = worldCell(selected);
  return <PetSheet title="우리 동네 지도" onClose={onClose}>
    <p className="pet-sheet-note">인접한 네 칸으로 한 칸씩 이동해요. 먼 칸은 이름만 확인할 수 있어요.<br />🐕 현재 위치 · ✓ 다녀온 곳 · 진한 테두리: 이동 가능</p>
    <div className="pet-world-scroll" tabIndex={0} aria-label="동네 지도, 좁은 화면에서는 좌우로 스크롤">
      <div className="pet-world-grid" role="group" aria-label="서쪽 A열부터 동쪽 J열, 북쪽 1행부터 남쪽 10행">
        {PET_WORLD.map((place) => {
          const direction = DIRECTIONS.find((dir) => neighborCell(current, dir)?.id === place.id);
          const here = place.id === current, seen = visited.includes(place.id);
          return <button type="button" key={place.id} style={{ backgroundColor: THEMES[place.theme][1] }}
            aria-label={`${place.id} ${place.name}${here ? ", 현재 위치" : direction ? ", 이동 가능" : ", 이름 확인"}${seen ? ", 방문함" : ""}`}
            aria-current={here ? "location" : undefined} aria-pressed={place.id === selected}
            data-neighbor={!!direction} data-selected={place.id === selected}
            onClick={() => { setSelected(place.id); if (direction) onMove(direction); }}>
            <span aria-hidden="true">{here ? "🐕" : THEMES[place.theme][0]}</span>
            <small>{place.id}{seen && <i aria-hidden="true">✓</i>}</small>
          </button>;
        })}
      </div>
    </div>
    <p className="pet-world-info" role="status">{cell.id} · {cell.name} · {cell.kind}</p>
    <p className="pet-sheet-note">실제 동네를 압축한 게임 지도예요. A5 들판과 D5 집 마당은 가상 장소예요.</p>
  </PetSheet>;
}
