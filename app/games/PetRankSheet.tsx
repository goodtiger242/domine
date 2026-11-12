"use client";
import { useEffect, useState } from "react";
import PetSheet from "./PetSheet";
import { PETS, type PetId } from "@/lib/domine/pet-photos";
import type { PetApi, PetRanking } from "@/lib/domine/pet-rpc";

const MEDAL = ["🥇", "🥈", "🥉"];
/** Same level and XP share a place (공동 순위); the next place skips, as in 1, 1, 3. */
export function places(rows: readonly { level: number; xp: number }[]) {
  return rows.map(row => rows.findIndex(other => other.level === row.level && other.xp === row.xp) + 1);
}

/** 도미·미네 레벨 순위. 열 때 한 번만 읽고, Lv.1은 아직 시작하지 않은 것으로 보고 빼고 보여 준다. */
export default function PetRankSheet({ load, petId, nickname, onClose }: {
  load: PetApi["ranking"]; petId: PetId; nickname: string; onClose: () => void;
}) {
  const [pet, setPet] = useState<PetId>(petId);
  const [ranking, setRanking] = useState<PetRanking | null>(null), [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  useEffect(() => {
    let active = true;
    load().then(result => { if (!active) return; setRanking(result); setState(result ? "ready" : "missing"); })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [load]);
  const rows = ranking?.[pet] ?? [], place = places(rows);
  const note = state === "loading" ? "순위를 불러오는 중…" : state === "missing" ? "순위를 준비 중이에요." : state === "error" ? "순위를 불러오지 못했어요. 잠시 후 다시 열어 주세요."
    : rows.length ? "" : `아직 순위에 오른 ${PETS[pet].name}가 없어요.`;
  return <PetSheet title="랭킹" onClose={onClose}>
    <div className="pet-rank">
      <div className="pet-rank-tabs" role="tablist" aria-label="강아지">
        {([1, 2] as const).map(id => <button type="button" role="tab" key={id} aria-selected={pet === id} onClick={() => setPet(id)}>{PETS[id].name} 랭킹</button>)}
      </div>
      {note && <p className="pet-sheet-note" role="status">{note}</p>}
      {rows.length > 0 && <ol className="pet-rank-list" aria-label={`${PETS[pet].name} 랭킹`}>
        {rows.map((row, index) => <li key={row.nickname} data-me={row.nickname === nickname}>
          <span className="pet-rank-place" aria-label={`${place[index]}위`}>{MEDAL[place[index] - 1] ?? place[index]}</span>
          <span className="pet-rank-name">{row.nickname}{row.nickname === nickname && <small>나</small>}</span>
          <span className="pet-rank-level"><b>Lv.{row.level}</b><small>{row.xp.toLocaleString("ko-KR")} XP</small></span>
        </li>)}
      </ol>}
      <p className="pet-rank-foot">레벨이 같으면 경험치가 많은 쪽이 위예요. Lv.2부터 순위에 올라요.</p>
    </div>
  </PetSheet>;
}
