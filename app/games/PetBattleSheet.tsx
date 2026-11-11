"use client";

import Image from "next/image";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { availableActions, buildFighter, createBattle, effectHint, previewDamage, stepRound } from "@/lib/domine/battle/engine";
import { BREED_BY_ID } from "@/lib/domine/battle/data";
import { MAX_ENERGY, MAX_ROUNDS, moveFor, sameAction } from "@/lib/domine/battle/rules";
import { seedFor } from "@/lib/domine/battle/rng";
import type { Action, BattleState, Side } from "@/lib/domine/battle/types";
import { actionLabel, battleCues, GROUP_LABEL, HINT_ICON, HINT_LABEL, hpColor, showBattleEvent, STAT_LABEL, STATUS_LABEL, type BattleCue, type Encounter } from "@/lib/domine/pet-battle-view";
import { PETS, type PetId } from "@/lib/domine/pet-photos";
import type { PetStage } from "@/lib/domine/pet";
import { cellBackground } from "@/lib/domine/pet-cells";

function BreedPicture({ breedId, name }: { breedId: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const own = breedId === "B001" ? 1 : breedId === "B002" ? 2 : null;
  if (failed) return own ? <Image src={PETS[own].standing.adult} alt={name} width={240} height={240} sizes="34vw" style={{ transform: "scaleX(-1)" }} /> : <span className="pet-battle-emoji" role="img" aria-label={name}>🐕</span>;
  return <Image src={`/pet/breed/${breedId}.webp`} alt={name} width={240} height={240} sizes="34vw" unoptimized loading="eager" onError={() => setFailed(true)} />;
}

type Playback = { next: BattleState; cues: BattleCue[]; index: number; shown: BattleState; revealed: number; line: string };
function playbackFor(state: BattleState, next: BattleState, cues: BattleCue[]): Playback {
  return { next, cues, index: 0, shown: state, revealed: 0, line: cues[0].text ?? "" };
}

export default function PetBattleSheet({ encounter, petId, stage, hour, onClose }: {
  encounter: Encounter; petId: PetId; stage: PetStage; hour: number; onClose: () => void;
}) {
  const attempt = useRef(0);
  const names = { player: PETS[petId].name, opponent: BREED_BY_ID[encounter.fighter.breedId].name };
  const start = (roundSeed: number) => createBattle({
    seed: seedFor(`${encounter.cellId}:${petId}:${roundSeed}`, encounter.daySeed),
    player: buildFighter(petId === 1 ? "B001" : "B002", encounter.playerLevel),
    opponent: encounter.fighter, difficulty: encounter.difficulty,
  });
  const introduction = (state: BattleState) => playbackFor(state, state, [
    { motion: "intro", duration: 2400 },
    { text: `${encounter.npc.title} ${encounter.npc.name}, ${names.opponent}와 함께 나왔어요!` },
  ]);
  const [battle, setBattle] = useState(() => start(0));
  const [playback, setPlayback] = useState<Playback | null>(() => introduction(battle));
  const [menu, setMenu] = useState<"main" | "moves">("main");
  const [preview, setPreview] = useState("");
  const [reduced, setReduced] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), message = useRef<HTMLButtonElement>(null);
  const command = useRef<HTMLButtonElement>(null);
  const heading = useId(), previewId = useId();
  const playing = useRef(true), held = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; }, [onClose]);
  const cancelHold = () => { if (holdTimer.current !== null) clearTimeout(holdTimer.current); holdTimer.current = null; };
  useEffect(() => cancelHold, []);
  useEffect(() => {
    const modal = dialog.current, opener = document.activeElement as HTMLElement | null;
    const body = document.body, scrollY = window.scrollY;
    const saved = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, width: body.style.width };
    Object.assign(body.style, { overflow: "hidden", position: "fixed", top: `-${scrollY}px`, width: "100%" });
    modal?.showModal();
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReduced(preference.matches);
    updateMotion(); preference.addEventListener("change", updateMotion);
    let popped = false;
    history.pushState({ ...history.state, petBattle: heading }, "");
    const back = () => { popped = true; closeRef.current(); };
    window.addEventListener("popstate", back);
    return () => {
      window.removeEventListener("popstate", back);
      preference.removeEventListener("change", updateMotion);
      if (!popped && history.state?.petBattle === heading) history.back();
      modal?.close(); Object.assign(body.style, saved);
      window.scrollTo({ top: scrollY, behavior: "instant" }); opener?.focus({ preventScroll: true });
    };
  }, [heading]);

  const cue = playback?.cues[playback.index];
  const text = cue?.text ?? playback?.line ?? `${names.player}, 어떤 움직임을 보여 줄까요?`;
  const characters = Array.from(text);
  const typing = !!cue?.text && playback!.revealed < characters.length;
  const intro = cue?.motion === "intro";
  const shown = playback?.shown ?? battle;
  const outcome = cue?.outcome ?? (!playback ? battle.outcome : undefined);
  const finished = !playback && !!battle.outcome;
  const phase = intro ? "intro" : finished ? "result" : playback ? "playback" : "command";

  function advance() {
    if (!playback) return;
    const index = playback.index + 1, nextCue = playback.cues[index];
    if (!nextCue) { setBattle(playback.next); setPlayback(null); playing.current = false; return; }
    setPlayback({ ...playback, index, revealed: 0, line: nextCue.text ?? playback.line,
      shown: nextCue.event ? showBattleEvent(playback.shown, nextCue.event) : playback.shown });
  }
  useEffect(() => {
    if (!playback) return;
    const delay = typing ? 18 : cue?.text ? 900 : reduced && cue?.motion ? 0 : cue?.duration ?? 0;
    const timer = setTimeout(() => {
      if (typing) setPlayback({ ...playback, revealed: playback.revealed + 1 });
      else advance();
    }, delay);
    return () => clearTimeout(timer);
    // Playback owns the immutable cue and text for this timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback, reduced]);
  useEffect(() => {
    if (!reduced && cue?.motion === "effective") navigator.vibrate?.(30);
  }, [cue, reduced]);
  useEffect(() => {
    if (phase === "playback" || phase === "intro") message.current?.focus({ preventScroll: true });
    else command.current?.focus({ preventScroll: true });
  }, [phase, menu]);

  function choose(action: Action) {
    if (playing.current || !availableActions(battle, "player").some(a => sameAction(a, action))) return;
    const next = stepRound(battle, action);
    playing.current = true; cancelHold(); setPreview(""); setMenu("main");
    setPlayback(playbackFor(battle, next.state, battleCues(next.events, names)));
  }
  function bag() {
    if (playing.current) return;
    const item = availableActions(battle, "player").find(a => a.kind === "item");
    if (item) { choose(item); return; }
    playing.current = true;
    setPlayback(playbackFor(battle, battle, [{ text: "가방이 비었어요. 기술과 숨 고르기를 활용해요!" }]));
  }
  function restart() {
    const next = start(++attempt.current);
    playing.current = true; cancelHold(); setPreview(""); setMenu("main"); setBattle(next); setPlayback(introduction(next));
  }
  const actions: (Action | null)[] = [...battle.player.moves.map(moveId => ({ kind: "move" as const, moveId })), ...Array<null>(Math.max(0, 4 - battle.player.moves.length)).fill(null), { kind: "push" }];
  const allowed = availableActions(battle, "player");
  const result = outcome === "player" ? "승리!" : outcome === "opponent" ? "아쉬운 패배" : outcome === "quit" ? "다음에 또 만나요" : "무승부";

  function hud(side: Side) {
    const actor = shown[side];
    return <section className="pet-battle-hud" data-side={side} aria-label={`${names[side]} 상태`}>
      <h3>{names[side]} <small>Lv. {actor.level}</small></h3>
      <div className="pet-battle-hp-label"><span>버틸 힘</span>{side === "player" && <span>{actor.hp}/{actor.stats.hp}</span>}</div>
      <div className="pet-battle-hp" data-color={hpColor(actor.hp, actor.stats.hp)} role="progressbar" aria-label={`${names[side]} 버틸 힘`} aria-valuemin={0} aria-valuemax={actor.stats.hp} aria-valuenow={actor.hp}>
        <span className="pet-battle-hp-trail" style={{ transform: `scaleX(${actor.hp / actor.stats.hp})` }} />
        <span className="pet-battle-hp-fill" style={{ transform: `scaleX(${actor.hp / actor.stats.hp})` }} />
      </div>
      <div className="pet-battle-energy" aria-label={`기력 ${actor.energy}/${MAX_ENERGY}`}><small>기력</small>{Array.from({ length: MAX_ENERGY }, (_, i) => <i key={i} data-filled={i < actor.energy} aria-hidden="true" />)}</div>
      <div className="pet-battle-statuses">
        {actor.statuses.map(s => <span key={s.id}>{STATUS_LABEL[s.id]}</span>)}
        {actor.buffs.map(b => <span key={b.stat}>{STAT_LABEL[b.stat]}↑</span>)}
        {actor.shield && <span>방어</span>}
      </div>
    </section>;
  }
  function fighter(side: Side) {
    const motion = outcome && outcome !== "draw" && outcome !== "quit" ? outcome === side ? "win" : "tired" : cue?.side === side ? cue.motion : undefined;
    return <div className="pet-battle-fighter" data-side={side}>
      <div className="pet-battle-platform" />
      <div className="pet-battle-entry"><div className="pet-battle-portrait" data-motion={motion}>
        {side === "player" ? <Image src={PETS[petId].standing[stage]} alt={names.player} width={320} height={320} sizes="42vw" loading="eager" /> : <BreedPicture key={shown.opponent.breedId} breedId={shown.opponent.breedId} name={names.opponent} />}
        <span className="pet-battle-flash" aria-hidden="true" />
        {motion === "win" && <span className="pet-battle-sparkles" aria-hidden="true">✦ · ✧<br />✧　✦</span>}
      </div></div>
      {cue?.side === side && cue.amount !== undefined && <strong key={`${shown.round}-${playback?.index}`} className="pet-battle-number" data-heal={cue.motion === "heal"} aria-hidden="true">{cue.motion === "heal" ? "+" : "−"}{cue.amount}</strong>}
    </div>;
  }

  return <dialog ref={dialog} className="pet-battle-screen" aria-labelledby={heading} tabIndex={-1} onCancel={e => { e.preventDefault(); if (menu === "moves" && !playback) { setMenu("main"); setPreview(""); } else onClose(); }}>
    <div className="pet-battle-scene" data-phase={phase} data-impact={cue?.motion === "effective"} key={attempt.current} onClick={intro ? advance : undefined}>
      <div className="pet-battle-arena" style={{ "--arena-bg": `url(${cellBackground(encounter.cellId, hour)})` } as CSSProperties}>
        <header className="pet-battle-topline"><h2 id={heading}>동네 겨루기</h2><span>{shown.round.toString().padStart(2, "0")} / {MAX_ROUNDS} 라운드</span></header>
        {hud("opponent")}{fighter("opponent")}{fighter("player")}{hud("player")}
        {!intro && !finished && <p className="pet-battle-forecast">{names.opponent}, {actionLabel(battle.opponentAction)}{battle.opponentAction.kind === "rest" ? "를 준비하고 있어요…" : "를 노리고 있어요…"}</p>}
        {intro && <div className="pet-battle-npc"><small>{encounter.npc.title}</small><strong>{encounter.npc.name}</strong><p>“우리 친구들, 신나게 놀아 볼까요?”</p></div>}
        {finished && <div className="pet-battle-banner" data-victory={outcome === "player"} role="status"><small>겨루기 종료</small><h3>{result}</h3><span>✦　수고했어요, {names.player}　✦</span></div>}
      </div>
      <div className="pet-battle-console">
        {finished ? <div className="pet-battle-result"><small>{encounter.npc.title} · {encounter.npc.name}</small><p>“{outcome === "player" ? "정말 멋진 움직임이었어요!" : outcome === "opponent" ? "끝까지 함께해 줘서 고마워요." : "다음에도 즐겁게 겨뤄요!"}”</p><p>{names.player}, {encounter.npc.name}에게 꾸벅!<br />함께 놀아 줘서 고마워!</p><small>곧 보상이 생겨요</small><div className="pet-battle-result-actions"><button ref={command} type="button" onClick={restart}>다시 겨루기</button><button type="button" onClick={onClose}>돌아가기</button></div></div>
          : <>
            <button ref={message} type="button" className="pet-battle-message" aria-label={intro ? "등장 연출 건너뛰기" : typing ? "대사 모두 보기" : playback ? "다음 대사" : "대결 안내"} onClick={e => { e.stopPropagation(); if (intro) advance(); else if (typing) setPlayback({ ...playback!, revealed: characters.length }); else if (cue?.text) advance(); }}>
              <small>{intro ? "새로운 친구를 만났어요" : playback ? "겨루는 중" : "우리의 차례"}</small>
              <span aria-hidden="true">{intro ? "동네 친구와의 겨루기가 시작돼요." : typing ? characters.slice(0, playback!.revealed).join("") : text}</span>
              <span className="pet-battle-sr" role="status" aria-live="polite">{intro ? "등장 연출, 눌러서 건너뛰기" : text}</span>
              <small className="pet-battle-prompt">{intro ? "탭하여 건너뛰기" : playback ? typing ? "탭하여 모두 보기" : cue?.text ? "탭하여 계속 ▾" : "움직임을 지켜봐요" : "명령을 골라 주세요"}</small>
            </button>
            {!playback ? <div className="pet-battle-command">
              <div className="pet-battle-actions" data-menu={menu} aria-label={menu === "main" ? "대결 명령" : "기술 선택"}>
                {menu === "main" ? <>
                  <button ref={command} type="button" className="pet-battle-primary" onClick={() => { setMenu("moves"); setPreview(""); }}><span aria-hidden="true">✦</span> 기술<small>움직임을 선택해요</small></button>
                  <button type="button" onClick={bag}><span aria-hidden="true">▣</span> 가방<small>대결 소모품</small></button>
                  <button type="button" disabled={!allowed.some(a => a.kind === "rest")} onClick={() => choose({ kind: "rest" })}><span aria-hidden="true">◌</span> 숨 고르기<small>기력 +4</small></button>
                  <button type="button" onClick={() => choose({ kind: "quit" })}><span aria-hidden="true">↗</span> 그만하기<small>인사하고 돌아가요</small></button>
                </> : <>
                  {actions.map((action, index) => {
                    if (!action) return <button key={`unlearned-${index}`} type="button" disabled>아직 배우는 중<small>레벨이 오르면 배워요</small></button>;
                    const move = moveFor(action)!, label = actionLabel(action), hint = effectHint(move, battle.player, battle.opponent);
                    const damage = previewDamage(move, battle.player, battle.opponent, battle.round);
                    const detail = move.kind === "attack" ? `${label} · 상성 ×${damage.multiplier} · 예상 피해 ${damage.min}~${damage.max} (명중 시) · 명중 ${damage.hitChance}%` : `${label} · ${GROUP_LABEL[move.group]} · 기력 ${move.energy} · ${move.kind === "defense" ? "방어 자세" : "능력 강화·회복"}`;
                    return <button type="button" key={label} data-group={move.group} data-hint={hint} disabled={!allowed.some(a => sameAction(a, action))} aria-describedby={previewId}
                      onPointerDown={e => { if (!e.isPrimary || e.button !== 0) return; cancelHold(); held.current = false; holdTimer.current = setTimeout(() => { held.current = true; setPreview(detail); }, 500); }}
                      onPointerUp={cancelHold} onPointerCancel={() => { cancelHold(); held.current = false; }} onPointerLeave={cancelHold}
                      onContextMenu={e => e.preventDefault()} onFocus={() => setPreview(detail)} onBlur={() => { cancelHold(); setPreview(""); }}
                      onClick={() => { if (held.current) { held.current = false; return; } choose(action); }}>
                      <strong>{label}</strong><small>{GROUP_LABEL[move.group]} · 기력 {move.energy} <span>{HINT_ICON[hint]}{HINT_LABEL[hint]}</span></small>
                    </button>;
                  })}
                  <button ref={command} type="button" className="pet-battle-back" onClick={() => { cancelHold(); held.current = false; setMenu("main"); setPreview(""); }}>← 뒤로</button>
                </>}
              </div>
              <p className="pet-battle-preview" id={previewId} role="status">{preview}</p>
            </div> : <div className="pet-battle-wait" aria-hidden="true"><span>✦</span><p>{intro ? "만남의 순간" : "친구의 움직임을 지켜봐요"}</p><small>명령은 차례가 끝나면 열려요</small></div>}
          </>}
      </div>
      {intro && <div className="pet-battle-stripes" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</div>}
    </div>
  </dialog>;
}
