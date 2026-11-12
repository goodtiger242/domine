"use client";

import Image from "next/image";
import { ownPetSheet } from "@/lib/domine/pet-sheet-history";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { availableActions, createBattle, effectHint, stepRound } from "@/lib/domine/battle/engine";
import { itemEffect, selectedItems } from "@/lib/domine/pet-king-items";
import { BREED_BY_ID, ITEM_BY_ID, MOVE_BY_ID } from "@/lib/domine/battle/data";
import { MAX_ENERGY, MAX_ROUNDS, REST_ENERGY, critChance, effectiveStat, itemUnavailable, moveFor, sameAction } from "@/lib/domine/battle/rules";
import { seedFor } from "@/lib/domine/battle/rng";
import type { Action, BattleState, Condition, Side, Stat, Trait } from "@/lib/domine/battle/types";
import { BREED_BY_ID as KING_BREEDS } from "@/lib/domine/king/species";
import { actionCost, actionLabel, battleCues, battlePlayer, compactEffect, costBadge, encounterLine, finisherDuration, moveDamage, moveDetail, movePages, rivalCues, speciesBadges, GROUP_LABEL, HINT_LABEL, hpColor, MOVE_KIND, moveEffect, showBattleEvent, STAT_LABEL, STATUS_LABEL, TAG_LABEL, type BattleCue, type Encounter, type MoveFilter } from "@/lib/domine/pet-battle-view";
import { battleAssets, battleMoveFx, fxSheets } from "@/lib/domine/pet-battle-fx";
import type { FxSheet } from "@/lib/domine/pet-fx-sheets";
import { PETS, type PetId } from "@/lib/domine/pet-photos";
import type { PetStage } from "@/lib/domine/pet";
import { cellBackground } from "@/lib/domine/pet-cells";
import { shortBreedName } from "@/lib/domine/breed-short";
import { battleFinish, createKingBattle, kingProgress, kingRewardLine, KING_LOCAL_NOTICE, type KingApi } from "@/lib/domine/pet-king-client";
import type { PetIdentity } from "@/lib/domine/pet-identity";
import type { KingProgress, KingSettlement } from "@/lib/domine/pet-king-rpc";

const TRAIT_LABEL: Record<Trait, string> = {
  restDamage: "쉰 뒤 첫 공격 강화", earlySpeed: "초반 민첩 증가", firstTrack: "첫 추적 공격 강화",
  firstShield: "첫 피해 감소", thirdEnergy: "3라운드에 기력 회복", longBuff: "첫 강화가 더 오래 지속",
  firstBond: "첫 교감 공격 강화", firstRush: "첫 돌진 공격 강화", trackDamage: "추적 공격 강화", statusImmune: "첫 상태 이상 방어",
};
const imageCache = new Map<string, HTMLImageElement>();
function warmImage(path: string) {
  if (typeof window === "undefined" || typeof window.Image !== "function") return;
  if (!imageCache.has(path)) {
    const image = new window.Image();
    image.onerror = () => { if (imageCache.get(path) === image) imageCache.delete(path); };
    if (imageCache.size >= 96) imageCache.delete(imageCache.keys().next().value!);
    imageCache.set(path, image); image.src = path;
  }
  return imageCache.get(path);
}
export function FxSprite({ sheet, reduced, delay = 0, duration = sheet.duration, tint = "none" }: { sheet: FxSheet; reduced: boolean; delay?: number; duration?: number; tint?: string }) {
  const [ready] = useState(() => { const image = warmImage(sheet.path); return !!image?.complete && image.naturalWidth > 0; });
  // Late images are cached for the next use; the current cue keeps its original effect.
  if (!ready) return null;
  return <span className="pet-fx-sprite" aria-hidden="true" style={{ backgroundImage: `url(${sheet.path})`, backgroundSize: `${sheet.frames * 100}% 100%`, mixBlendMode: sheet.blend, filter: tint,
    "--sprite-end": `${-sheet.size * (sheet.frames - 1)}px`, "--sprite-steps": sheet.frames - 1, "--sprite-time": `${reduced ? 300 : duration}ms`, "--sprite-delay": `${reduced ? 0 : delay}ms` } as CSSProperties} />;
}

function BreedPicture({ breedId, name, art }: { breedId: string; name: string; art?: string }) {
  const [failed, setFailed] = useState(false);
  const own = breedId === "B001" ? 1 : breedId === "B002" ? 2 : null;
  if (failed) return !art && own ? <Image src={PETS[own].standing.adult} alt={name} width={240} height={240} sizes="34vw" style={{ transform: "scaleX(-1)" }} /> : <span className="pet-battle-emoji" role="img" aria-label={name}>🐾</span>;
  return <Image src={art ?? `/pet/breed/${breedId}.webp`} alt={name} width={240} height={240} sizes="34vw" unoptimized loading="eager" onError={() => setFailed(true)} />;
}

type Playback = { next: BattleState; cues: BattleCue[]; index: number; shown: BattleState; revealed: number; line: string };
function playbackFor(state: BattleState, next: BattleState, cues: BattleCue[]): Playback {
  return { next, cues, index: 0, shown: state, revealed: 0, line: cues[0].text ?? "" };
}

export default function PetBattleSheet({ encounter, petId, condition, stage, hour, onClose, onWin, kingApi, identity, firstWin, onSettled, baseSpeed = 1.7, items = [], onInventoryRefresh, supportMove, growth }: {
  supportMove?: string; growth?: KingProgress;
  items?: readonly string[]; onInventoryRefresh?: () => Promise<void>;
  encounter: Encounter; petId: PetId; condition?: Condition; stage: PetStage; hour: number; onClose: () => void; onWin?: () => void;
  kingApi?: KingApi; identity?: PetIdentity | null; firstWin?: boolean; onSettled?: (result: KingSettlement) => void; baseSpeed?: number;
}) {
  const attempt = useRef(0);
  const names = { player: PETS[petId].name, opponent: encounter.name };
  const lastRival = useRef("");
  const lastPlayer = useRef(""), lastDefenseResult = useRef("");
  const start = (roundSeed: number, playerLevel = encounter.playerLevel, carried = items, snapshot = growth) => createBattle({
    seed: seedFor(`${encounter.cellId}:${petId}:${roundSeed}`, encounter.daySeed),
    player: battlePlayer(petId, snapshot?.level ?? playerLevel, condition, carried, supportMove, snapshot),
    opponent: encounter.fighter, difficulty: encounter.difficulty,
  });
  const introduction = (state: BattleState) => playbackFor(state, state, [
    { motion: "intro", duration: attempt.current ? 450 : 1000 },
    { rivalText: encounterLine(encounter, "enter", encounter.individual.seed), duration: 750 },
  ]);
  const [battle, setBattle] = useState(() => start(0));
  const [itemReady, setItemReady] = useState(false);
  const [serverLine, setServerLine] = useState("");
  const [settlement, setSettlement] = useState<KingSettlement | null>(null);
  const [settlementState, setSettlementState] = useState<"idle" | "pending" | "failed" | "confirmed">("idle");
  const [rewardStep, setRewardStep] = useState(0);
  const session = useRef<ReturnType<typeof createKingBattle> | null>(null);
  const accounting = useRef({ rounds: 0, moves: {} as Record<string, number> });
  const finalizing = useRef(false);
  const latestBattle = useRef(battle);
  function beginServer(state: BattleState) {
    const next = createKingBattle(kingApi, identity, petId, encounter, state.player.items ?? []);
    session.current = next; setItemReady(false);
    void next.start().then(reply => {
      if (session.current !== next) return;
      if (!finalizing.current && accounting.current.rounds === 0 && reply?.supported && reply.ok && reply.data?.snapshot) {
        const ready = { ...state, player: start(attempt.current, reply.data.snapshot.level, state.player.items ?? [], reply.data.snapshot).player };
        latestBattle.current = ready; setBattle(ready);
        setPlayback(previous => previous ? { ...previous, shown: ready, next: ready } : null);
      }
      setItemReady(true);
      void onInventoryRefresh?.();
      if (!finalizing.current && (!reply?.supported || !reply.ok)) setServerLine(KING_LOCAL_NOTICE);
    }).catch(() => { if (session.current === next) { setItemReady(true); setServerLine(KING_LOCAL_NOTICE); } });
  }
  useEffect(() => {
    if (!session.current) beginServer(battle);
    // One ticket per mounted attempt, including React's effect replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function finishServer(state: BattleState) {
    if (finalizing.current || !session.current) return;
    finalizing.current = true;
    const current = session.current;
    setServerLine("보상 확인 중…");
    setSettlementState("pending");
    void current.finish(battleFinish(state, accounting.current.rounds, accounting.current.moves)).then(result => {
      if (result.settlement) onSettled?.(result.settlement);
      void onInventoryRefresh?.();
      if (session.current !== current) return;
      setSettlement(result.settlement ?? null);
      setSettlementState(result.settlement ? "confirmed" : "failed");
      if (!result.settlement) finalizing.current = false;
      setServerLine(result.settlement ? kingRewardLine(result.settlement, firstWin) : result.notice);
    }).catch(() => { if (session.current === current) { finalizing.current = false; setSettlementState("failed"); setServerLine("보상을 확인하지 못했어요"); } });
  }
  function leave() { finishServer(latestBattle.current); onClose(); }
  const [playback, setPlayback] = useState<Playback | null>(() => introduction(battle));
  const [menu, setMenu] = useState<"main" | "moves" | "bag">("main");
  const [preview, setPreview] = useState("");
  const [reducedPref, setReduced] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [hitStopped, setHitStopped] = useState(false);
  // The chosen speed (x1 / x3 / skip) is remembered on this device; the base pace itself is already 1.7x faster than before.
  const [speedMode, setSpeedModeState] = useState<0 | 1 | 2>(() => { try { const saved = Number(window.localStorage.getItem("domine-pet-battle-speed")); return saved === 1 || saved === 2 ? saved : 0; } catch { return 0; } });
  const setSpeedMode = (mode: 0 | 1 | 2) => { setSpeedModeState(mode); try { window.localStorage.setItem("domine-pet-battle-speed", String(mode)); } catch { /* Session only. */ } };
  const reduced = reducedPref || speedMode === 2;
  const factor = baseSpeed * [1, 3, 14][speedMode];
  const fast = (ms: number) => ms > 0 ? Math.max(16, Math.round(ms / factor)) : 0;
  const [filter, setFilter] = useState<MoveFilter>("all"), [page, setPage] = useState(0);
  const [previewCost, setPreviewCost] = useState(0);
  const [detailSide, setDetailSide] = useState<Side | null>(null);
  const [seen, setSeen] = useState<Record<Side, string[]>>({ player: [], opponent: [] });
  const pagesRef = useRef<HTMLDivElement>(null), detailsRef = useRef<HTMLDialogElement>(null);
  const focusPage = useRef(false);
  const cardPositions = useRef(new Map<string, { left: number; top: number }>());
  useLayoutEffect(() => {
    if (menu !== "moves") return;
    const cards = pagesRef.current?.querySelectorAll<HTMLElement>("[data-action-key]");
    cards?.forEach(card => {
      const key = card.dataset.actionKey!, rect = card.getBoundingClientRect(), previous = cardPositions.current.get(key);
      if (previous && !reducedPref) card.animate?.([{ transform: `translate(${previous.left - rect.left}px, ${previous.top - rect.top}px)` }, { transform: "translate(0, 0)" }], { duration: 150, easing: "ease-out" });
      cardPositions.current.set(key, { left: rect.left, top: rect.top });
    });
  }, [battle, filter, menu, reducedPref]);
  const paused = detailSide !== null || !!preview;
  const detailHeading = useId();
  const dialog = useRef<HTMLDialogElement>(null), message = useRef<HTMLButtonElement>(null);
  const arena = useRef<HTMLDivElement>(null);
  const command = useRef<HTMLButtonElement>(null);
  const heading = useId(), previewId = useId();
  const playing = useRef(true), held = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef(leave);
  const backRef = useRef<() => boolean>(() => false);
  useLayoutEffect(() => {
    closeRef.current = leave;
    backRef.current = () => {
      if (paused) { closeDetail(); return true; }
      if (menu !== "main" && !playback) { setMenu("main"); setPreview(""); return true; }
      return false;
    };
  }, [leave, paused, menu, playback]);
  const cancelHold = () => { if (holdTimer.current !== null) clearTimeout(holdTimer.current); holdTimer.current = null; };
  useEffect(() => cancelHold, []);
  useEffect(() => {
    const modal = dialog.current, opener = document.activeElement as HTMLElement | null;
    const release = ownPetSheet(() => backRef.current(), () => closeRef.current());
    modal?.showModal();
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReduced(preference.matches);
    updateMotion(); preference.addEventListener("change", updateMotion);
    const visibility = () => { setHidden(!!document.hidden); if (document.hidden) navigator.vibrate?.(0); };
    visibility(); window.addEventListener("visibilitychange", visibility);
    return () => {
      release(); window.removeEventListener("visibilitychange", visibility);
      preference.removeEventListener("change", updateMotion);
      navigator.vibrate?.(0);
      modal?.close(); opener?.focus({ preventScroll: true });
    };
  }, [heading]);

  useEffect(() => {
    for (const path of battleAssets([...battle.player.moves, ...battle.opponent.moves, ...[battle.player.finisher, battle.opponent.finisher].filter((id): id is string => !!id)])) warmImage(path);
  }, [battle.player.moves, battle.opponent.moves, battle.player.finisher, battle.opponent.finisher]);
  useEffect(() => {
    if (!paused) return;
    const opener = document.activeElement as HTMLElement | null;
    const details = detailsRef.current;
    details?.showModal();
    return () => { details?.close(); opener?.focus({ preventScroll: true }); };
  }, [paused]);
  const cue = playback?.cues[playback.index];
  const cueMs = cue?.finisher ? finisherDuration(cue.finisher, speedMode, reducedPref) : fast(cue?.duration ?? 450);
  useLayoutEffect(() => {
    if (cue?.finisher !== "impact" || reducedPref || cue.missed || cue.blocked) { setHitStopped(false); return; }
    setHitStopped(true);
    const timer = setTimeout(() => setHitStopped(false), Math.min(80, cueMs / 4));
    return () => clearTimeout(timer);
  }, [cue, cueMs, reducedPref]);
  const round = playback?.shown.round ?? battle.round;
  useEffect(() => {
    if (cue?.seenMove && cue.side) {
      const side = cue.side, id = cue.seenMove;
      setSeen(previous => previous[side].includes(id) ? previous : { ...previous, [side]: [...previous[side], id] });
      for (const sheet of battleMoveFx(id, round - 1).sheets ?? []) warmImage(sheet.path);
    }
  }, [cue, round]);
  const moveFx = cue?.moveFx ? battleMoveFx(cue.moveFx, round - 1) : undefined;
  const text = cue?.finisher ? "" : cue?.text ?? "";
  const characters = Array.from(text);
  const typing = !cue?.finisher && !!cue?.text && playback!.revealed < characters.length;
  const intro = cue?.motion === "intro";
  const shown = playback?.shown ?? battle;
  const [displayHp, setDisplayHp] = useState({ player: shown.player.hp, opponent: shown.opponent.hp, playerEnergy: shown.player.energy, opponentEnergy: shown.opponent.energy });
  const hpRef = useRef(displayHp);
  useEffect(() => {
    if (hidden || paused) return;
    const from = hpRef.current, to = { player: shown.player.hp, opponent: shown.opponent.hp, playerEnergy: shown.player.energy, opponentEnergy: shown.opponent.energy };
    let frame = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const progress = reduced ? 1 : 1 - (1 - ++frame / 10) ** 3;
      hpRef.current = { player: Math.round(from.player + (to.player - from.player) * progress), opponent: Math.round(from.opponent + (to.opponent - from.opponent) * progress), playerEnergy: Math.round(from.playerEnergy + (to.playerEnergy - from.playerEnergy) * progress), opponentEnergy: Math.round(from.opponentEnergy + (to.opponentEnergy - from.opponentEnergy) * progress) };
      setDisplayHp(hpRef.current);
      if (progress < 1) timer = setTimeout(tick, cue?.finisher === "impact" ? cueMs / 10 : fast(30));
    };
    if (Object.keys(to).some(key => from[key as keyof typeof to] !== to[key as keyof typeof to])) tick();
    return () => clearTimeout(timer);
  }, [shown.player.hp, shown.opponent.hp, shown.player.energy, shown.opponent.energy, reduced, hidden, paused]);
  const outcome = cue?.outcome ?? (!playback ? battle.outcome : undefined);
  const finished = !playback && !!battle.outcome;
  const rewardProgress = settlement?.progress ? kingProgress(rewardStep === 0 ? Math.max(0, settlement.progress.xp - settlement.xp) : settlement.progress.xp,
    rewardStep === 2 ? settlement.levelAfter : settlement.levelBefore) : null;
  const phase = intro ? "intro" : finished ? "result" : playback ? "playback" : "command";
  useEffect(() => {
    if (!finished || !settlement || hidden || paused) return;
    setRewardStep(1);
    const timer = setTimeout(() => setRewardStep(2), reducedPref ? 0 : 650);
    return () => clearTimeout(timer);
  }, [finished, settlement, hidden, paused, reducedPref]);

  useLayoutEffect(() => {
    if (!cue?.moveFx || !arena.current) return;
    const field = arena.current, bounds = field.getBoundingClientRect();
    const player = field.querySelector('.pet-battle-fighter[data-side="player"]')!.getBoundingClientRect();
    const opponent = field.querySelector('.pet-battle-fighter[data-side="opponent"]')!.getBoundingClientRect();
    const x = player.left + player.width / 2, y = player.top + player.height / 2;
    const dx = opponent.left + opponent.width / 2 - x, dy = opponent.top + opponent.height / 2 - y;
    for (const [name, value] of Object.entries({ "reach-x": dx, "reach-y": dy, "trail-left": x - bounds.left, "trail-top": y + dy - bounds.top, "trail-width": dx, "trail-height": -dy })) {
      field.style.setProperty(`--${name}`, `${value}px`);
    }
  }, [cue]);

  function advance() {
    if (!playback || paused || hidden) return;
    const index = playback.index + 1, nextCue = playback.cues[index];
    if (!nextCue) { setBattle(playback.next); setPlayback(null); playing.current = false; return; }
    setPlayback({ ...playback, index, revealed: 0, line: nextCue.text ?? playback.line,
      shown: nextCue.event ? showBattleEvent(playback.shown, nextCue.event, playback.next) : playback.shown });
  }
  useEffect(() => {
    if (!playback || paused || hidden) return;
    const base = typing ? 18 : cue?.text ? 900 : cue?.moveName || cue?.result || cue?.rivalText || cue?.playerText ? cue.duration ?? 1200 : reduced && cue?.motion && !cue.moveFx ? cue.fx || cue.critical ? 300 : 0 : cue?.duration ?? 0;
    const delay = cue?.finisher ? cueMs : fast(base);
    const timer = setTimeout(() => {
      if (typing) setPlayback({ ...playback, revealed: playback.revealed + 1 });
      else advance();
    }, delay);
    return () => clearTimeout(timer);
    // Playback owns the immutable cue and text for this timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback, reduced, paused, hidden, speedMode]);
  useEffect(() => {
    if (reducedPref || hidden || paused) { navigator.vibrate?.(0); return; }
    if (cue?.finisher === "charge") navigator.vibrate?.([15, 35, 15]);
    else if (cue?.finisher === "impact" && !cue.missed && !cue.blocked) navigator.vibrate?.(80);
    else if (cue?.fx === "hit-good") navigator.vibrate?.(25);
  }, [cue, reducedPref, hidden, paused]);
  useEffect(() => {
    if (phase === "playback" || phase === "intro") message.current?.focus({ preventScroll: true });
    else command.current?.focus({ preventScroll: true });
  }, [phase, menu]);
  useLayoutEffect(() => {
    if (focusPage.current) pagesRef.current?.querySelector<HTMLButtonElement>('.pet-battle-page:not([inert]) button:not(:disabled)')?.focus({ preventScroll: true });
    focusPage.current = false;
  }, [page]);

  function choose(action: Action) {
    if (paused || playing.current || !!kingApi && !itemReady || !availableActions(battle, "player").some(a => sameAction(a, action))) return;
    const next = stepRound(battle, action);
    if (action.kind !== "quit") accounting.current.rounds++;
    for (const event of next.events) {
      if (event.type === "action" && event.side === "player") {
        const move = moveFor(event.action);
        if (move) accounting.current.moves[move.id] = (accounting.current.moves[move.id] ?? 0) + 1;
      }
    }
    latestBattle.current = next.state;
    if (next.state.outcome) finishServer(next.state);
    if (next.state.outcome === "player") onWin?.();
    playing.current = true; cancelHold(); setPreview(""); setPreviewCost(0); setMenu("main");
    const cues = battleCues(next.events, names, { state: battle, lastResult: lastDefenseResult.current });
    lastDefenseResult.current = cues.findLast(cue => cue.defenseResult)?.result ?? lastDefenseResult.current;
    const spoken = rivalCues(cues, encounter, next.state, lastRival.current, { id: petId, last: lastPlayer.current });
    lastRival.current = spoken.last;
    lastPlayer.current = spoken.lastPlayer ?? lastPlayer.current;
    setPlayback(playbackFor(battle, next.state, spoken.cues));
  }
  function bag() { if (!playing.current) setMenu("bag"); }
  function restart() {
    lastPlayer.current = ""; lastDefenseResult.current = "";
    const next = start(++attempt.current, settlement?.levelAfter ?? encounter.playerLevel, selectedItems(items,settlement?.progress?.inventory ?? {}), settlement?.progress ?? growth); setSeen({ player: [], opponent: [] }); setFilter("all"); setPage(0);
    accounting.current = { rounds: 0, moves: {} }; finalizing.current = false;
    latestBattle.current = next; setSettlement(null); setSettlementState("idle"); setRewardStep(0); setServerLine(""); beginServer(next);
    playing.current = true; cancelHold(); setPreview(""); setPreviewCost(0); setMenu("main"); setBattle(next); setPlayback(introduction(next));
  }
  const actions: Action[] = [...new Set([...battle.player.moves, ...(battle.player.finisher ? [battle.player.finisher] : [])])].map(moveId => ({ kind: "move", moveId }));
  actions.push({ kind: "push" }, { kind: "rest" });
  const pages = movePages(actions, filter, battle);
  function goPage(index: number, keyboard = false) {
    const next = Math.max(0, Math.min(pages.length - 1, index));
    focusPage.current = keyboard;
    setPage(next); cancelHold(); setPreviewCost(0);
    pagesRef.current?.scrollTo({ left: pagesRef.current.clientWidth * next, behavior: reduced ? "instant" : "smooth" });
  }
  function closeDetail() { setDetailSide(null); setPreview(""); setPreviewCost(0); held.current = false; cancelHold(); }
  const allowed = availableActions(battle, "player");
  const result = outcome === "player" ? "승리!" : outcome === "opponent" ? "아쉬운 패배" : outcome === "quit" ? "그만뒀어요" : "무승부";

  function hud(side: Side) {
    const actor = shown[side];
    return <section className="pet-battle-hud" data-side={side} aria-label={`${names[side]} 상태`}>
      <h3><i className="pet-battle-aura" data-group={actor.element ?? BREED_BY_ID[actor.breedId].group} title={GROUP_LABEL[actor.element ?? BREED_BY_ID[actor.breedId].group]} /><span title={names[side]} onPointerDown={() => { cancelHold(); holdTimer.current = setTimeout(() => setDetailSide(side), 500); }} onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerLeave={cancelHold}>{side === "opponent" ? `${shortBreedName(encounter.individual.breedId, KING_BREEDS[encounter.individual.breedId].name)} ${encounter.individual.name}` : names[side]}</span><small>Lv.{actor.level}</small><button type="button" className="pet-battle-info" aria-label={`${names[side]} 상세 보기`} onClick={e => { e.stopPropagation(); setDetailSide(side); }}>ⓘ</button></h3>
      <div className="pet-battle-health-row"><span aria-hidden="true">♥</span>
      <div className="pet-battle-hp" data-color={hpColor(actor.hp, actor.stats.hp)} role="progressbar" aria-label={`${names[side]} 체력`} aria-valuemin={0} aria-valuemax={actor.stats.hp} aria-valuenow={actor.hp}>
        <span className="pet-battle-hp-trail" style={{ transform: `scaleX(${actor.hp / actor.stats.hp})` }} />
        <span className="pet-battle-hp-fill" style={{ transform: `scaleX(${actor.hp / actor.stats.hp})` }} />
      </div><span data-hp-number={side}>{displayHp[side]}/{actor.stats.hp}</span></div>
      <div className="pet-battle-energy" aria-label={`기력 ${actor.energy}/${MAX_ENERGY}`}>
        <span aria-hidden="true">⚡ {displayHp[side === "player" ? "playerEnergy" : "opponentEnergy"]}/{MAX_ENERGY}</span>
        <span className="pet-battle-energy-bar" style={{ gridTemplateColumns: `repeat(${MAX_ENERGY}, minmax(0, 1fr))` }} aria-hidden="true">
          {Array.from({ length: MAX_ENERGY }, (_, i) => <i key={i} data-filled={i < actor.energy} data-spend={side === "player" && i < actor.energy && i >= Math.max(0, actor.energy - previewCost)} />)}
        </span>
      </div>
      <div className="pet-battle-momentum" role="progressbar" aria-label={`${names[side]} 기세`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={actor.momentum ?? 0} data-full={(actor.momentum ?? 0) >= 100}><span style={{ transform: `scaleX(${(actor.momentum ?? 0) / 100})` }} /></div>
      <div className="pet-battle-statuses">{actor.statuses.map(s => <span key={s.id} title={STATUS_LABEL[s.id]}>{STATUS_LABEL[s.id].split(" ")[0]} {Math.max(1,s.expires - round + 1)}</span>)}
        {actor.buffs.map((b,i) => <span key={`${b.stat}-${i}`} title={`${STAT_LABEL[b.stat]} ${Math.round((b.rate ?? .15)*100)}%`}>{STAT_LABEL[b.stat]}{(b.rate ?? .15) < 0 ? "↓" : "↑"}{Math.max(1,b.expires - round + 1)}</span>)}
        {actor.prepared && <span>준비↑{Math.max(1,actor.prepared.expires - round + 1)}</span>}
      </div>
    </section>;
  }
  function fighter(side: Side) {
    const motion = outcome && outcome !== "draw" && outcome !== "quit" ? outcome === side ? "win" : "tired" : cue?.side === side ? cue.motion : undefined;
    const animation = moveFx && (cue?.side === side ? `pet-move-${moveFx.motion}` : cue?.target === side ? `pet-react-${cue.missed ? "dodge" : moveFx.reaction}` : undefined);
    return <div className="pet-battle-fighter" data-side={side} data-struck={cue?.impactSide === side && !!cue.amount} data-finisher={cue?.finisher === "impact" && cue.target === side && !!cue.amount}>
      <div className="pet-battle-platform" />
      <div className="pet-battle-entry"><div key={animation ? `${shown.round}-${playback?.index}` : "idle"} className="pet-battle-portrait" data-motion={motion} style={animation ? { animation: `${animation} ${cueMs}ms ease-in-out both` } : undefined}>
        {side === "player" ? <Image src={PETS[petId].standing[stage]} alt={names.player} width={320} height={320} sizes="42vw" loading="eager" /> : <BreedPicture key={encounter.id} breedId={shown.opponent.breedId} name={names.opponent} art={encounter.art} />}
        <span className="pet-battle-flash" aria-hidden="true" />
        {motion === "win" && <span className="pet-battle-sparkles" aria-hidden="true">✦ · ✧<br />✧　✦</span>}
      </div></div>
      {(cue?.impactSide ?? cue?.side) === side && cue?.fx && <span key={`${shown.round}-${playback?.index}-fx`} className="pet-battle-fx" data-weak={cue.motion === "weak-hit"} aria-hidden="true">
        <span className="pet-battle-flash" />
        <Image src={`/pet/battle/fx-${cue.fx === "energy" ? "buff" : cue.fx === "cleanse" ? "heal" : cue.fx}.webp`} alt="" width={160} height={160} unoptimized loading="eager" onError={e => { e.currentTarget.style.visibility = "hidden"; }} />
      </span>}
      {moveFx && (cue?.target ?? cue?.side) === side && <span key={`${shown.round}-${playback?.index}-art`} className="pet-battle-art" data-side={cue?.side} data-missed={cue?.missed} style={{ "--art-duration": `${cueMs}ms` } as CSSProperties} aria-hidden="true">
        {!cue?.missed && moveFx.image && <Image src={moveFx.image} alt="" width={160} height={160} unoptimized onError={e => { e.currentTarget.style.visibility = "hidden"; }} />}
        {(cue?.missed ? [fxSheets("smoke", shown.round)] : moveFx.sheets ?? []).map((sheet, i) => <FxSprite key={`${sheet.id}-${i}`} sheet={sheet} reduced={reduced} delay={0} tint={moveFx.tint} duration={cueMs} />)}
      </span>}
      {(cue?.impactSide ?? cue?.side) === side && (cue?.fx || cue?.critical) && <span key={`${shown.round}-${playback?.index}-sprite`} className="pet-battle-art" data-critical={cue.critical} aria-hidden="true">
        <FxSprite sheet={fxSheets(cue.critical ? "particle" : cue.fx === "heal" || cue.fx === "cleanse" ? "heal" : cue.fx === "energy" ? "charge" : cue.fx === "buff" ? "buff" : cue.fx === "shield" ? "shield" : cue.fx === "hit" || cue.fx === "hit-good" ? "impact" : "debuff", cue.critical ? 3 : cue.fx === "buff" ? 4 : shown.round)} reduced={reduced} duration={cue.duration} />
      </span>}
      {(cue?.impactSide ?? cue?.side) === side && cue?.amount !== undefined && <strong key={`${shown.round}-${playback?.index}`} className="pet-battle-number" data-finisher={!!cue.finisher} data-critical={cue.critical} data-good={cue.fx === "hit-good"} data-weak={cue.motion === "weak-hit"} data-heal={cue.motion === "heal"} data-energy={cue.fx === "energy"} aria-hidden="true">{cue.motion === "heal" || cue.fx === "energy" ? "+" : "−"}{cue.amount}</strong>}
      {cue?.side === side && cue.moveName && <p key={`${shown.round}-${playback?.index}-name`} className="pet-battle-skill-name" role="status">{cue.moveName}</p>}
      {side === "player" && cue?.playerText && <p className="pet-battle-rival" style={{ left: 0, right: "auto" }} role="status">{cue.playerText}</p>}
      {side === "opponent" && (cue?.rivalText || finished) && <p className="pet-battle-rival" role="status">{cue?.rivalText || encounterLine(encounter, outcome === "quit" ? "flee" : outcome === "player" ? "lose" : outcome === "opponent" ? "win" : "round", seedFor(String(shown.round), encounter.individual.seed), lastRival.current)}</p>}
    </div>;
  }

  function fighterDetails(side: Side) {
    const actor = shown[side], breed = side === "opponent" ? KING_BREEDS[encounter.individual.breedId] : BREED_BY_ID[actor.breedId];
    const values = (Object.keys(STAT_LABEL) as Stat[]).map(stat => ({ stat, value: stat === "hp" ? actor.hp : effectiveStat(actor, stat, shown.round) }));
    const peak = Math.max(...values.filter(v => v.stat !== "hp").map(v => v.value), 1);
    const moves = side === "player" ? [...actor.moves, ...(actor.finisher ? [actor.finisher] : []), "push", "rest"] : seen.opponent;
    return <>
      <div className="pet-battle-detail-picture"><BreedPicture breedId={actor.breedId} name={names[side]} art={side === "opponent" ? encounter.art : undefined} /></div>
      <p>{breed.name} · Lv.{actor.level}</p>
      {side === "opponent" && <p>{actor.owned !== false && encounter.npc ? `${encounter.npc.name}${encounter.npc.title ? ` · ${encounter.npc.title}` : ""}` : "길에서 지냄"}</p>}
      <div className="pet-battle-stat-list">{values.map(({ stat, value }) => <div key={stat}><span>{STAT_LABEL[stat]}</span><meter min={0} max={stat === "hp" ? actor.stats.hp : peak} value={value} aria-label={STAT_LABEL[stat]} /><strong>{value}{stat === "hp" ? `/${actor.stats.hp}` : ""}</strong></div>)}</div>
      <p>{GROUP_LABEL[actor.element ?? BREED_BY_ID[actor.breedId].group]} · {{ small: "소형", medium: "중형", large: "대형" }[breed.size]} · {{ lively: "활발", careful: "신중", kind: "다정", steady: "차분" }[breed.temperament]}</p>
      {side === "opponent" && <div className="pet-species-badges">{speciesBadges(encounter).map(badge => <span key={badge}>{badge}</span>)}</div>}
      {actor.knownWeakTag && actor.weakTag && <p>확인한 약점 · {TAG_LABEL[actor.weakTag]}</p>}{actor.knownResistTag && actor.resistTag && <p>확인한 내성 · {TAG_LABEL[actor.resistTag]}</p>}
      <p>{TRAIT_LABEL[breed.trait]}</p>
      {actor.condition && <p>포만 {actor.condition.fullness} · 기분 {actor.condition.mood} · 청결 {actor.condition.clean}</p>}
      {actor.statuses.filter(s => s.expires >= shown.round).map(s => <p key={s.id}>{STATUS_LABEL[s.id]} · {s.expires - shown.round + 1}라운드</p>)}
      {actor.buffs.filter(b => b.expires >= shown.round).map(b => <p key={b.stat}>{STAT_LABEL[b.stat]}↑ · {b.expires - shown.round + 1}라운드</p>)}
      {actor.shield && actor.shield.expires >= shown.round && <p>보호막 · {actor.shield.expires - shown.round + 1}라운드</p>}
      {actor.defense && actor.defense.expires >= shown.round && <p>{{ guard: "방어", counter: "반격", evade: "흘리기", stance: "방어 자세" }[actor.defense.kind]} · {actor.defense.expires - shown.round + 1}라운드</p>}
      {actor.recoil?.stat && actor.recoil.expires >= shown.round && <p>{STAT_LABEL[actor.recoil.stat]}↓ · {actor.recoil.expires - shown.round + 1}라운드</p>}
      {side === "player" && <p>크리티컬 {Math.round(critChance(actor))}%</p>}
      <h4>{side === "player" ? "장착 기술" : "사용한 기술"}</h4>
      <ul className="pet-battle-known-moves">{moves.map(id => <li key={id}>{actionLabel(id === "push" || id === "rest" ? { kind: id } : { kind: "move", moveId: id })}</li>)}
        {side === "opponent" && [...actor.moves, ...(actor.finisher ? [actor.finisher] : [])].filter(id => !seen.opponent.includes(id)).map((_, i) => <li key={`unknown-${i}`} aria-label="아직 보지 못한 기술">?</li>)}</ul>
    </>;
  }

  return <dialog ref={dialog} className="pet-battle-screen" style={{ "--arena-bg": `url(${cellBackground(encounter.cellId, hour)})` } as CSSProperties} aria-labelledby={heading} tabIndex={-1} onCancel={e => { e.preventDefault(); if (!backRef.current()) leave(); }}>
    <div className="pet-battle-scene" data-phase={phase} data-paused={paused || hidden} data-hitstop={hitStopped} data-reduced={reducedPref} data-finisher={cue?.finisher} data-incoming={cue?.finisher === "impact" && cue.target === "player" && !!cue.amount} data-connected={!!cue?.amount} style={{ "--finisher-time": `${cueMs}ms`, "--hit-stop": `${reducedPref ? 0 : Math.min(80, cueMs / 4)}ms`, "--impact-hp-time": `${cue?.finisher === "impact" ? cueMs : fast(300)}ms` } as CSSProperties} data-impact={cue?.motion === "effective" || !!cue?.critical} data-heavy={cue?.moveFx === "T63" && !cue.missed} key={attempt.current} onClick={intro && !paused ? advance : undefined}>
      <div ref={arena} className="pet-battle-arena">
        <header className="pet-battle-topline"><h2 id={heading} className="pet-battle-sr">동네 겨루기</h2>{!finished && <button type="button" className="pet-battle-speed" aria-label={["배속 보통", "3배속", "빠르게 넘기기"][speedMode]} aria-pressed={speedMode > 0} onClick={() => setSpeedMode(((speedMode + 1) % 3) as 0 | 1 | 2)}>{["▶", "▶▶", "⏭"][speedMode]}</button>}{!finished && <span key={shown.round} className="pet-battle-round" data-urgency={shown.round >= MAX_ROUNDS ? "last" : shown.round >= MAX_ROUNDS - 1 ? "near" : shown.round >= MAX_ROUNDS - 2 ? "late" : undefined}>라운드 {shown.round}/{MAX_ROUNDS}</span>}</header>
        {!finished && hud("opponent")}{fighter("opponent")}{fighter("player")}{!finished && hud("player")}
        {moveFx && <div key={`${shown.round}-${playback?.index}-move`} className="pet-battle-move-fx" data-side={cue?.side} data-trail={moveFx.trail} data-local={moveFx.reaction === "none"} data-missed={cue?.missed} style={{ "--fx-duration": `${cueMs}ms` } as CSSProperties} aria-hidden="true">
          {moveFx.elements.map((element, i) => <span key={i} className="pet-battle-fx-part" style={{ "--part": i, animationName: `pet-trail-${moveFx.trail}` } as CSSProperties}>
            <span className="pet-battle-fx-glyph" data-shape={element}>
              {element.startsWith("fx-") ? <Image src={`/pet/battle/${element}.webp`} alt="" width={80} height={80} unoptimized loading="eager" onError={e => { e.currentTarget.style.visibility = "hidden"; }} /> : ["ring", "wave", "streak"].includes(element) ? null : element}
            </span>
          </span>)}
        </div>}
        {cue?.result && <p key={`${shown.round}-${playback?.index}-result`} className="pet-battle-center-result" role="status">{cue.result}</p>}
        {cue?.finisher && <div key={`${shown.round}-${playback?.index}-finisher`} className="pet-battle-finisher" data-stage={cue.finisher} data-side={cue.side} data-group={MOVE_BY_ID[cue.finisherId!]?.group} data-blocked={cue.blocked || cue.missed} data-guarded={cue.guarded} aria-hidden="true">
          {cue.finisher === "cutin" && <div className="pet-battle-finisher-cutin"><Image src={cue.side === "opponent" ? encounter.art : PETS[petId].standing[stage]} alt="" width={200} height={200} unoptimized /><strong>{MOVE_BY_ID[cue.finisherId!]?.name}</strong></div>}
          {cue.finisher === "charge" && <div className="pet-battle-finisher-charge"><i /><i /><i /><span>✦</span></div>}
          {cue.finisher === "impact" && <><div className="pet-battle-finisher-flash" /><div className="pet-battle-finisher-burst"><i /><i /><i /></div></>}
        </div>}
        {cue?.finisher === "afterglow" && cue.text && <p className="pet-battle-finisher-note" role="status">{cue.text}</p>}
        {finished && <div className="pet-battle-banner" data-victory={outcome === "player"} role="status"><h3>{result}</h3></div>}
        {finished && rewardStep === 2 && settlement && settlement.levelAfter > settlement.levelBefore && <div className="pet-feedback" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} className="pet-level-particle" style={{ left: `${8 + i * 7}%`, animationDelay: `${i * 35}ms` }}>✦</i>)}</div>}
      </div>
      <div className="pet-battle-console">
        {finished ? <div className="pet-battle-result"><p>{outcome === "player" ? "정말 멋진 움직임이었어요!" : outcome === "opponent" ? "끝까지 함께해 줘서 고마워요." : "다음에도 즐겁게 겨뤄요!"}</p>{serverLine && <p className="pet-battle-reward" role="status">{settlementState === "confirmed" && settlement ? kingRewardLine({ ...settlement, levelAfter: !rewardProgress && rewardStep === 2 ? settlement.levelAfter : settlement.levelBefore }, firstWin) : serverLine}</p>}
          {settlement && rewardProgress && <div className="pet-battle-reward-xp" data-step={rewardStep}>
            <span role="progressbar" aria-label="확정 경험치" aria-valuemin={0} aria-valuemax={rewardProgress.needed || 1} aria-valuenow={rewardProgress.needed ? rewardProgress.current : 1}>
              <i style={{ transform: `scaleX(${rewardProgress.needed ? rewardProgress.current / rewardProgress.needed : 1})` }} />
            </span><small>Lv.{rewardProgress.level}{rewardStep === 2 && settlement.levelAfter > settlement.levelBefore ? "!" : ""}</small>
          </div>}
          {settlementState === "failed" && kingApi && <button type="button" onClick={() => finishServer(latestBattle.current)}>다시 확인</button>}<div className="pet-battle-result-actions">{outcome === "opponent" && <button ref={command} type="button" disabled={!!kingApi && settlementState !== "confirmed"} onClick={restart}>다시</button>}<button ref={outcome !== "opponent" ? command : undefined} type="button" onClick={leave}>돌아가기</button></div></div>
          : <>
            {playback && <div className={text ? "pet-battle-dialogue" : "pet-battle-sr"}>
            {playback && <button ref={message} type="button" className={intro ? "pet-battle-sr" : "pet-battle-message"} aria-label={intro ? "등장 연출 건너뛰기" : typing ? "대사 모두 보기" : playback ? "다음 대사" : "대결 안내"} onClick={e => { e.stopPropagation(); if (intro) advance(); else if (typing) setPlayback({ ...playback!, revealed: characters.length }); else if (cue?.text && !cue.finisher) advance(); }}>
              <span aria-hidden="true">{intro ? "" : typing ? characters.slice(0, playback!.revealed).join("") : text}</span>
              <span className="pet-battle-sr" role="status" aria-live="polite">{intro ? "등장 연출, 눌러서 건너뛰기" : text}</span>
            </button>}
            </div>}
            {!playback ? <div className="pet-battle-command">
              <div className="pet-battle-actions" data-menu={menu} aria-label={menu === "main" ? "대결 명령" : "기술 선택"}>
                {menu === "main" ? <>
                  <button ref={command} type="button" className="pet-battle-primary" disabled={!!kingApi && !itemReady} onClick={() => { setMenu("moves"); setPreview(""); setPage(0); }}><span aria-hidden="true">✦</span> 기술</button>
                  <button type="button" onClick={bag}><span aria-hidden="true">▣</span> 가방</button>
                  <button type="button" disabled={!!kingApi && !itemReady} onClick={() => choose({ kind: "quit" })}><span aria-hidden="true">↗</span> 그만하기</button>
                </> : menu === "bag" ? <>
                  <div className="pet-battle-filters"><strong>반입 물품</strong><button ref={command} type="button" className="pet-battle-back" onClick={() => setMenu("main")}>뒤로</button></div>
                  <div className="pet-battle-item-grid">{(battle.player.items ?? []).map(id => {
                    const item = ITEM_BY_ID[id], reason = !itemReady ? "반입 확인 중…" : itemUnavailable(battle,"player",id);
                    const detail = moveDetail({ kind: "item", itemId: id },battle);
                    return <div className="pet-battle-card" data-kind="support" data-insufficient={!!reason} key={id}>
                      <button type="button" className="pet-battle-move" data-group="neutral" disabled={!!reason} aria-label={`${item.name} 사용${reason ? `, ${reason}` : ""}`} onClick={() => choose({ kind: "item", itemId: id })}>
                        <span className="pet-battle-move-copy"><strong>{item.name}</strong><small title={reason || itemEffect(item)}>{reason || itemEffect(item)}</small></span>
                      </button><button type="button" className="pet-battle-card-info" aria-label={`${item.name} 상세 보기`} onClick={() => setPreview(detail)}>ⓘ</button>
                    </div>;
                  })}</div>
                  {!(battle.player.items?.length) && <p className="pet-battle-empty">반입한 물품이 없어요. 다음 대결 전에 상점에서 준비해요.</p>}
                </> : <>
                  <div className="pet-battle-filters" role="group" aria-label="기술 분류">
                    {(["all", "attack", "defense", "support"] as const).map(value => <button ref={value === "all" ? command : undefined} type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0); setPreviewCost(0); cancelHold(); pagesRef.current?.scrollTo({ left: 0, behavior: "instant" }); }}>{value === "all" ? "전체" : `${MOVE_KIND[value].icon} ${MOVE_KIND[value].label}`}</button>)}
                    <button type="button" className="pet-battle-back" onClick={() => { cancelHold(); held.current = false; setMenu("main"); setPreviewCost(0); }}>뒤로</button>
                  </div>
                  <div ref={pagesRef} className="pet-battle-pages" aria-label="기술 페이지" onScroll={e => { const el = e.currentTarget; if (el.clientWidth) setPage(Math.max(0, Math.min(pages.length - 1, Math.round(el.scrollLeft / el.clientWidth)))); cancelHold(); }} onKeyDown={e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); goPage(page + (e.key === "ArrowRight" ? 1 : -1), true); } }}>
                    {pages.map((items, index) => <div key={`${filter}-${index}`} className="pet-battle-page" role="group" aria-label={`${index + 1}/${pages.length}쪽`} inert={index !== page}>
                      {items.map(action => {
                        const move = moveFor(action), label = actionLabel(action), kind = MOVE_KIND[move?.kind ?? "support"];
                        const hint = move?.kind === "attack" ? effectHint(move, battle.player, battle.opponent) : "normal";
                        const cost = actionCost(action, battle), insufficient = move?.finisher ? (battle.player.momentum ?? 0) < 100 : cost > battle.player.energy;
                        const damage = move?.kind === "attack" ? moveDamage(move, battle) : null;
                        const enabled = allowed.some(a => sameAction(a, action));
                        const detail = moveDetail(action, battle);
                        const showDetail = () => { setPreview(detail); setPreviewCost(cost); };
                        return <div key={label} data-action-key={label} className="pet-battle-card" data-kind={move?.kind ?? "support"} data-finisher-ready={!!move?.finisher && enabled} data-insufficient={!enabled}>
                          <button type="button" className="pet-battle-move" data-group={move?.group ?? "neutral"} data-kind={move?.kind ?? "support"} data-hint={hint} aria-disabled={!enabled}
                            aria-label={`${kind.label}, ${label}, ${move ? moveEffect(move, battle) : `기력 +${REST_ENERGY}`}, 기력 ${cost}${insufficient ? ", 기력 부족" : ""}${move?.kind === "attack" ? `, ${HINT_LABEL[hint]}` : ""}`}
                            onFocus={() => setPreviewCost(cost)} onBlur={() => { cancelHold(); if (!preview) setPreviewCost(0); }} onPointerEnter={() => setPreviewCost(cost)}
                            onPointerDown={e => { if (!e.isPrimary || e.button !== 0) return; cancelHold(); held.current = false; setPreviewCost(cost); holdTimer.current = setTimeout(() => { held.current = true; showDetail(); }, 500); }}
                            onPointerUp={cancelHold} onPointerCancel={() => { cancelHold(); held.current = false; setPreviewCost(0); }} onPointerLeave={() => { cancelHold(); if (!preview) setPreviewCost(0); }}
                            onContextMenu={e => e.preventDefault()} onKeyDown={e => { if (e.key === " " && !e.repeat) { held.current = false; holdTimer.current = setTimeout(() => { held.current = true; showDetail(); }, 500); } }} onKeyUp={cancelHold}
                            onClick={() => { cancelHold(); if (held.current) { held.current = false; return; } if (enabled) choose(action); }}>
                            <span className="pet-battle-kind" aria-hidden="true">{kind.icon}</span>
                            <span className="pet-battle-move-copy"><span className="pet-battle-move-title"><strong title={label}>{label}</strong></span><small>{damage ? <>피해 {damage.base}{damage.delta !== 0 && <span className="pet-battle-delta" data-good={damage.delta > 0}> {damage.delta > 0 ? "↑+" : "↓−"}{Math.abs(damage.delta)}</span>}</> : move ? compactEffect(move, battle) : `기력 +${REST_ENERGY}`}</small></span>
                            <span className="pet-battle-cost" data-finisher={!!move?.finisher}>{move?.finisher ? "기세" : costBadge(cost)}{insufficient && <small>{move?.finisher ? "부족" : "기력 부족"}</small>}</span>
                          </button>
                          <button type="button" className="pet-battle-card-info" aria-label={`${label} 상세 보기`} onClick={e => { e.stopPropagation(); showDetail(); }}>ⓘ</button>
                        </div>;
                      })}
                      {!items.length && <p className="pet-battle-empty">해당 기술 없음</p>}
                    </div>)}
                  </div>
                  <nav className="pet-battle-pagination" aria-label="기술 페이지 이동">
                    <button type="button" aria-label="이전 기술 페이지" disabled={page === 0} onClick={() => goPage(page - 1)}>‹</button>
                    <div>{pages.map((_, index) => <button type="button" key={index} aria-label={`${index + 1}쪽`} aria-current={index === page ? "page" : undefined} onClick={() => goPage(index)}><i /></button>)}</div>
                    <button type="button" aria-label="다음 기술 페이지" disabled={page === pages.length - 1} onClick={() => goPage(page + 1)}>›</button>
                  </nav>
                </>}
              </div>
            </div> : null}
          </>}
      </div>
      {paused && <dialog ref={detailsRef} className="pet-battle-details" aria-labelledby={detailHeading} onCancel={e => { e.preventDefault(); closeDetail(); }} onClick={e => { if (e.target === e.currentTarget) closeDetail(); }}>
        <article onClick={e => e.stopPropagation()}>
          <header><h3 id={detailHeading}>{detailSide ? names[detailSide] : "기술 상세"}</h3><button type="button" aria-label="상세 닫기" autoFocus onClick={closeDetail}>×</button></header>
          {detailSide ? fighterDetails(detailSide) : <p id={previewId}>{preview}</p>}
        </article>
      </dialog>}
      {intro && <div className="pet-battle-stripes" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</div>}
    </div>
  </dialog>;
}
