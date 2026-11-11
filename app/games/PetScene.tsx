"use client";

import { cellBackground, cellShops } from "@/lib/domine/pet-cells";
import { memo, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { bubblePosition } from "@/lib/domine/pet-bubble";
import type { PetFace, PetStage } from "@/lib/domine/pet";
import { bodyAt, FAR_PATH, HILL_PATH, skyAt, STARS } from "@/lib/domine/sky";
import { ART, BALL, BOWL } from "@/lib/domine/pet-art";
import { line, PRIEST_LINES } from "@/lib/domine/pet-lines";
import { backgroundAt, PETS, PRIEST, DOGHOUSE, type PetId } from "@/lib/domine/pet-photos";
import { mapBackground, SHOPS, type SceneCue } from "@/lib/domine/pet-maps";
import { DEFAULT_CELL, DIRECTIONS, neighborCell, worldCell, type MapTravel } from "@/lib/domine/pet-world";
import { travelEdge } from "@/lib/domine/pet-geometry";
import { DOG_W, PetDog } from "./PetDog";

import { buildIdlePlan, buildScenePlan, restingPose, sampleScenePlan, type ScenePose } from "@/lib/domine/pet-scene-plan";
import { chooseIdleAction, chooseNeedGoal, type IdleGoal } from "@/lib/domine/pet-idle";
import { itemAsset } from "@/lib/domine/pet-assets";
import { chooseTap, tapCount, type TapNeeds, type TapPoint, type TapReaction } from "@/lib/domine/pet-tap";
const depth = (y: number) => 0.84 + ((y - 76) / 13) * 0.2;

/** 소품: 사진이 있으면 사진(가운데 기준), 없으면 이모지 */
function Prop({ e, size, className }: { e: string; size: number; className?: string }) {
  const src = ART[e];
  if (src) {
    const s2 = size * 1.7;
    return <image href={src} x={-s2 / 2} y={-s2 * 0.75} width={s2} height={s2} className={className} />;
  }
  return (
    <text textAnchor="middle" fontSize={size} className={className}>
      {e}
    </text>
  );
}

function Ball({ scale = 1, toy }: { scale?: number; toy?: string | null }) {
  return <image href={itemAsset(toy) ?? BALL} x={-3.2 * scale} y={-3.2 * scale} width={6.4 * scale} height={6.4 * scale} />;
}

type Props = {
  busyText?: string;
  travel?: MapTravel | null;
  arrivalId?: number;
  stage: PetStage;
  face: PetFace;
  light: number;
  hour: number;
  collar: string;
  /** 새 행동이 시작될 때마다 id 가 바뀐다 */
  cue: SceneCue | null;
  petId?: PetId;
  cellId?: string;
  onMap?: () => void;
  onLocal?: (cue: SceneCue) => void;
  locked?: boolean;
  tapDisabled?: boolean;
  onPet?: () => void;
  speaker?: "dog" | "priest";
  onSay: (text: string, speaker?: "dog" | "priest") => void;
  /** 연출이 끝났을 때 */
  onDone?: (id: number, sleep?: boolean) => void;
  paused?: boolean;
  wearable?: string | null;
  toy?: string | null;
  bagToy?: string;
  bubble?: string;
  needs?: TapNeeds;
};

function SpeechBubble({ text, x, y, duration, label }: { text: string; x: number; y: number; duration: number; label: string }) {
  const layer = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLParagraphElement>(null);
  const previousSize = useRef("");
  useLayoutEffect(() => {
    const measure = () => {
      if (!layer.current || !bubble.current) return;
      const width = layer.current.clientWidth;
      const height = layer.current.clientHeight;
      if (!width || !height) return;
      const bubbleWidth = bubble.current.offsetWidth;
      const bubbleHeight = bubble.current.offsetHeight;
      const position = bubblePosition(x, y, width, height, bubbleWidth, bubbleHeight);
      const size = `${text}:${width}:${height}:${bubbleWidth}:${bubbleHeight}`;
      // 글 길이·화면 크기가 바뀔 때는 즉시 보정하고, 도미가 이동할 때만 따라 움직인다.
      const transitionDuration = previousSize.current === size ? `${duration}ms` : "0ms";
      previousSize.current = size;
      Object.assign(bubble.current.style, {
        left: `${position.left}%`, top: `${position.top}%`, visibility: "visible", transitionDuration,
      });
      const tail = bubble.current.lastElementChild as HTMLElement;
      Object.assign(tail.style, { left: `${position.tail}%`, transitionDuration });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (layer.current) observer.observe(layer.current);
    if (bubble.current) observer.observe(bubble.current);
    return () => observer.disconnect();
  }, [text, x, y, duration]);
  return (
    <div ref={layer} className="pointer-events-none absolute inset-0">
      <p ref={bubble} className="pet-speech" aria-label={label}
        style={{ visibility: "hidden" }}>
        <span key={text} className="pet-speech-text" data-arrival={text.endsWith("에 왔어요")}>{text}</span>
        <span aria-hidden="true" className="pet-speech-tail" />
      </p>
    </div>
  );
}

export const PetScene = memo(function PetScene({ busyText, travel, arrivalId, stage, face, light, hour, collar, cue, onSay, onDone, bubble, petId = 1, cellId = DEFAULT_CELL, onMap, onLocal, locked = false, tapDisabled = false, onPet, speaker = "dog", paused = false, wearable, toy, bagToy, needs = { fullness: 70, mood: 70, clean: 80 } }: Props) {
  const cell = worldCell(cellId);
  const [moving, setMoving] = useState(false);
  const [asking, setAsking] = useState<{ from: string; direction: (typeof DIRECTIONS)[number] } | null>(null);
  const ask = asking?.from === cell.id ? neighborCell(cell.id, asking.direction) : null;
  const map = cell.theme;
  const shadowId = useId();
  const [animated, setS] = useState<ScenePose>({ ...restingPose(map) });
  const [idlePose, setIdlePose] = useState<ScenePose | null>(null);
  const [contact, setContact] = useState(false);
  const contactPose = useRef<ScenePose | null>(null);
  const idleGoals = useRef<IdleGoal[]>([]);
  const [reduced, setReduced] = useState(false);
  const [tap, setTap] = useState<(ReturnType<typeof chooseTap> & { id: number }) | null>(null);
  const [seated, setSeated] = useState(false);
  const tapActor = useRef<SVGGElement>(null);
  const taps = useRef({ at: -Infinity, count: 0, recent: [] as TapReaction[], line: "", id: 0 });
  const reacting = !locked && !tapDisabled && !paused && !travel && !contact ? tap : null;
  useLayoutEffect(() => {
    if (reacting) tapActor.current?.getAnimations().forEach((animation) => { animation.currentTime = 0; animation.play(); });
  }, [reacting]);
  function tapDog(point: TapPoint) {
    if (locked || tapDisabled || paused || travel) return;
    const now = performance.now(), previous = taps.current;
    const count = tapCount(previous, now);
    const reaction = chooseTap({ point, needs, count, recent: previous.recent, previousLine: previous.line, seed: Math.floor(Math.random() * 0x100000000) });
    taps.current = { at: now, count, recent: [...previous.recent, reaction.kind].slice(-2), line: reaction.text, id: previous.id + 1 };
    setSeated(false); setIdlePose(null); setTap({ ...reaction, id: taps.current.id });
    onSay(reaction.text);
  }
  useEffect(() => {
    if (!tap) return;
    const end = setTimeout(() => setTap(null), tap.duration);
    const sit = tap.kind === "yawn" ? setTimeout(() => setSeated(true), 600) : undefined;
    return () => { clearTimeout(end); clearTimeout(sit); };
  }, [tap]);
  useEffect(() => {
    if (locked || tapDisabled || paused || travel) { setTap(null); taps.current.at = -Infinity; taps.current.count = 0; }
  }, [locked, tapDisabled, paused, travel]);
  const departure = useRef(restingPose(map));
  const autonomous = !locked && !tapDisabled && !paused && !travel && !contact && !ask && !reduced;
  const base = contact && contactPose.current ? contactPose.current : autonomous && idlePose ? idlePose : cue && !paused && !travel ? animated : restingPose(map);
  const still = reduced ? { ...base, x: restingPose(map).x, y: restingPose(map).y, dir: 1 as const } : base;
  const s = reacting && !reduced ? { ...still, motion: seated && reacting.kind === "yawn" ? "pet-sit" : "pet-tap-still" } : still;
  useLayoutEffect(() => { if (!travel) departure.current = s; });
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout>;
    let first = true;
    const schedule = (event?: Event) => {
      if (event) first = true;
      clearTimeout(timer); setIdlePose(null); setReduced(media.matches);
      if (locked || tapDisabled || paused || travel || contact || ask || tap || media.matches || document.hidden) return;
      timer = setTimeout(() => {
        const { needs, hour } = idleInputs.current;
        const goal = chooseNeedGoal(needs, idleGoals.current, Array.from({ length: 5 }, () => Math.random()));
        idleGoals.current = [...idleGoals.current, goal].slice(-2);
        const plan = buildIdlePlan(chooseIdleAction(hour, goal, Math.random()), { map, width: DOG_W[stage] * PETS[petId].scale * (map === "church" ? .85 : 1) });
        first = false;
        let index = 0;
        const next = () => {
          const frame = plan.keyframes[index];
          setIdlePose(frame.pose);
          if (frame.say) latest.current.onSay(line(frame.say));
          index++;
          timer = setTimeout(index < plan.keyframes.length ? next : schedule, (plan.keyframes[index]?.at ?? plan.durationMs) - frame.at);
        };
        next();
      }, 6000 + Math.random() * 8000 - (first ? 0 : 2700));
    };
    schedule();
    media.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => { clearTimeout(timer); media.removeEventListener("change", schedule); document.removeEventListener("visibilitychange", schedule); };
  }, [locked, tapDisabled, paused, travel, contact, ask, tap, map, stage, petId]);
  const idleInputs = useRef({ needs, hour });
  useLayoutEffect(() => { idleInputs.current = { needs, hour }; }, [needs, hour]);
  const latest = useRef({ onSay, onDone });
  useLayoutEffect(() => { latest.current = { onSay, onDone }; }, [onSay, onDone]);
  const period = backgroundAt(hour);
  const church = map === "church";
  const sceneScale = church ? 0.85 : 1;
  const background = cellBackground(cell.id, hour);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let cancelled = false;
    const config = PETS[petId];
    const pose = s.motion === "pet-sleep" || (!s.motion && face === "sleepy") ? "sleep" : s.motion === "pet-sit" || reacting?.kind === "yawn" ? "sit" : s.motion === "pet-lie" ? "lie" : null;
    const urls = [config.standing[stage], ...(pose ? [config.poses[pose].src] : []), ...(map === "home" ? [DOGHOUSE] : [])];
    const images = urls.map((src) => {
      const img = new Image();
      img.onload = () => { if (!cancelled) setPhotos((prev) => ({ ...prev, [src]: true })); };
      img.src = src;
      return img;
    });
    return () => { cancelled = true; images.forEach((img) => { img.onload = null; img.onerror = null; }); };
  }, [petId, stage, map, s.motion, face, reacting?.kind]);

  useEffect(() => {
    if (!cue || paused || cue.action === "map") return;
    const config = PETS[petId];
    const plan = buildScenePlan(cue, { map, width: DOG_W[stage] * config.scale * sceneScale, ratio: config.ratio, origin: departure.current }, Math.random);
    const started = performance.now();
    let raf = 0, previous = -1, spoken = -1, cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const elapsed = Math.max(performance.now() - started, cue.endsAt ? plan.durationMs - (cue.endsAt - Date.now()) : 0);
      let index = -1;
      for (let i = 0; i < plan.keyframes.length; i++) { if (plan.keyframes[i].at <= elapsed) index = i; }
      if (index !== previous) { previous = index; setS(sampleScenePlan(plan, elapsed)); }
      for (let i = spoken + 1; i <= index; i++) {
        const key = plan.keyframes[i].say;
        if (key) latest.current.onSay(line(key));
        spoken = i;
      }
      if (elapsed >= plan.durationMs) {
        setS(plan.finalPose);
        latest.current.onDone?.(cue.id, cue.action === "sleep");
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    if (cue.action === "priest") latest.current.onSay(PRIEST_LINES[Math.floor(Math.random() * PRIEST_LINES.length)], "priest");
    if (cue.action === "sleep") latest.current.onSay("잠시 눈을 붙일게요…");
    tick();
    return () => { cancelled = true; window.cancelAnimationFrame(raf); };
  }, [cue, map, petId, stage, sceneScale, paused]);

  const edge = travel ? travelEdge(travel.direction, travel.phase === "enter") : null;
  const center = travel?.phase === "exit" ? departure.current : s;
  const travelStyle = edge ? {
    "--edge": `translate(${edge.x}px, ${edge.y}px) scale(${edge.dir * edge.scale}, ${edge.scale})`,
    "--center": `translate(${center.x}px, ${center.y}px) scale(${edge.dir * depth(center.y)}, ${depth(center.y)})`,
    "--edge-opacity": edge.opacity,
  } as React.CSSProperties : undefined;
  const c = skyAt(hour);
  const body = bodyAt(hour);
  const sc = depth(s.y);
  const w = DOG_W[stage] * PETS[petId].scale * sceneScale;
  const h = w * PETS[petId].ratio;
  const sceneToy = autonomous && idlePose ? toy ?? bagToy : toy;
  const move = (x: number, y: number, dur: number, extra = "") => ({
    transform: `translate(${x}px, ${y}px)${extra}`,
    transition: `transform ${dur}ms ease-in-out`,
  });

  return (
    <div className="pet-scene relative h-full w-full" data-paused={paused} data-travel={travel?.phase} data-reduced={travel?.reduced}>
    <div className="pet-scene-picture">
    <svg
      viewBox="0 6 160 90"
      className="block h-full w-full"
      role="group"
      aria-label={`${stage === "baby" ? "아기" : stage === "young" ? "어린" : "다 큰"} 강아지 ${PETS[petId].name}`}
    >
      <defs>
        <radialGradient id={shadowId}>
          <stop offset="0" stopColor="#17231d" stopOpacity="0.4" />
          <stop offset="0.45" stopColor="#17231d" stopOpacity="0.22" />
          <stop offset="1" stopColor="#17231d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pet-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={c.top} />
          <stop offset="1" stopColor={c.bot} />
        </linearGradient>
      </defs>
      <rect y="6" width="160" height="90" fill="url(#pet-sky)" />
      {STARS.map(([sx, sy], i) => (
        <circle key={i} cx={sx * 0.8} cy={sy} r={i % 3 === 0 ? 0.7 : 0.5} fill="#fff" opacity={c.star * (i % 2 ? 0.55 : 0.9)} />
      ))}
      {body.isDay ? (
        <g>
          <circle cx={body.x * 0.8} cy={body.y + 6} r="8" fill="#fff4c2" opacity="0.28" />
          <circle cx={body.x * 0.8} cy={body.y + 6} r="4.2" fill="#fff4c2" />
        </g>
      ) : (
        <g>
          <circle cx={body.x * 0.8} cy={body.y + 6} r="7" fill="#e8ecff" opacity="0.12" />
          <circle cx={body.x * 0.8} cy={body.y + 6} r="3.6" fill="#e8ecff" />
          <circle cx={body.x * 0.8 + 1.4} cy={body.y + 5.4} r="3.1" fill={c.top} opacity="0.55" />
        </g>
      )}
      <g transform="translate(0 24)">
        <g className={s.scroll ? "mil-scroll-far" : undefined}>
          <path d={FAR_PATH} fill={c.far} />
        </g>
        <g className={s.scroll ? "mil-scroll-hill" : undefined}>
          <path d={HILL_PATH} fill={c.hill} />
        </g>
      </g>
      <rect y="66" width="160" height="30" fill={c.ground} />

      <g pointerEvents="none" className={s.scroll ? "pet-photo-pan" : undefined}>
        {!failed[background] && <image href={background} x="0" y="6" width="160" height="90"
          preserveAspectRatio="none" onError={() => setFailed((prev) => ({ ...prev, [background]: true }))} />}
      </g>

      {map !== "field" && !church && <rect pointerEvents="none" y="6" width="160" height="90"
        fill={period === "night" ? "#101d49" : period === "dusk" ? "#e98b44" : "#e7b7af"}
        opacity={period === "night" ? 0.55 : period === "dusk" ? 0.23 : period === "dawn" ? 0.17 : 0} />}

      <g pointerEvents="none" style={{ filter: `brightness(${light})` }}>
        {church && <g transform="translate(-19 0)">
        <ellipse cx="34" cy="78" rx="8" ry="2" fill={`url(#${shadowId})`} />
        {failed[PRIEST] ? <text x="34" y="70" fontSize="6" textAnchor="middle">신부님</text> :
          <image href={PRIEST} x="26" y="29" width="16" height="49" preserveAspectRatio="xMidYMax meet"
            onError={() => setFailed((prev) => ({ ...prev, [PRIEST]: true }))} />}
        </g>}
        {map === "home" && <g role="img" aria-label="개집">
          <ellipse cx="138" cy="82" rx="18" ry="4" fill={`url(#${shadowId})`} />
          {photos[DOGHOUSE] && !failed[DOGHOUSE] ? <image href={DOGHOUSE} x="120" y="48" width="36" height="36"
            onError={() => setFailed((prev) => ({ ...prev, [DOGHOUSE]: true }))} /> :
            <g transform="translate(55 25) scale(.65)" fill="#a4784e"><path d="M99 52 L122 35 L145 52 V81 H99Z" /><path d="M114 81 V66 A8 8 0 0 1 16 0 V81" fill="#382b25" /></g>}
        </g>}
      </g>

      {s.bowl !== null || (reacting?.kind === "hungry" && !reduced) ? (
        <g transform={`translate(${s.bowl ?? s.x + s.dir * w * .6} ${s.y + 1}) scale(${sc * sceneScale})`} className="fade-in" style={{ filter: `brightness(${light})` }}>
          <ellipse cy="1" rx="13" ry="2.5" fill={`url(#${shadowId})`} />
          <image href={BOWL} x={-12} y={-13} width={24} height={14} />
        </g>
      ) : null}

      {travel?.phase === "cross" && <image className="pet-background-cross" href={cellBackground(travel.from, hour)} x="0" y="6" width="160" height="90" preserveAspectRatio="none" pointerEvents="none" />}

      {/* 도미 (가로 위치·방향·깊이는 transition 으로 부드럽게) */}
      <g key={travel ? `${travel.id}-${travel.phase}` : reduced ? `actor-${cue?.id}` : "actor"} data-pet-actor className={travel ? `pet-travel pet-travel-${travel.phase}` : reduced && cue ? "pet-action-fade" : undefined} style={travelStyle ?? move(s.x, s.y, s.dur, ` scale(${s.dir * sc}, ${sc})`)}>
        <ellipse cx="0" cy={1.8 * sceneScale} rx={w * 0.5} ry={5 * sceneScale} fill={`url(#${shadowId})`} />
        <ellipse cx="0" cy={sceneScale} rx={w * 0.3} ry={1.5 * sceneScale} fill={`url(#${shadowId})`} />
        {s.carry ? (
          <g
            transform={`translate(${{ mouth: w * 0.47, back: 0, tail: -w * 0.47, head: w * 0.34 }[s.carry]} ${{ mouth: -h * 0.76, back: -h * 0.8, tail: -h * 0.33, head: -h * 1.0 }[s.carry]})`}
          >
            <Ball scale={sceneScale} toy={sceneToy} />
          </g>
        ) : null}
        <g ref={tapActor} className={reacting ? `pet-tap-motion pet-tap-${reacting.kind}` : undefined}
          style={reacting ? { animationDuration: `${reacting.duration}ms`, "--tap-turn": `${reacting.direction * 8}deg`, "--tap-step": `${reacting.approach * 3}px` } as React.CSSProperties : undefined}>
        <PetDog
          petId={petId}
          scale={sceneScale}
          stage={stage}
          face={face}
          motion={travel ? "pet-trot" : s.motion}
          disabled={locked || tapDisabled || paused || !!travel || !!ask}
          cancelled={locked || paused || !!travel || !!ask}
          onContact={(active) => {
            if (active) { contactPose.current = { ...s, motion: "pet-tap-still", ball: null, carry: null, bowl: null }; setTap(null); setIdlePose(null); }
            setContact(active);
          }}
          onPet={onPet}
          onRelease={() => onSay(line("pet_release"))}
          light={light}
          collar={collar}
          photos={photos}
          wearable={wearable}
          onTap={tapDog}
        />
        </g>
      </g>

      {/* 효과 (도미를 따라다니되 뒤집히지 않게) */}
      <g style={move(s.x, s.y, s.dur, ` scale(${sc})`)} pointerEvents="none">
        {reacting?.effect && <text key={reacting.id} className="pet-tap-effect" x={w * .4} y={-h - 3} fontSize="7" aria-hidden="true" style={{ animationDuration: `${reacting.duration}ms` }}>{reacting.effect}</text>}
        {s.motion === "pet-sleep" && <text y={-h * 0.6} x="8" fontSize="9">💤</text>}
        {s.fx.includes("hearts")
          ? [0, 1, 2].map((i) => (
              <path
                key={i}
                className="pet-heart"
                style={{ animationDelay: `${i * 0.35}s` }}
                d={`M${w * 0.1 + i * 9} ${-h - 4} c-3 -5 -9 -1 -5 4 l5 5 l5 -5 c4 -5 -2 -9 -5 -4 Z`}
                fill="#ef5b7b"
              />
            ))
          : null}
        {s.fx.includes("sparkle") ? (
          <g fontSize="8" textAnchor="middle">
            {[0, 1, 2, 3].map((i) => (
              <text key={i} x={-w * 0.3 + i * w * 0.2} y={-h * 0.7} className="pet-heart" style={{ animationDelay: `${i * 0.3}s` }}>
                ✨
              </text>
            ))}
          </g>
        ) : null}
        {s.fx.includes("bubbles") ? (
          <g fill="#fff" stroke="#7fb8e0" strokeWidth="0.5" opacity="0.9">
            {[0, 1, 2, 3, 4].map((i) => (
              <circle key={i} cx={-w * 0.32 + i * w * 0.16} cy={-h * 0.5} r={2 + (i % 3)} className="pet-heart" style={{ animationDelay: `${i * 0.25}s` }} />
            ))}
          </g>
        ) : null}
        {s.fx.includes("drops") ? (
          <g stroke="#6fb4e6" strokeWidth="0.9" strokeLinecap="round">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path key={i} d={`M${-w * 0.3 + i * w * 0.12} ${-h - 6} v3`} className="pet-drip" style={{ animationDelay: `${(i % 3) * 0.15}s`, ["--fall" as string]: `${h + 4}px` }} />
            ))}
          </g>
        ) : null}
        {s.fx.includes("spray") ? (
          <g fill="#8cc7ee">
            {[-1, 1].flatMap((sgn) =>
              [0, 1, 2, 3].map((i) => (
                <circle
                  key={`${sgn}-${i}`}
                  cx={sgn * w * 0.2}
                  cy={-h * 0.5}
                  r="1.1"
                  className="pet-spray"
                  style={{ ["--dx" as string]: `${sgn * (14 + i * 6)}px`, ["--dy" as string]: `${-6 + i * 6}px`, animationDelay: `${i * 0.05}s` }}
                />
              ))
            )}
          </g>
        ) : null}
      </g>

      {!travel && toy && !s.ball && !s.carry && <g transform={`translate(${map === "home" ? 88 : 128} 81)`}><Ball toy={toy} /></g>}
      {/* 도구·공·손 */}
      <g style={{ filter: `brightness(${light}) drop-shadow(0 0.5px 0.5px #17231d40)` }}>
      {s.ball ? (
        <g style={move(s.ball.x, s.ball.y, s.ball.dur)}>
          <Ball scale={sceneScale} toy={sceneToy} />
        </g>
      ) : null}
      {s.item ? (
        <g style={move(s.item.x, s.item.y, s.item.dur)}>
          <Prop e={s.item.e} size={s.item.size * sceneScale} />
        </g>
      ) : null}
      {s.hand ? (
        <g style={move(s.hand.x, s.hand.y, s.hand.dur)} pointerEvents="none">
          <g className={s.hand.stroke ? "pet-stroke" : undefined}>
            <Prop e={s.hand.e} size={15 * sceneScale} />
          </g>
        </g>
      ) : null}
      </g>
    </svg>
    {church && <button type="button" className={`absolute min-h-11 w-[12%] min-w-11 rounded-xl focus-visible:outline-2 ${church ? "left-[4%] top-[25%] h-[50%]" : "left-[15%] top-[30%] h-[50%]"}`}
      aria-label="신부님께 인사하기" disabled={locked} onClick={() => onLocal?.({ action: "priest", id: Date.now() })} />}
    {cell.id === "F6" && SHOPS.map((shop, index) => <button key={shop.name} type="button"
      className="absolute flex min-h-11 w-[23%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded text-[clamp(11px,3vw,16px)] font-semibold text-[#30271e] focus-visible:outline-2 disabled:opacity-60"
      style={{ left: `${shop.x}%`, top: `${shop.y}%` }} aria-label={`${shop.name} 앞으로 가기`} disabled={locked}
      onClick={() => onLocal?.({ action: "shop", shop: index, id: Date.now() })}>{shop.name}</button>)}
    {!travel && !ask && bubble && <SpeechBubble text={bubble} label={speaker === "priest" ? "신부님의 말" : `${PETS[petId].name}의 말`}
      x={speaker === "priest" ? 18 : s.x + s.dir * w * sc * 0.25}
      y={speaker === "priest" ? 31 : s.y - h * sc} duration={s.dur} />}
    </div>
    <div className="pet-scene-picture pet-scene-ui">
      {busyText && <div className="pet-busy" role="status">{busyText}</div>}
      <div key={arrivalId ?? 0} className={`pet-location${arrivalId && !travel ? " pet-location-arrived" : ""}`} aria-live="polite"><strong>{cell.name}</strong><small>{cell.id}</small></div>
      {cellShops(cell.id).length > 0 && <ul className="pet-shop-plates" aria-label="이 칸의 가게">{cellShops(cell.id).map((name) => <li key={name}>{name}</li>)}</ul>}
      <button type="button" className="pet-map-button" disabled={locked} onClick={onMap} aria-label="동네 지도 열기"><span>MAP</span></button>
      <button type="button" className="pet-move-toggle" aria-pressed={moving} disabled={locked} onClick={() => { setMoving(!moving); setAsking(null); }}><span>{moving ? "닫기" : "이동"}</span></button>
      {moving && DIRECTIONS.map((direction) => {
        const destination = neighborCell(cell.id, direction);
        return destination && <button key={direction} type="button" className={`pet-direction pet-direction-${direction}`}
          aria-label={`${destination.name}(으)로 이동`} disabled={locked} title={destination.name}
          onClick={() => { setAsking({ from: cell.id, direction }); setMoving(false); }}>
          <span aria-hidden="true">{{ n: "↑", s: "↓", e: "→", w: "←" }[direction]}</span>
        </button>;
      })}
      {ask && asking && !locked && <div className="pet-move-confirm" role="alertdialog" aria-label={`${ask.name}(으)로 이동할까요?`}>
        <p><strong>{ask.name}</strong>(으)로 갈까요?</p>
        <div><button type="button" onClick={() => setAsking(null)}>아니요</button>
          <button type="button" data-primary onClick={() => { const direction = asking.direction; setAsking(null); onLocal?.({ action: "map", direction, id: Date.now() }); }}>이동</button></div>
      </div>}
    </div>
    </div>
  );
});
