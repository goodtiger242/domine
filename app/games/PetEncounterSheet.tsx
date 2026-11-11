"use client";

import Image from "next/image";
import { useState } from "react";
import { conditionPenalty } from "@/lib/domine/battle/rules";
import { encounterLine, encounterMatchup, GROUP_LABEL, speciesBadges, type Encounter } from "@/lib/domine/pet-battle-view";
import PetSheet from "./PetSheet";

function Picture({ encounter }: { encounter: Encounter }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span role="img" aria-label={encounter.name}>🐾</span> : <Image src={encounter.art} alt={encounter.name} width={160} height={160} unoptimized onError={() => setFailed(true)} />;
}

export default function PetEncounterSheet({ encounters, selected, petId, onSelect, onStart, onClose }: {
  encounters: readonly Encounter[]; selected: Encounter | null; petId: number;
  onSelect: (encounter: Encounter) => void; onStart: () => void; onClose: () => void;
}) {
  const line = selected ? encounterLine(selected, "enter", selected.individual.seed) : "";
  return <PetSheet title={selected ? "겨룰까요?" : "누구와 겨룰까요?"} onClose={onClose}>
    {selected ? <div className="pet-encounter-card">
      <div className="pet-encounter-portrait"><Picture key={selected.id} encounter={selected} />{line && <p className="pet-encounter-line">{line}</p>}</div>
      <h3>{selected.name}</h3>
      <p>Lv.{selected.level} · {GROUP_LABEL[selected.individual.group]} {encounterMatchup(selected, petId)}</p>
      <p>{selected.individual.owner ? `${selected.individual.owner.name} · ${selected.individual.owner.title}` : selected.individual.ownerLabel}</p>
      <div className="pet-species-badges">{speciesBadges(selected).map(badge => <span key={badge}>{badge}</span>)}</div>
      <p>배부름 {selected.individual.condition.fullness} · 기분 {selected.individual.condition.mood} · 청결 {selected.individual.condition.clean}</p>
      {conditionPenalty(selected.individual.condition) > 0 && <p>컨디션 감소 {Math.round(conditionPenalty(selected.individual.condition) * 100)}%</p>}
      <div className="pet-encounter-buttons"><button type="button" className="pet-primary" onClick={onStart}>겨루기</button><button type="button" onClick={onClose}>아니요</button></div>
    </div> : <ul className="pet-encounter-list">{encounters.map(encounter => <li key={encounter.id}><button type="button" onClick={() => onSelect(encounter)}>
      <Picture encounter={encounter} /><span><strong title={encounter.name}>{encounter.name}</strong><small>Lv.{encounter.level} · {GROUP_LABEL[encounter.individual.group]} {encounterMatchup(encounter, petId)}</small></span>
    </button></li>)}</ul>}
  </PetSheet>;
}
