"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { availableActions, buildFighter, createBattle, effectHint, previewDamage, stepRound } from "@/lib/domine/battle/engine";
import { BREED_BY_ID } from "@/lib/domine/battle/data";
import { MAX_ENERGY, MAX_ROUNDS, moveFor, sameAction } from "@/lib/domine/battle/rules";
import { seedFor } from "@/lib/domine/battle/rng";
import type { Action, BattleEvent, BattleState, Side } from "@/lib/domine/battle/types";
import { actionLabel, HINT_LABEL, showBattleEvent, STAT_LABEL, STATUS_LABEL, type Encounter } from "@/lib/domine/pet-battle-view";
import { PETS, type PetId } from "@/lib/domine/pet-photos";
import type { PetStage } from "@/lib/domine/pet";
import PetSheet from "./PetSheet";

type Playback = { next: BattleState; events: BattleEvent[]; index: number; shown: BattleState };

export default function PetBattleSheet({ encounter, petId, stage, onClose }: {
  encounter: Encounter; petId: PetId; stage: PetStage; onClose: () => void;
}) {
  const attempt = useRef(0);
  const start = (roundSeed: number) => createBattle({
    seed: seedFor(`${encounter.cellId}:${petId}:${roundSeed}`, encounter.daySeed),
    player: buildFighter(petId === 1 ? "B001" : "B002", encounter.playerLevel),
    opponent: encounter.fighter, difficulty: encounter.difficulty,
  });
  const [battle, setBattle] = useState(() => start(0));
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [preview, setPreview] = useState("");
  const previewId = useId();
  const playing = useRef(false), held = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHold = () => { if (holdTimer.current !== null) clearTimeout(holdTimer.current); holdTimer.current = null; };
  useEffect(() => cancelHold, []);
  useEffect(() => {
    if (!playback) return;
    const timer = setTimeout(() => {
      const event = playback.events[playback.index];
      if (event) setPlayback({ ...playback, index: playback.index + 1, shown: showBattleEvent(playback.shown, event) });
      else { setBattle(playback.next); setPlayback(null); playing.current = false; }
    }, 600);
    return () => clearTimeout(timer);
  }, [playback]);

  const shown = playback?.shown ?? battle;
  const event = playback?.events[playback.index - 1];
  const name = (side: Side) => side === "player" ? PETS[petId].name : BREED_BY_ID[shown.opponent.breedId].name;
  function eventText(e: BattleEvent) {
    if (e.type === "end") return "겨루기를 마쳤어요. 서로 인사해요!";
    const who = name(e.side);
    switch (e.type) {
      case "action": return `${who} · ${actionLabel(e.action)}!`;
      case "hit": return `${who}의 움직임이 닿았어요!`;
      case "miss": return `${name(e.target)}가 가볍게 피했어요!`;
      case "effectiveness": return `상성 · ${HINT_LABEL[e.hint]}`;
      case "damage": return `${name(e.target)} · 버틸 힘 −${e.amount}`;
      case "heal": return `${who} · 버틸 힘 +${e.amount}`;
      case "energy": return `${who} · 기력 ${e.amount >= 0 ? "+" : ""}${e.amount}`;
      case "status": return `${who} · ${STATUS_LABEL[e.status]} ${e.change === "applied" ? "생김" : e.change === "blocked" ? "막음" : "해제"}`;
      case "buff": return `${who} · ✨ ${STAT_LABEL[e.stat]} ${e.change === "applied" ? "상승" : "원래대로"}`;
      case "shield": return `${who} · 🛡️ ${e.change === "applied" ? "단단히 버텨요" : "방어 해제"}`;
    }
  }
  function choose(action: Action) {
    if (playing.current || !availableActions(battle, "player").some(a => sameAction(a, action))) return;
    const next = stepRound(battle, action);
    playing.current = true; cancelHold(); setPreview("");
    setPlayback({ next: next.state, events: next.events, index: 0, shown: battle });
  }
  const actions: Action[] = [...battle.player.moves.map(moveId => ({ kind: "move" as const, moveId })), { kind: "push" }, { kind: "rest" }];
  const allowed = availableActions(battle, "player");
  const outcome = !playback && battle.outcome;
  const result = outcome === "player" ? "승리했어요!" : outcome === "opponent" ? "이번엔 졌어요" : "무승부예요";
  const reaction = petId === 1
    ? outcome === "player" ? "도미가 꼬리를 흔들며 다가와요." : outcome === "opponent" ? "도미가 차분히 기대 와요. 다음에도 함께해요." : "도미가 친구와 나란히 앉아요."
    : outcome === "player" ? "미네가 신나게 앞발을 톡톡 굴러요!" : outcome === "opponent" ? "미네가 씩씩하게 몸을 털어요. 한 번 더!" : "미네가 고개를 갸웃하고 꼬리를 흔들어요.";

  function fighter(side: Side) {
    const actor = shown[side], breed = BREED_BY_ID[actor.breedId];
    const motion = event?.type === "hit" ? event.side === side ? "attack" : "hit" : "";
    const number = event?.type === "damage" && event.target === side ? `−${event.amount}` : event?.type === "heal" && event.side === side ? `+${event.amount}` : null;
    return <section className="pet-battle-fighter" data-side={side} aria-label={side === "player" ? "우리 강아지" : "상대 강아지"}>
      <div className="pet-battle-portrait" key={`${playback?.index ?? 0}-${side}`} data-motion={motion}>
        {side === "player" ? <Image src={PETS[petId].standing[stage]} alt={PETS[petId].name} width={96} height={96} sizes="96px" /> : <span className="pet-battle-emoji" role="img" aria-label={breed.name}>🐕</span>}
        {number && <strong className="pet-battle-number">{number}</strong>}
      </div>
      <div className="pet-battle-stats">
        <small>{side === "opponent" ? `${encounter.npc.name} · ${encounter.npc.title}` : "우리 강아지"}</small>
        <h3>{name(side)} <small>Lv. {actor.level}</small></h3>
        {side === "player" && <small>{breed.name}</small>}
        <div className="pet-battle-hp" role="progressbar" aria-label={`${name(side)} 버틸 힘`} aria-valuemin={0} aria-valuemax={actor.stats.hp} aria-valuenow={actor.hp}>
          <span style={{ transform: `scaleX(${actor.hp / actor.stats.hp})` }} />
        </div>
        <p>버틸 힘 {actor.hp}/{actor.stats.hp} <span>⚡ 기력 {actor.energy}/{MAX_ENERGY}</span></p>
        <div className="pet-battle-statuses">
          {actor.statuses.map(s => <span key={s.id}>{STATUS_LABEL[s.id]}</span>)}
          {actor.buffs.map(b => <span key={b.stat}>✨ {STAT_LABEL[b.stat]}↑</span>)}
          {actor.shield && <span>🛡️ 방어</span>}
        </div>
      </div>
    </section>;
  }

  return <PetSheet title={`겨루기 · ${shown.round}/${MAX_ROUNDS}라운드`} onClose={onClose} fullHeight footer={
    outcome ? <div className="pet-battle-result-actions">
      <button type="button" className="pet-primary" onClick={() => { setBattle(start(++attempt.current)); setPreview(""); }}>다시 겨루기</button>
      <button type="button" onClick={onClose}>닫기</button>
    </div> : <>
      <p className="pet-battle-preview" id={previewId} role="status">{preview || (playback ? "서로의 움직임을 보고 있어요…" : "길게 누르면 예상 피해 · 키보드는 초점으로 확인")}</p>
      <div className="pet-battle-actions" aria-label="대결 행동" aria-busy={!!playback}>
        {actions.map(action => {
          const move = moveFor(action), label = actionLabel(action);
          const damage = move ? previewDamage(move, battle.player, battle.opponent, battle.round) : null;
          const detail = damage ? `${label} · 상성 ×${damage.multiplier} · 예상 피해 ${damage.min}~${damage.max} (명중 시) · 명중 ${damage.hitChance}%` : "숨 고르기 · 기력 +4";
          return <button type="button" key={label} disabled={!!playback || !allowed.some(a => sameAction(a, action))} aria-describedby={previewId}
            onPointerDown={e => { if (!e.isPrimary || e.button !== 0) return; cancelHold(); held.current = false; holdTimer.current = setTimeout(() => { held.current = true; setPreview(detail); }, 500); }}
            onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerLeave={cancelHold}
            onContextMenu={e => e.preventDefault()} onFocus={() => setPreview(detail)} onBlur={() => { cancelHold(); setPreview(""); }}
            onClick={() => { if (held.current) { held.current = false; return; } choose(action); }}>
            <strong>{label}</strong><small>기력 {move?.energy ?? 0} · {move ? HINT_LABEL[effectHint(move, battle.player, battle.opponent)] : "평범 · +4"}</small>
          </button>;
        })}
      </div>
    </>
  }>
    <div className="pet-battle-arena">
      {fighter("opponent")}
      <div className="pet-battle-center" aria-live="polite" aria-atomic="true">
        {outcome ? <div className="pet-battle-result" role="status"><h3>{result}</h3><p>{reaction}</p><p>{encounter.npc.name}에게 꾸벅! “함께 놀아 줘서 고마워!”</p><small>지금은 보상이 없어요. 곧 보상이 생겨요</small></div>
          : <><p className="pet-battle-forecast">{playback ? "상대가 예고한 행동" : "상대의 다음 행동"} · <strong>{actionLabel(battle.opponentAction)}</strong></p>
            <p className="pet-battle-message">{event ? eventText(event) : playback ? "서로 자세를 잡아요…" : petId === 1 ? "도미가 꼬리를 흔들며 준비해요." : "미네가 앞발을 톡톡 굴리며 준비해요."}</p></>}
      </div>
      {fighter("player")}
    </div>
  </PetSheet>;
}
