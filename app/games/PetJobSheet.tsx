"use client";

import { useEffect, useRef, useState } from "react";
import PetSheet from "./PetSheet";
import { JOB_LEVELS } from "@/lib/domine/battle/jobs";
import { battlePlayer, MOVE_KIND, STAT_LABEL } from "@/lib/domine/pet-battle-view";
import { JOB_INFO, KING_JOBS, jobChanges, jobMoves, jobName, jobPlan, recommendedJob, type JobBlock } from "@/lib/domine/pet-job-rules";
import type { KingCertification, KingJob, KingProgress } from "@/lib/domine/pet-king-rpc";
import { PETS, type PetId } from "@/lib/domine/pet-photos";

const REJECTED: Record<string, string> = {
  PROMOTION_LOCKED: "아직 조건이 모자라요", INVALID_TIER: "다시 열어서 확인해 주세요", JOB_COOLDOWN: "하루에 한 번만 바꿀 수 있어요",
  INSUFFICIENT_COINS: "코인이 모자라요", VERSION_CONFLICT: "다시 열어서 확인해 주세요", BATTLE_ACTIVE: "대결이 끝난 뒤에 바꿀 수 있어요",
};
// Korean particles follow the final consonant of the job name (선봉대장으로 / 돌격수로).
const tail = (word: string) => { const code = word.charCodeAt(word.length - 1) - 0xac00; return code >= 0 && code <= 11171 ? code % 28 : 0; };
const toward = (word: string) => `${word}${tail(word) && tail(word) !== 8 ? "으로" : "로"}`;
const subject = (word: string) => `${word}${tail(word) ? "이" : "가"}`;
function blockText(block: JobBlock) {
  if (block.kind === "level") return `Lv.${block.need}부터 할 수 있어요`;
  if (block.kind === "boss") return "E1 칸의 구역 대장 봉돌을 이기면 열려요";
  if (block.kind === "marks") return `구역 대장 승리 ${block.have}/${block.need}`;
  if (block.kind === "coins") return `코인 ${block.have}/${block.need}`;
  return `${block.hours}시간 뒤에 바꿀 수 있어요`;
}

/** 직업 고르기·전직·바꾸기. 조건 판정은 서버가 하고, 여기서는 같은 규칙으로 미리 보여 준다. */
export default function PetJobSheet({ petId, growth, coins, certifications, chooseJob, onClose, onMap }: {
  petId: PetId; growth?: KingProgress; coins: number; certifications: readonly KingCertification[];
  chooseJob?: (pet: PetId, job: KingJob, tier: 1 | 2 | 3) => Promise<{ ok: boolean; code: string }>;
  onClose: () => void; onMap: () => void;
}) {
  const level = growth?.level ?? 1, name = PETS[petId].name;
  const regions = certifications.filter(c => c.pet === petId && c.kind === "region").map(c => c.target);
  const suggested = recommendedJob(battlePlayer(petId, level).stats);
  const [job, setJob] = useState<KingJob>(growth?.job ?? suggested);
  const [armed, setArmed] = useState(false), [pending, setPending] = useState(false), [message, setMessage] = useState("");
  const disarm = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (disarm.current) clearTimeout(disarm.current); }, []);
  const plan = jobPlan(growth, job, { coins, regions });
  const title = jobName(job, plan.tier), moves = jobMoves(job);
  const action = plan.step === "max" ? "최고 단계예요" : plan.step === "switch" ? `${toward(title)} 바꾸기` : plan.step === "promote" ? `${toward(title)} 전직` : `${title} 되기`;
  const ready = !!chooseJob && !!growth && plan.step !== "max" && plan.blocks.length === 0;
  function select(next: KingJob) { setJob(next); setArmed(false); setMessage(""); }
  async function confirm() {
    if (!ready || pending) return;
    // Coins are spent and the job locks for a day, so the first tap only arms the button.
    if (!armed) { setArmed(true); disarm.current = setTimeout(() => setArmed(false), 4000); return; }
    if (disarm.current) clearTimeout(disarm.current);
    setArmed(false); setPending(true); setMessage("");
    try {
      const result = await chooseJob!(petId, job, plan.tier);
      setMessage(result.ok ? `${name}가 ${subject(title)} 됐어요` : REJECTED[result.code] ?? "저장하지 못했어요. 다시 해 주세요");
    } catch { setMessage("저장하지 못했어요. 다시 해 주세요"); }
    finally { setPending(false); }
  }
  return <PetSheet title={`${name} 직업`} onClose={onClose}>
    <div className="pet-job">
      <p className="pet-job-now">{growth?.job ? <>지금 <strong>{jobName(growth.job, growth.jobTier)}</strong> · {growth.jobTier}단계</> : level < JOB_LEVELS[0] ? `직업은 Lv.${JOB_LEVELS[0]}부터 가질 수 있어요` : "아직 직업이 없어요"}</p>
      <div className="pet-job-tabs" role="radiogroup" aria-label="직업">
        {KING_JOBS.map(id => <button type="button" key={id} role="radio" aria-checked={job === id} data-current={growth?.job === id} onClick={() => select(id)}>
          <span aria-hidden="true">{JOB_INFO[id].icon}</span>{jobName(id, growth?.job === id ? growth.jobTier : 1)}
          {growth?.job === id ? <small>현재</small> : !growth?.job && suggested === id ? <small>추천</small> : null}
        </button>)}
      </div>
      <section className="pet-job-card" aria-label={title}>
        <div className="pet-job-title"><strong>{title}</strong><span>{plan.tier}단계 · {JOB_INFO[job].line}</span></div>
        <p className="pet-job-stats">{jobChanges(job, plan.tier).map(({ stat, percent }) => <span key={stat} data-down={percent < 0}>{STAT_LABEL[stat]} {percent > 0 ? "+" : "−"}{Math.abs(percent)}%</span>)}</p>
        <h3>직업 기술</h3>
        <ul className="pet-job-moves">
          {moves.map(move => { const open = growth?.job === job && growth.jobTier >= move.learn!.tier! && level >= move.learn!.level;
            return <li key={move.id} data-open={open} data-kind={move.kind}><span aria-hidden="true">{MOVE_KIND[move.kind].icon}</span><b>{move.name}</b><small>{open ? "사용 중" : `${move.learn!.tier}단계 · Lv.${move.learn!.level}`}</small></li>; })}
        </ul>
        <p className="pet-job-hint">새로 열린 직업 기술 2개가 대결에 추가돼요.</p>
        {plan.blocks.length > 0 && <ul className="pet-job-blocks" aria-label="필요한 조건">
          {plan.blocks.map(block => <li key={block.kind}>{blockText(block)}{block.kind === "boss" && <button type="button" onClick={onMap}>지도 열기</button>}</li>)}
        </ul>}
        <button type="button" className="pet-job-confirm" data-armed={armed} disabled={!ready || pending} aria-busy={pending} onClick={() => void confirm()}>
          {pending ? "저장 중…" : armed ? "한 번 더 누르면 정해져요" : <>{action}{plan.step !== "max" && plan.cost > 0 && <small> · 🪙 {plan.cost}</small>}</>}
        </button>
        {plan.step === "switch" && plan.blocks.length === 0 && <p className="pet-job-hint">바꾸면 하루 동안 다시 바꿀 수 없어요.</p>}
        {message && <p className="pet-job-message" role="status">{message}</p>}
      </section>
    </div>
  </PetSheet>;
}
