"use client";

import Image from "next/image";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { availableActions, buildFighter, createBattle, effectHint, stepRound } from "@/lib/domine/battle/engine";
import { BREED_BY_ID } from "@/lib/domine/battle/data";
import { MAX_ENERGY, MAX_ROUNDS, REST_ENERGY, critChance, effectiveStat, moveFor, sameAction } from "@/lib/domine/battle/rules";
import { seedFor } from "@/lib/domine/battle/rng";
import type { Action, BattleState, Condition, Side, Stat, Trait } from "@/lib/domine/battle/types";
import { BREED_BY_ID as KING_BREEDS } from "@/lib/domine/king/species";
import { actionCost, actionLabel, battleCues, compactEffect, costBadge, encounterLine, moveDamage, moveDetail, movePages, rivalCues, speciesBadges, GROUP_LABEL, HINT_LABEL, hpColor, MOVE_KIND, moveEffect, showBattleEvent, STAT_LABEL, STATUS_LABEL, TAG_LABEL, type BattleCue, type Encounter, type MoveFilter } from "@/lib/domine/pet-battle-view";
import { battleAssets, battleMoveFx, fxSheets } from "@/lib/domine/pet-battle-fx";
import type { FxSheet } from "@/lib/domine/pet-fx-sheets";
import { PETS, type PetId } from "@/lib/domine/pet-photos";
import type { PetStage } from "@/lib/domine/pet";
import { cellBackground } from "@/lib/domine/pet-cells";
import { shortBreedName } from "@/lib/domine/breed-short";

const TRAIT_LABEL: Record<Trait, string> = {
  restDamage: "쉰 뒤 첫 공격 강화", earlySpeed: "초반 민첩 증가", firstTrack: "첫 추적 공격 강화",
  firstShield: "첫 피해 감소", thirdEnergy: "3라운드에 기력 회복", longBuff: "첫 강화가 더 오래 지속",
  firstBond: "첫 교감 공격 강화", firstRush: "첫 돌진 공격 강화", trackDamage: "추적 공격 강화", statusImmune: "첫 상태 이상 방어",
};
const imageCache = new Map<string, HTMLImageElement>();
function warmImage(path: string) {
  if (typeof window === "undefined" || typeof window.Image !== "function") return;
  if (!imageCache.has(path)) { const image = new window.Image(); image.src = path; imageCache.set(path, image); }
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

export default function PetBattleSheet({ encounter, petId, condition, stage, hour, onClose, onWin }: {
  encounter: Encounter; petId: PetId; condition?: Condition; stage: PetStage; hour: number; onClose: () => void; onWin?: () => void;
}) {
  const attempt = useRef(0);
  const names = { player: PETS[petId].name, opponent: encounter.name };
  const lastRival = useRef("");
  const start = (roundSeed: number) => createBattle({
    seed: seedFor(`${encounter.cellId}:${petId}:${roundSeed}`, encounter.daySeed),
    player: buildFighter(petId === 1 ? "B001" : "B002", encounter.playerLevel, [], { condition }),
    opponent: encounter.fighter, difficulty: encounter.difficulty,
  });
  const introduction = (state: BattleState) => playbackFor(state, state, [
    { motion: "intro", duration: 2400 },
    { rivalText: encounterLine(encounter, "enter", encounter.individual.seed), duration: 1600 },
  ]);
  const [battle, setBattle] = useState(() => start(0));
  const [playback, setPlayback] = useState<Playback | null>(() => introduction(battle));
  const [menu, setMenu] = useState<"main" | "moves">("main");
  const [preview, setPreview] = useState("");
  const [reduced, setReduced] = useState(false);
  const [filter, setFilter] = useState<MoveFilter>("all"), [page, setPage] = useState(0);
  const [previewCost, setPreviewCost] = useState(0);
  const [detailSide, setDetailSide] = useState<Side | null>(null);
  const [seen, setSeen] = useState<Record<Side, string[]>>({ player: [], opponent: [] });
  const pagesRef = useRef<HTMLDivElement>(null), detailsRef = useRef<HTMLDialogElement>(null);
  const focusPage = useRef(false);
  const paused = detailSide !== null || !!preview;
  const detailHeading = useId();
  const dialog = useRef<HTMLDialogElement>(null), message = useRef<HTMLButtonElement>(null);
  const arena = useRef<HTMLDivElement>(null);
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
  const round = playback?.shown.round ?? battle.round;
  useEffect(() => {
    if (cue?.seenMove && cue.side) {
      const side = cue.side, id = cue.seenMove;
      setSeen(previous => previous[side].includes(id) ? previous : { ...previous, [side]: [...previous[side], id] });
      for (const sheet of battleMoveFx(id, round - 1).sheets ?? []) warmImage(sheet.path);
    }
  }, [cue, round]);
  const moveFx = cue?.moveFx ? battleMoveFx(cue.moveFx, round - 1) : undefined;
  const text = cue?.text ?? "";
  const characters = Array.from(text);
  const typing = !!cue?.text && playback!.revealed < characters.length;
  const intro = cue?.motion === "intro";
  const shown = playback?.shown ?? battle;
  const [displayHp, setDisplayHp] = useState({ player: shown.player.hp, opponent: shown.opponent.hp, playerEnergy: shown.player.energy, opponentEnergy: shown.opponent.energy });
  const hpRef = useRef(displayHp);
  useEffect(() => {
    const from = hpRef.current, to = { player: shown.player.hp, opponent: shown.opponent.hp, playerEnergy: shown.player.energy, opponentEnergy: shown.opponent.energy };
    let frame = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const progress = reduced ? 1 : 1 - (1 - ++frame / 10) ** 3;
      hpRef.current = { player: Math.round(from.player + (to.player - from.player) * progress), opponent: Math.round(from.opponent + (to.opponent - from.opponent) * progress), playerEnergy: Math.round(from.playerEnergy + (to.playerEnergy - from.playerEnergy) * progress), opponentEnergy: Math.round(from.opponentEnergy + (to.opponentEnergy - from.opponentEnergy) * progress) };
      setDisplayHp(hpRef.current);
      if (progress < 1) timer = setTimeout(tick, 30);
    };
    if (Object.keys(to).some(key => from[key as keyof typeof to] !== to[key as keyof typeof to])) tick();
    return () => clearTimeout(timer);
  }, [shown.player.hp, shown.opponent.hp, shown.player.energy, shown.opponent.energy, reduced]);
  const outcome = cue?.outcome ?? (!playback ? battle.outcome : undefined);
  const finished = !playback && !!battle.outcome;
  const phase = intro ? "intro" : finished ? "result" : playback ? "playback" : "command";

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
    if (!playback || paused) return;
    const index = playback.index + 1, nextCue = playback.cues[index];
    if (!nextCue) { setBattle(playback.next); setPlayback(null); playing.current = false; return; }
    setPlayback({ ...playback, index, revealed: 0, line: nextCue.text ?? playback.line,
      shown: nextCue.event ? showBattleEvent(playback.shown, nextCue.event, playback.next) : playback.shown });
  }
  useEffect(() => {
    if (!playback || paused) return;
    const delay = typing ? 18 : cue?.text ? 900 : cue?.moveName || cue?.result || cue?.rivalText ? cue.duration ?? 1200 : reduced && cue?.motion && !cue.moveFx ? cue.fx || cue.critical ? 300 : 0 : cue?.duration ?? 0;
    const timer = setTimeout(() => {
      if (typing) setPlayback({ ...playback, revealed: playback.revealed + 1 });
      else advance();
    }, delay);
    return () => clearTimeout(timer);
    // Playback owns the immutable cue and text for this timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback, reduced, paused]);
  useEffect(() => {
    if (!reduced && cue?.motion === "effective") navigator.vibrate?.(30);
  }, [cue, reduced]);
  useEffect(() => {
    if (phase === "playback" || phase === "intro") message.current?.focus({ preventScroll: true });
    else command.current?.focus({ preventScroll: true });
  }, [phase, menu]);
  useLayoutEffect(() => {
    if (focusPage.current) pagesRef.current?.querySelector<HTMLButtonElement>('.pet-battle-page:not([inert]) button:not(:disabled)')?.focus({ preventScroll: true });
    focusPage.current = false;
  }, [page]);

  function choose(action: Action) {
    if (paused || playing.current || !availableActions(battle, "player").some(a => sameAction(a, action))) return;
    const next = stepRound(battle, action);
    if (next.state.outcome === "player") onWin?.();
    playing.current = true; cancelHold(); setPreview(""); setPreviewCost(0); setMenu("main");
    const spoken = rivalCues(battleCues(next.events, names), encounter, next.state, lastRival.current);
    lastRival.current = spoken.last;
    setPlayback(playbackFor(battle, next.state, spoken.cues));
  }
  function bag() {
    if (playing.current) return;
    const item = availableActions(battle, "player").find(a => a.kind === "item");
    if (item) { choose(item); return; }
    playing.current = true;
    setPlayback(playbackFor(battle, battle, [{ text: "가방이 비었어요." }]));
  }
  function restart() {
    const next = start(++attempt.current); setSeen({ player: [], opponent: [] }); setFilter("all"); setPage(0);
    playing.current = true; cancelHold(); setPreview(""); setPreviewCost(0); setMenu("main"); setBattle(next); setPlayback(introduction(next));
  }
  const actions: Action[] = [...new Set([...battle.player.moves, ...(battle.player.finisher ? [battle.player.finisher] : [])])].map(moveId => ({ kind: "move", moveId }));
  actions.push({ kind: "push" }, { kind: "rest" });
  actions.sort((a, b) => MOVE_KIND[moveFor(a)?.kind ?? "support"].order - MOVE_KIND[moveFor(b)?.kind ?? "support"].order);
  const pages = movePages(actions, filter);
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
    </section>;
  }
  function fighter(side: Side) {
    const motion = outcome && outcome !== "draw" && outcome !== "quit" ? outcome === side ? "win" : "tired" : cue?.side === side ? cue.motion : undefined;
    const animation = moveFx && (cue?.side === side ? `pet-move-${moveFx.motion}` : cue?.target === side ? `pet-react-${cue.missed ? "dodge" : moveFx.reaction}` : undefined);
    return <div className="pet-battle-fighter" data-side={side}>
      <div className="pet-battle-platform" />
      <div className="pet-battle-entry"><div key={animation ? `${shown.round}-${playback?.index}` : "idle"} className="pet-battle-portrait" data-motion={motion} style={animation ? { animation: `${animation} ${moveFx!.duration}ms ease-in-out both` } : undefined}>
        {side === "player" ? <Image src={PETS[petId].standing[stage]} alt={names.player} width={320} height={320} sizes="42vw" loading="eager" /> : <BreedPicture key={encounter.id} breedId={shown.opponent.breedId} name={names.opponent} art={encounter.art} />}
        <span className="pet-battle-flash" aria-hidden="true" />
        {motion === "win" && <span className="pet-battle-sparkles" aria-hidden="true">✦ · ✧<br />✧　✦</span>}
      </div></div>
      {cue?.side === side && cue.fx && <span key={`${shown.round}-${playback?.index}-fx`} className="pet-battle-fx" data-weak={cue.motion === "weak-hit"} aria-hidden="true">
        <span className="pet-battle-flash" />
        <Image src={`/pet/battle/fx-${cue.fx}.webp`} alt="" width={160} height={160} unoptimized loading="eager" onError={e => { e.currentTarget.style.visibility = "hidden"; }} />
      </span>}
      {moveFx && (cue?.target ?? cue?.side) === side && <span key={`${shown.round}-${playback?.index}-art`} className="pet-battle-art" data-side={cue?.side} data-missed={cue?.missed} style={{ "--art-duration": `${moveFx.duration}ms` } as CSSProperties} aria-hidden="true">
        {!cue?.missed && moveFx.image && <Image src={moveFx.image} alt="" width={160} height={160} unoptimized onError={e => { e.currentTarget.style.visibility = "hidden"; }} />}
        {(cue?.missed ? [fxSheets("smoke", shown.round)] : moveFx.sheets ?? []).map((sheet, i) => <FxSprite key={`${sheet.id}-${i}`} sheet={sheet} reduced={reduced} delay={reduced ? 0 : Math.round(moveFx.duration * .2)} tint={moveFx.tint} duration={moveFx.duration * .7} />)}
      </span>}
      {cue?.side === side && (cue.fx || cue.critical) && <span key={`${shown.round}-${playback?.index}-sprite`} className="pet-battle-art" data-critical={cue.critical} aria-hidden="true">
        <FxSprite sheet={fxSheets(cue.critical ? "particle" : cue.fx === "heal" ? "heal" : cue.fx === "buff" ? "buff" : cue.fx === "shield" ? "shield" : cue.fx === "hit" || cue.fx === "hit-good" ? "impact" : "debuff", cue.critical ? 3 : cue.fx === "buff" ? 4 : shown.round)} reduced={reduced} duration={cue.duration} />
      </span>}
      {cue?.side === side && cue.amount !== undefined && <strong key={`${shown.round}-${playback?.index}`} className="pet-battle-number" data-critical={cue.critical} data-good={cue.fx === "hit-good"} data-weak={cue.motion === "weak-hit"} data-heal={cue.motion === "heal"} aria-hidden="true">{cue.motion === "heal" ? "+" : "−"}{cue.amount}</strong>}
      {cue?.side === side && cue.moveName && <p key={`${shown.round}-${playback?.index}-name`} className="pet-battle-skill-name" role="status">{cue.moveName}</p>}
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

  return <dialog ref={dialog} className="pet-battle-screen" style={{ "--arena-bg": `url(${cellBackground(encounter.cellId, hour)})` } as CSSProperties} aria-labelledby={heading} tabIndex={-1} onCancel={e => { e.preventDefault(); if (paused) { closeDetail(); } else if (menu === "moves" && !playback) { setMenu("main"); setPreview(""); } else onClose(); }}>
    <div className="pet-battle-scene" data-phase={phase} data-paused={paused} data-impact={cue?.motion === "effective" || !!cue?.critical} data-heavy={cue?.moveFx === "T63" && !cue.missed} key={attempt.current} onClick={intro && !paused ? advance : undefined}>
      <div ref={arena} className="pet-battle-arena">
        <header className="pet-battle-topline"><h2 id={heading} className="pet-battle-sr">동네 겨루기</h2>{!finished && <span key={shown.round} className="pet-battle-round" data-urgency={shown.round >= MAX_ROUNDS ? "last" : shown.round >= MAX_ROUNDS - 1 ? "near" : shown.round >= MAX_ROUNDS - 2 ? "late" : undefined}>라운드 {shown.round}/{MAX_ROUNDS}</span>}</header>
        {!finished && hud("opponent")}{fighter("opponent")}{fighter("player")}{!finished && hud("player")}
        {moveFx && <div key={`${shown.round}-${playback?.index}-move`} className="pet-battle-move-fx" data-side={cue?.side} data-trail={moveFx.trail} data-local={moveFx.reaction === "none"} data-missed={cue?.missed} style={{ "--fx-duration": `${moveFx.duration}ms` } as CSSProperties} aria-hidden="true">
          {moveFx.elements.map((element, i) => <span key={i} className="pet-battle-fx-part" style={{ "--part": i, animationName: `pet-trail-${moveFx.trail}` } as CSSProperties}>
            <span className="pet-battle-fx-glyph" data-shape={element}>
              {element.startsWith("fx-") ? <Image src={`/pet/battle/${element}.webp`} alt="" width={80} height={80} unoptimized loading="eager" onError={e => { e.currentTarget.style.visibility = "hidden"; }} /> : ["ring", "wave", "streak"].includes(element) ? null : element}
            </span>
          </span>)}
        </div>}
        {cue?.result && <p key={`${shown.round}-${playback?.index}-result`} className="pet-battle-center-result" role="status">{cue.result}</p>}
        {cue?.cutin && <div className="pet-battle-cutin" data-side={cue.side} aria-hidden="true"><Image src={cue.side === "opponent" ? encounter.art : PETS[petId].standing[stage]} alt="" width={160} height={160} unoptimized /><strong>기세</strong><span>✦ ✧ ✦</span></div>}
        {finished && <div className="pet-battle-banner" data-victory={outcome === "player"} role="status"><h3>{result}</h3></div>}
      </div>
      <div className="pet-battle-console">
        {finished ? <div className="pet-battle-result"><p>{outcome === "player" ? "정말 멋진 움직임이었어요!" : outcome === "opponent" ? "끝까지 함께해 줘서 고마워요." : "다음에도 즐겁게 겨뤄요!"}</p><div className="pet-battle-result-actions">{outcome === "opponent" && <button ref={command} type="button" onClick={restart}>다시</button>}<button ref={outcome !== "opponent" ? command : undefined} type="button" onClick={onClose}>돌아가기</button></div></div>
          : <>
            {playback && <div className={text ? "pet-battle-dialogue" : "pet-battle-sr"}>
            {playback && <button ref={message} type="button" className={intro ? "pet-battle-sr" : "pet-battle-message"} aria-label={intro ? "등장 연출 건너뛰기" : typing ? "대사 모두 보기" : playback ? "다음 대사" : "대결 안내"} onClick={e => { e.stopPropagation(); if (intro) advance(); else if (typing) setPlayback({ ...playback!, revealed: characters.length }); else if (cue?.text) advance(); }}>
              <span aria-hidden="true">{intro ? "" : typing ? characters.slice(0, playback!.revealed).join("") : text}</span>
              <span className="pet-battle-sr" role="status" aria-live="polite">{intro ? "등장 연출, 눌러서 건너뛰기" : text}</span>
            </button>}
            </div>}
            {!playback ? <div className="pet-battle-command">
              <div className="pet-battle-actions" data-menu={menu} aria-label={menu === "main" ? "대결 명령" : "기술 선택"}>
                {menu === "main" ? <>
                  <button ref={command} type="button" className="pet-battle-primary" onClick={() => { setMenu("moves"); setPreview(""); setPage(0); }}><span aria-hidden="true">✦</span> 기술</button>
                  <button type="button" onClick={bag}><span aria-hidden="true">▣</span> 가방</button>
                  <button type="button" data-kind="support" disabled={!allowed.some(a => a.kind === "rest")} onClick={() => choose({ kind: "rest" })}><span aria-hidden="true">✨</span> 숨 고르기<small>기력 +{REST_ENERGY}</small></button>
                  <button type="button" onClick={() => choose({ kind: "quit" })}><span aria-hidden="true">↗</span> 그만하기</button>
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
                        return <div key={label} className="pet-battle-card" data-kind={move?.kind ?? "support"} data-insufficient={insufficient}>
                          <button type="button" className="pet-battle-move" data-group={move?.group ?? "neutral"} data-kind={move?.kind ?? "support"} data-hint={hint} aria-disabled={!enabled}
                            aria-label={`${kind.label}, ${label}, ${move ? moveEffect(move, battle) : `기력 +${REST_ENERGY}`}, 기력 ${cost}${insufficient ? ", 기력 부족" : ""}${move?.kind === "attack" ? `, ${HINT_LABEL[hint]}` : ""}`}
                            onFocus={() => setPreviewCost(cost)} onBlur={() => { cancelHold(); if (!preview) setPreviewCost(0); }} onPointerEnter={e => { setPreviewCost(cost); if (e.pointerType === "mouse") { cancelHold(); holdTimer.current = setTimeout(showDetail, 500); } }}
                            onPointerDown={e => { if (!e.isPrimary || e.button !== 0) return; cancelHold(); held.current = false; setPreviewCost(cost); holdTimer.current = setTimeout(() => { held.current = true; showDetail(); }, 500); }}
                            onPointerUp={cancelHold} onPointerCancel={() => { cancelHold(); held.current = false; setPreviewCost(0); }} onPointerLeave={() => { cancelHold(); if (!preview) setPreviewCost(0); }}
                            onContextMenu={e => e.preventDefault()} onKeyDown={e => { if (e.key === " " && !e.repeat) { held.current = false; holdTimer.current = setTimeout(() => { held.current = true; showDetail(); }, 500); } }} onKeyUp={cancelHold}
                            onClick={() => { cancelHold(); if (held.current) { held.current = false; return; } if (enabled) choose(action); }}>
                            <span className="pet-battle-kind" aria-hidden="true">{kind.icon}</span>
                            <span className="pet-battle-move-copy"><span className="pet-battle-move-title"><strong title={label}>{label}</strong>{move?.kind === "attack" && hint !== "normal" && <span className="pet-battle-matchup" data-hint={hint}>{hint === "good" ? "↑ 효과 좋음" : "↓ 효과 약함"}</span>}</span><small>{damage ? <>피해 {damage.base}{damage.delta !== 0 && <span className="pet-battle-delta" data-good={damage.delta > 0}> {damage.delta > 0 ? "↑+" : "↓−"}{Math.abs(damage.delta)}</span>}</> : move ? compactEffect(move, battle) : `기력 +${REST_ENERGY}`}</small></span>
                            <span className="pet-battle-cost" data-finisher={!!move?.finisher}>{move?.finisher ? "기세" : costBadge(cost)}{insufficient && <small>{move?.finisher ? "부족" : "기력 부족"}</small>}</span>
                          </button>
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
