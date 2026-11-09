"use client";

import { useEffect, useRef, useState } from "react";
import type { PetAction, PetFace, PetStage } from "@/lib/domine/pet";
import { bodyAt, FAR_PATH, HILL_PATH, skyAt, STARS } from "@/lib/domine/sky";
import { DOG_W, PetBowl, PetDog, RATIO } from "./PetDog";

/**
 * 도미가 노는 장면. 행동마다 여러 가지 연출(대본)이 있고 그중 하나를 무작위로 고른다.
 * 대본은 [시작 ms, 바뀔 값] 목록이며, 위치는 CSS transition 으로 부드럽게 움직인다.
 * 결과(수치)는 서버가 정하고, 여기서는 보이는 연출만 다룬다.
 */
type Dir = 1 | -1;
type Ball = { x: number; y: number; dur: number };
type Hand = { x: number; y: number; dur: number; rot: number; stroke: boolean; e: string };
type Item = { e: string; x: number; y: number; dur: number; size: number };
type Fx = "hearts" | "sparkle" | "drops" | "bubbles" | "spray";
type S = {
  x: number;
  y: number;
  dir: Dir;
  dur: number;
  motion: string | null;
  ball: Ball | null;
  hand: Hand | null;
  item: Item | null;
  bowl: number | null;
  fx: Fx[];
  scroll: boolean;
};
type Patch = Partial<S> & { say?: string };
type Plan = { steps: [number, Patch][]; end: number };

const HOME: S = {
  x: 78, y: 82, dir: 1, dur: 600, motion: null,
  ball: null, hand: null, item: null, bowl: null, fx: [], scroll: false,
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const depth = (y: number) => 0.84 + ((y - 76) / 13) * 0.2;

function makePlan(action: PetAction | "tap", w: number): Plan {
  const h = w * RATIO;
  const X = HOME.x;
  const Y = HOME.y;
  const top = Y - h - 8;

  if (action === "tap") {
    return { steps: [[0, { motion: "pet-flip", say: pick(["으랏차!", "공중제비!", "와!", "짜잔!"]) }]], end: 950 };
  }

  if (action === "play") {
    const d: Dir = Math.random() < 0.5 ? -1 : 1;
    const tx = clamp(X + d * rnd(32, 54), 18, 142);
    const ty = rnd(77, 88);
    const throwIt: [number, Patch][] = [
      [0, { dir: d, dur: 250, motion: "pet-hop", ball: { x: X + d * 6, y: Y - h * 0.6, dur: 0 }, say: pick(["던진다!", "간다~", "받아라!"]) }],
      [150, { ball: { x: (X + tx) / 2, y: Y - h - 20, dur: 450 } }],
      [600, { ball: { x: tx, y: ty - 2, dur: 450 } }],
    ];
    const back = (from: number): [number, Patch][] => [
      [from, { ball: null, motion: "pet-hop", say: pick(["잡았다!", "물었다!"]) }],
      [from + 450, { dir: (-d) as Dir, x: X + d * 14, y: Y, dur: 950, motion: "pet-trot" }],
      [from + 1450, { ball: { x: X + d * 10, y: Y - 2, dur: 0 }, motion: "pet-hop", say: pick(["가져왔어요!", "또 던져 줘요!", "칭찬해 주세요!"]) }],
    ];
    const r = Math.random();
    if (r < 0.5) {
      return { steps: [...throwIt, [1100, { x: tx, y: ty, dir: d, dur: 900, motion: "pet-trot", say: "공이다!" }], ...back(2050)], end: 4600 };
    }
    if (r < 0.65) {
      return {
        steps: [...throwIt,
          [1100, { dir: (-d) as Dir, dur: 400, say: pick(["흥, 안 가져올래.", "공은 관심 없어요.", "귀찮아요~"]) }],
          [1800, { motion: "pet-lie" }],
          [3000, { ball: null, motion: null }]],
        end: 3600,
      };
    }
    if (r < 0.8) {
      const edge = d > 0 ? 152 : 8;
      return {
        steps: [...throwIt,
          [1100, { x: tx, y: ty, dir: d, dur: 900, motion: "pet-trot" }],
          [2050, { ball: null, say: "내 거야!" }],
          [2100, { x: edge, dur: 800 }],
          [3000, { dir: (-d) as Dir, x: X, y: Y, dur: 1100, say: "메롱~" }]],
        end: 4500,
      };
    }
    const t2 = clamp(tx + d * 28, 16, 144);
    return {
      steps: [...throwIt,
        [1100, { x: tx, y: ty, dir: d, dur: 900, motion: "pet-trot", say: "공이다!" }],
        [1800, { ball: { x: t2, y: ty - 2, dur: 450 }, say: "어어?" }],
        [2000, { x: t2, dur: 500 }],
        ...back(2600).map(([t, p]) => [t + 150, p] as [number, Patch])],
      end: 5000,
    };
  }

  if (action === "pet") {
    const k = pick(["head", "back", "rump", "chin", "belly"] as const);
    const sp = {
      head: { lx: w * 0.36, ly: -h * 0.95, m: "pet-nuzzle", say: ["머리 쓰다듬는 거 좋아요!", "헤헤, 좋아요~"] },
      back: { lx: 0, ly: -h * 0.66, m: "pet-wiggle", say: ["등 쓰다듬어 주니 시원해요.", "그 자리예요!"] },
      rump: { lx: -w * 0.38, ly: -h * 0.6, m: "pet-wiggle", say: ["엉덩이 토닥토닥~", "꼬리가 신나요!"] },
      chin: { lx: w * 0.44, ly: -h * 0.45, m: "pet-nuzzle", say: ["턱 밑이 제일 좋아요.", "으으~ 시원해요."] },
      belly: { lx: 0, ly: -h * 0.18, m: "pet-roll", say: ["배도 쓰다듬어 주세요!", "배 보여 줄게요!"] },
    }[k];
    const px = X + sp.lx * 0.93;
    const py = Y + sp.ly * 0.93;
    const hand = (x: number, y: number, dur: number, stroke: boolean): Hand => ({ x, y, dur, rot: 0, stroke, e: "🤚" });
    const startAt = k === "belly" ? 900 : 120;
    return {
      steps: [
        ...(k === "belly" ? ([[0, { motion: sp.m }]] as [number, Patch][]) : []),
        [startAt - 100, { hand: hand(px + 8, py - 26, 0, false) }],
        [startAt, { hand: hand(px, py - 4, 380, false) }],
        [startAt + 400, { hand: hand(px, py - 4, 0, true), motion: k === "belly" ? "pet-roll" : sp.m, fx: ["hearts"], say: pick(sp.say) }],
        [startAt + 1700, { hand: hand(px + 8, py - 26, 400, false), fx: [] }],
        [startAt + 2150, { hand: null, motion: null }],
      ],
      end: startAt + 2400,
    };
  }

  if (action === "feed") {
    const food = pick(["🍖", "🍗", "🥩", "🥓", "🍚", "🥕"]);
    const bx = clamp(X + w * 0.62, 20, 140);
    const base: [number, Patch][] = [
      [0, { bowl: bx, item: { e: food, x: bx, y: Y - 34, dur: 0, size: 10 }, say: "밥이다!" }],
      [150, { item: { e: food, x: bx, y: Y - 9, dur: 380, size: 10 } }],
    ];
    if (Math.random() < 0.25) {
      return {
        steps: [...base,
          [700, { dir: -1, dur: 300, motion: "pet-shake", say: "흠… 킁킁" }],
          [1500, { dir: 1, dur: 300, motion: "pet-eatnod", say: "…맛있네?" }],
          [3100, { item: null, bowl: null, motion: null, say: "잘 먹었습니다!" }]],
        end: 3500,
      };
    }
    return {
      steps: [...base,
        [600, { motion: "pet-eatnod" }],
        [2300, { item: null, bowl: null, motion: null, say: pick(["잘 먹었습니다!", "냠냠, 맛있다!", "꺼억~", "더 주세요!"]) }]],
      end: 2800,
    };
  }

  if (action === "treat") {
    const e = pick(["🦴", "🍪", "🥓", "🍩"]);
    const ix = X + w * 0.3;
    if (Math.random() < 0.5) {
      return {
        steps: [
          [0, { item: { e, x: ix, y: Y - h - 22, dur: 0, size: 10 }, say: "간식이다!" }],
          [100, { item: { e, x: ix, y: Y - h * 0.75, dur: 450, size: 10 }, motion: "pet-hop" }],
          [650, { item: null, say: pick(["냠!", "공중에서 잡았다!"]) }],
          [1300, { motion: null }]],
        end: 1900,
      };
    }
    return {
      steps: [
        [0, { item: { e, x: ix, y: Y - h - 22, dur: 0, size: 10 }, say: "간식이다!" }],
        [100, { item: { e, x: ix, y: Y - 3, dur: 520, size: 10 } }],
        [700, { motion: "pet-sit", say: "기다려… 앉아!" }],
        [1500, { item: null, motion: "pet-eatnod", say: "냠냠!" }],
        [2500, { motion: null }]],
      end: 2900,
    };
  }

  if (action === "brush") {
    const ly = Y - h * 0.68;
    const xs = [-0.38, -0.12, 0.14, 0.36, 0.1, -0.16, -0.38, -0.1, 0.16, 0.36];
    const comb = (i: number): [number, Patch] => [
      300 + i * 260,
      { item: { e: "🪮", x: X + xs[i] * w, y: ly - 3, dur: i === 0 ? 0 : 240, size: 12 } },
    ];
    return {
      steps: [
        [0, { motion: "pet-wiggle", say: pick(["빗질 시원해요!", "털이 반짝반짝~", "엉킨 털이 풀려요."]) }],
        ...xs.map((_, i) => comb(i)),
        [300 + xs.length * 260, { item: null, fx: ["sparkle"], motion: null, say: "반질반질해졌어요!" }],
      ],
      end: 300 + xs.length * 260 + 900,
    };
  }

  if (action === "bath") {
    const bucket = Math.random() < 0.4;
    return {
      steps: [
        [0, { item: { e: bucket ? "🪣" : "🚿", x: X - (bucket ? 6 : 2), y: top - 2, dur: 0, size: 15 }, say: bucket ? "물 붓는다~" : "샤워 시작!" }],
        [500, { fx: ["drops"] }],
        [1500, { fx: ["drops", "bubbles"], say: pick(["거품이 간질간질!", "으~ 시원해요!"]) }],
        [2400, { item: null, fx: ["spray"], motion: "pet-shake", say: "부르르르~" }],
        [3300, { fx: [], motion: null, say: pick(["뽀송뽀송!", "개운해요!"]) }],
      ],
      end: 3900,
    };
  }

  if (action === "train") {
    const k = pick(["sit", "paw", "spin", "roll"] as const);
    const reward = (t: number): [number, Patch] => [t, { hand: null, item: { e: "🦴", x: X + w * 0.4, y: Y - h * 0.6, dur: 0, size: 9 }, say: pick(["잘했어!", "착하다!", "최고!"]) }];
    if (k === "sit") {
      return {
        steps: [
          [0, { hand: { x: X + w * 0.3, y: top, dur: 0, rot: 0, stroke: false, e: "☝️" }, say: "앉아!" }],
          [400, { motion: "pet-sit" }],
          reward(1500),
          [2100, { item: null, motion: null }]],
        end: 2600,
      };
    }
    if (k === "paw") {
      const hx = X + w * 0.66;
      const hy = Y - h * 0.3;
      return {
        steps: [
          [0, { hand: { x: hx + 14, y: hy, dur: 0, rot: 0, stroke: false, e: "✋" }, say: "손!" }],
          [300, { hand: { x: hx, y: hy, dur: 300, rot: 0, stroke: false, e: "✋" }, motion: "pet-hop" }],
          [900, { hand: { x: hx, y: hy, dur: 0, rot: 0, stroke: true, e: "✋" }, motion: "pet-wiggle" }],
          reward(1900),
          [2500, { item: null, motion: null }]],
        end: 3000,
      };
    }
    if (k === "spin") {
      return {
        steps: [
          [0, { say: "빙글빙글!" }],
          [150, { dir: -1, dur: 280 }],
          [550, { dir: 1, dur: 280 }],
          [950, { dir: -1, dur: 280 }],
          [1350, { dir: 1, dur: 280 }],
          reward(1750),
          [2350, { item: null }]],
        end: 2800,
      };
    }
    return {
      steps: [
        [0, { say: "구르기!" }],
        [300, { motion: "pet-flip" }],
        [1300, { motion: null }],
        reward(1500),
        [2100, { item: null }]],
      end: 2600,
    };
  }

  // walk
  return {
    steps: [
      [0, { scroll: true, motion: "pet-trot", say: "산책 나가요!" }],
      [1400, { say: pick(["풀 냄새~", "바람이 좋아요!", "멍멍!"]) }],
      [2700, { say: pick(["저기 가 봐요!", "신난다!", "헥헥~"]) }],
    ],
    end: 4000,
  };
}

type Props = {
  stage: PetStage;
  face: PetFace;
  light: number;
  hour: number;
  collar: string;
  /** 새 행동이 시작될 때마다 id 가 바뀐다 */
  cue: { action: PetAction; id: number } | null;
  onSay: (text: string) => void;
  /** 한쪽에 말풍선을 두려고 도미의 가로 위치를 알려 준다 */
  onMove?: (x: number) => void;
};

export function PetScene({ stage, face, light, hour, collar, cue, onSay, onMove }: Props) {
  const [s, setS] = useState<S>(HOME);
  const timers = useRef<number[]>([]);
  const latest = useRef({ stage, onSay, onMove });
  latest.current = { stage, onSay, onMove };

  function run(plan: Plan) {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    plan.steps.forEach(([t, patch]) => {
      timers.current.push(
        window.setTimeout(() => {
          const { say, ...rest } = patch;
          if (say) latest.current.onSay(say);
          if (rest.x !== undefined) latest.current.onMove?.(rest.x);
          setS((prev) => ({ ...prev, ...rest }));
        }, t)
      );
    });
    timers.current.push(
      window.setTimeout(() => {
        setS(HOME);
        latest.current.onMove?.(HOME.x);
      }, plan.end)
    );
  }

  useEffect(() => {
    if (cue) run(makePlan(cue.action, DOG_W[latest.current.stage]));
    // cue.id 가 바뀔 때만 새 연출을 시작한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.id]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const c = skyAt(hour);
  const body = bodyAt(hour);
  const sc = depth(s.y);
  const w = DOG_W[stage];
  const h = w * RATIO;
  const move = (x: number, y: number, dur: number, extra = "") => ({
    transform: `translate(${x}px, ${y}px)${extra}`,
    transition: `transform ${dur}ms ease-in-out`,
  });

  return (
    <svg
      viewBox="0 6 160 90"
      className="block w-full"
      role="img"
      aria-label={`${stage === "baby" ? "아기" : stage === "young" ? "어린" : "다 큰"} 강아지 도미`}
    >
      <defs>
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

      {s.bowl !== null ? (
        <g transform={`translate(${s.bowl} ${HOME.y + 1})`} className="fade-in">
          <PetBowl />
        </g>
      ) : null}

      {/* 도미 (가로 위치·방향·깊이는 transition 으로 부드럽게) */}
      <g style={move(s.x, s.y, s.dur, ` scale(${s.dir * sc}, ${sc})`)}>
        <ellipse cx="0" cy="1" rx={w * 0.42} ry="3" fill="#000" opacity="0.28" />
        <PetDog
          stage={stage}
          face={face}
          motion={s.motion}
          light={light}
          collar={collar}
          onTap={() => run(makePlan("tap", w))}
        />
      </g>

      {/* 효과 (도미를 따라다니되 뒤집히지 않게) */}
      <g style={move(s.x, s.y, s.dur, ` scale(${sc})`)} pointerEvents="none">
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

      {/* 도구·공·손 */}
      {s.ball ? (
        <g style={move(s.ball.x, s.ball.y, s.ball.dur)}>
          <circle r="2.6" fill="#e6ef3d" stroke="#9aa313" strokeWidth="0.4" />
          <path d="M-2.2 -1 Q0 0.6 2.2 -1" stroke="#fff" strokeWidth="0.5" fill="none" />
        </g>
      ) : null}
      {s.item ? (
        <text textAnchor="middle" fontSize={s.item.size} style={move(s.item.x, s.item.y, s.item.dur)}>
          {s.item.e}
        </text>
      ) : null}
      {s.hand ? (
        <g style={move(s.hand.x, s.hand.y, s.hand.dur)} pointerEvents="none">
          <text textAnchor="middle" fontSize="15" className={s.hand.stroke ? "pet-stroke" : undefined} style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.35))" }}>
            {s.hand.e}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
