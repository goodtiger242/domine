"use client";

import Image from "next/image";
import { useState } from "react";
import { learnset } from "@/lib/domine/battle/learnset";
import { CONSUMABLES, MOVE_BY_ID } from "@/lib/domine/battle/data";
import { itemEffect } from "@/lib/domine/pet-king-items";
import { conditionPenalty } from "@/lib/domine/battle/rules";
import { encounterLine, encounterMatchup, GROUP_LABEL, speciesBadges, type Encounter } from "@/lib/domine/pet-battle-view";
import { DIFFICULTY_LABEL, type Difficulty } from "@/lib/domine/pet-difficulty";
import PetSheet from "./PetSheet";

function Picture({ encounter }: { encounter: Encounter }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span role="img" aria-label={encounter.name}>🐾</span> : <Image src={encounter.art} alt={encounter.name} width={160} height={160} unoptimized onError={() => setFailed(true)} />;
}

export default function PetEncounterSheet({ encounters, selected, petId, onSelect, onStart, onClose, inventory = {}, items = [], onItems, supportMove, onSupportMove, rate }: {
  rate?: (encounter: Encounter) => Difficulty;
  supportMove?: string; onSupportMove?: (id: string) => void;
  inventory?: Record<string,number>; items?: readonly string[]; onItems?: (items: string[]) => void;
  encounters: readonly Encounter[]; selected: Encounter | null; petId: number;
  onSelect: (encounter: Encounter) => void; onStart: () => void; onClose: () => void;
}) {
  const line = selected ? encounterLine(selected, "enter", selected.individual.seed) : "";
  const ordered = [...encounters].sort((a, b) => {
    const easy = (e: Encounter) => e.playerLevel <= 2 && e.level <= e.playerLevel && ["순둥이", "보통"].includes(e.individual.intelligence);
    return Number(easy(b)) - Number(easy(a));
  });
  return <PetSheet title={selected ? "겨룰까요?" : "누구와 겨룰까요?"} onClose={onClose}>
    {selected ? <div className="pet-encounter-card">
      <div className="pet-encounter-portrait"><Picture key={selected.id} encounter={selected} />{line && <p className="pet-encounter-line">{line}</p>}</div>
      <h3>{selected.name}</h3>
      <p>Lv.{selected.level} · {GROUP_LABEL[selected.individual.group]} {encounterMatchup(selected, petId)}{rate && <b className="pet-diff" data-level={rate(selected)}>{DIFFICULTY_LABEL[rate(selected)]}</b>}</p>
      <p>{selected.individual.owner ? `${selected.individual.owner.name} · ${selected.individual.owner.title}` : selected.individual.ownerLabel}</p>
      <div className="pet-species-badges">{speciesBadges(selected).map(badge => <span key={badge}>{badge}</span>)}</div>
      <p>배부름 {selected.individual.condition.fullness} · 기분 {selected.individual.condition.mood} · 청결 {selected.individual.condition.clean}</p>
      {conditionPenalty(selected.individual.condition) > 0 && <p>컨디션 감소 {Math.round(conditionPenalty(selected.individual.condition) * 100)}%</p>}
      {onSupportMove && <label className="pet-support-select">보조 기술
        <select value={supportMove ?? ""} onChange={e => onSupportMove(e.target.value)} aria-label="출전 보조 기술"><option value="">추천 기술</option>{learnset("dog",petId === 1 ? "B001" : "B002",petId === 1 ? "bond" : "trick",selected.playerLevel).map(id => MOVE_BY_ID[id]).filter(m => m.kind === "support").map(m => <option key={m.id} value={m.id}>{m.name} · 기력 {m.energy} · {m.description}</option>)}</select>
      </label>}
      {CONSUMABLES.some(i => inventory[i.id] > 0) && <section className="pet-encounter-items" aria-label="반입 물품">
        <strong>전투 물품 {items.length}/3종</strong><small>종류마다 1개 · 사용하면 한 라운드 행동</small>
        <div className="pet-chips">{CONSUMABLES.filter(i => inventory[i.id] > 0).map(item => <button type="button" key={item.id} title={itemEffect(item)} aria-pressed={items.includes(item.id)} disabled={!items.includes(item.id) && items.length >= 3} onClick={() => onItems?.(items.includes(item.id) ? items.filter(id => id !== item.id) : [...items,item.id])}>{item.name} x{inventory[item.id]}</button>)}</div>
      </section>}
      <div className="pet-encounter-buttons"><button type="button" className="pet-primary" onClick={onStart}>겨루기</button><button type="button" onClick={onClose}>아니요</button></div>
    </div> : <ul className="pet-encounter-list">{ordered.map(encounter => <li key={encounter.id}><button type="button" onClick={() => onSelect(encounter)}>
      <Picture encounter={encounter} /><span><strong title={encounter.name}>{encounter.name}</strong><small>Lv.{encounter.level} · {GROUP_LABEL[encounter.individual.group]} {encounterMatchup(encounter, petId)}{rate && <b className="pet-diff" data-level={rate(encounter)}>{DIFFICULTY_LABEL[rate(encounter)]}</b>}</small></span>
    </button></li>)}</ul>}
  </PetSheet>;
}
