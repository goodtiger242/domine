"use client";

import Image from "next/image";
import PetSheet from "./PetSheet";
import { BREED_BY_ID, CONSUMABLES } from "@/lib/domine/battle/data";
import { conditionPenalty, critChance, moveFor } from "@/lib/domine/battle/rules";
import { JOBS, JOB_LEVELS, selectedJob } from "@/lib/domine/battle/jobs";
import type { Condition, Fighter, Stat } from "@/lib/domine/battle/types";
import { actionLabel, battlePlayer, GROUP_LABEL, MOVE_KIND, STAT_LABEL } from "@/lib/domine/pet-battle-view";
import { kingProgress } from "@/lib/domine/pet-king-client";
import type { KingProgress } from "@/lib/domine/pet-king-rpc";
import { PETS, type PetId } from "@/lib/domine/pet-photos";
import type { PetStage } from "@/lib/domine/pet";

const STATS: readonly Stat[] = ["hp", "attack", "defense", "speed", "focus", "calm"];
const TRAIT: Record<string, string> = {
  restDamage: "쉰 뒤 첫 공격 강화", earlySpeed: "초반 민첩 증가", firstTrack: "첫 추적 공격 강화",
  firstShield: "첫 피해 감소", thirdEnergy: "3라운드에 기력 회복", longBuff: "첫 강화가 더 오래 지속",
  firstBond: "첫 교감 공격 강화", firstRush: "첫 돌진 공격 강화", trackDamage: "추적 공격 강화", statusImmune: "첫 상태 이상 방어",
};

function jobName(fighter: Fighter) {
  const job = selectedJob(fighter.job);
  return job ? JOBS[job.id].names[job.tier - 1] : `아직 없어요 · Lv.${JOB_LEVELS[0]}부터`;
}

/** 메인 화면에서 보는 내 강아지 정보(읽기 전용): 레벨·경험치·능력치·기술·특성·컨디션. */
export default function PetStatusSheet({ petId, growth, condition, stage, onClose, supportMove }: {
  petId: PetId; growth?: KingProgress; condition?: Condition; stage: PetStage; onClose: () => void; supportMove?: string;
}) {
  const level = growth?.level ?? 1, xp = growth?.xp ?? 0;
  const breedId = petId === 1 ? "B001" : "B002", breed = BREED_BY_ID[breedId];
  const fighter = battlePlayer(petId, level, condition, [], supportMove, growth);
  const progress = kingProgress(xp, level), penalty = condition ? Math.round(conditionPenalty(condition) * 100) : 0;
  const peak = Math.max(...STATS.filter(key => key !== "hp").map(key => fighter.stats[key]), 1);
  const moves = [...fighter.moves, ...(fighter.finisher ? [fighter.finisher] : [])];
  const held = CONSUMABLES.filter(item => (growth?.inventory[item.id] ?? 0) > 0);
  return <PetSheet title={`${PETS[petId].name} 정보`} onClose={onClose}>
    <div className="pet-status">
      <header className="pet-status-head">
        <Image src={PETS[petId].standing[stage]} alt="" width={72} height={72} />
        <div>
          <strong>{PETS[petId].name} Lv.{level}</strong>
          <span className="pet-status-xp" role="progressbar" aria-label="경험치" aria-valuemin={0} aria-valuemax={progress.needed || 1} aria-valuenow={progress.needed ? progress.current : 1}>
            <i style={{ transform: `scaleX(${progress.needed ? progress.current / progress.needed : 1})` }} />
          </span>
          <small>{progress.needed ? `다음 레벨까지 ${progress.needed - progress.current}` : "최고 레벨"}{growth && growth.streak > 1 ? ` · ${growth.streak}연승` : ""}</small>
        </div>
      </header>
      <ul className="pet-status-stats" aria-label="능력치">
        {STATS.map(key => <li key={key}>
          <span>{STAT_LABEL[key]}</span>
          <b className="pet-status-bar" aria-hidden="true"><u style={{ width: `${key === "hp" ? 100 : Math.round(fighter.stats[key] / peak * 100)}%` }} /></b>
          <em>{fighter.stats[key]}</em>
        </li>)}
      </ul>
      <p className="pet-status-chips">
        <span>기운 {GROUP_LABEL[breed.group]}</span>
        <span>크리티컬 {Math.round(critChance(fighter))}%</span>
        <span>직업 {jobName(fighter)}</span>
        {penalty > 0 && <span data-warn="true">컨디션 −{penalty}%</span>}
      </p>
      <p className="pet-status-trait">특성 · {TRAIT[breed.trait] ?? "없음"}</p>
      {held.length > 0 && <p className="pet-status-items">소모품 {held.length}종 · {held.reduce((sum, item) => sum + growth!.inventory[item.id], 0)}개</p>}
      <ul className="pet-status-moves" aria-label="장착 기술">
        {moves.map(id => { const move = moveFor({ kind: "move", moveId: id }); return <li key={id} data-kind={move?.kind ?? "support"}>
          <span aria-hidden="true">{MOVE_KIND[move?.kind ?? "support"].icon}</span>{actionLabel({ kind: "move", moveId: id })}
        </li>; })}
      </ul>
    </div>
  </PetSheet>;
}
