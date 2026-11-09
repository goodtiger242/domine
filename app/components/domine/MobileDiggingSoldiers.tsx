"use client";

import { useEffect, useState } from "react";

/**
 * 군인 둘과 강아지가 길을 걷는 장면. 인물은 제자리에서 걷고 배경이 흘러가
 * 속도감을 만든다. 하늘·산·땅 색은 접속한 기기의 현재 시각에 맞춰 바뀐다.
 * 팔·다리는 관절(0,0) 기준으로 회전한다 (스타일은 globals.css 의 .mil-*).
 */

type Sky = {
  h: number;
  top: string;
  bot: string;
  far: string;
  hill: string;
  ground: string;
  star: number;
};

const NIGHT = {
  top: "#0b1226",
  bot: "#1c2a52",
  far: "#16213f",
  hill: "#101a33",
  ground: "#0b1226",
  star: 1,
};

const SKY: Sky[] = [
  { h: 0, ...NIGHT },
  { h: 5, top: "#1f2a55", bot: "#6d6a9a", far: "#3b3f6e", hill: "#2a2f58", ground: "#1a1f3d", star: 0.6 },
  { h: 6, top: "#4b5c94", bot: "#f2b38a", far: "#6d6a96", hill: "#4a4570", ground: "#2b2845", star: 0.1 },
  { h: 7, top: "#7fb4e0", bot: "#f6e3c8", far: "#9fb5c8", hill: "#7c9a8a", ground: "#4f6b5a", star: 0 },
  { h: 12, top: "#6fb3e8", bot: "#dcecf8", far: "#a8c0d4", hill: "#84a592", ground: "#567762", star: 0 },
  { h: 17, top: "#7aa6d6", bot: "#f7e0b8", far: "#a3a9b8", hill: "#7f8c80", ground: "#566455", star: 0 },
  { h: 18.5, top: "#4a4f86", bot: "#f2895e", far: "#6a5a84", hill: "#4d4466", ground: "#2f2a47", star: 0.1 },
  { h: 19.5, top: "#1f2755", bot: "#7a4f7e", far: "#3d3a66", hill: "#2c2c55", ground: "#1b1d3b", star: 0.6 },
  { h: 21, ...NIGHT },
  { h: 24, ...NIGHT },
];

const hex = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
const mix = (a: string, b: string, t: number) =>
  "#" +
  [0, 1, 2]
    .map((i) =>
      Math.round(hex(a, i) + (hex(b, i) - hex(a, i)) * t)
        .toString(16)
        .padStart(2, "0")
    )
    .join("");

function skyAt(hour: number): Omit<Sky, "h"> {
  const i = SKY.findIndex((k, idx) => idx < SKY.length - 1 && hour >= k.h && hour <= SKY[idx + 1].h);
  const a = SKY[i];
  const b = SKY[i + 1];
  const t = (hour - a.h) / (b.h - a.h);
  return {
    top: mix(a.top, b.top, t),
    bot: mix(a.bot, b.bot, t),
    far: mix(a.far, b.far, t),
    hill: mix(a.hill, b.hill, t),
    ground: mix(a.ground, b.ground, t),
    star: a.star + (b.star - a.star) * t,
  };
}

const lum = (c: string) =>
  (0.299 * hex(c, 0) + 0.587 * hex(c, 1) + 0.114 * hex(c, 2)) / 255;

function currentHour() {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

/** 해(6~18시)와 달(그 외)이 호를 그리며 지나간다 */
function bodyAt(hour: number) {
  const isDay = hour >= 6 && hour < 18;
  const p = isDay ? (hour - 6) / 12 : ((hour + 6) % 24) / 12;
  return {
    isDay,
    x: 22 + 156 * p,
    y: 30 - 22 * Math.sin(Math.PI * p),
  };
}

/** 주기가 200인 능선 (400까지 이어 그려 CSS 로 200 만큼 흘리면 끊김 없이 반복) */
function ridge(base: number, amps: number[], phases: number[], bottom: number) {
  let d = `M0 ${bottom}`;
  for (let x = 0; x <= 400; x += 4) {
    const y =
      base -
      amps.reduce(
        (s, a, k) =>
          s + a * Math.sin(((2 * Math.PI * x) / 200) * (k + 1) + phases[k]),
        0
      );
    d += ` L${x} ${y.toFixed(2)}`;
  }
  return `${d} L400 ${bottom} Z`;
}

const FAR_PATH = ridge(33, [5, 2.6, 1.2], [0.4, 1.9, 0.7], 50);
const HILL_PATH = ridge(41, [3, 1.5, 0.8], [2.2, 0.3, 1.1], 50);
const STARS = [
  [14, 8], [34, 18], [52, 6], [74, 14], [96, 5], [118, 17], [140, 9],
  [160, 4], [182, 15], [24, 26], [108, 24], [168, 25],
];

function Soldier({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 48)`}>
      <ellipse cx="0" cy="0.4" rx="6" ry="1" fill="currentColor" opacity="0.12" />
      <g className="mil-bob">
        <g transform="translate(0 -23)">
          <g className="mil-swing-b" opacity="0.5">
            <path d="M0 0 L0 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
        <g transform="translate(0 -13)">
          <g className="mil-swing-a" opacity="0.55">
            <path d="M0 0 L0 12" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M-1 12.6 L2.6 12.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        </g>
        <rect x="-7.4" y="-23.5" width="4.6" height="10.5" rx="1.8" fill="currentColor" opacity="0.6" />
        <path d="M-3.6 -24 Q0 -25.4 3.6 -24 L3.2 -12.6 Q0 -11.8 -3.2 -12.6 Z" fill="currentColor" opacity="0.95" />
        <circle cx="0.4" cy="-27.4" r="3.2" fill="currentColor" />
        <path d="M-3.1 -28.2 a3.5 3.3 0 0 1 7 0 L6.6 -28 L6.6 -27.2 L-3.1 -27.2 Z" fill="currentColor" />
        <g transform="translate(0 -13)">
          <g className="mil-swing-b">
            <path d="M0 0 L0 12" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M-1 12.6 L2.6 12.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        </g>
        <g transform="translate(0 -23)">
          <g className="mil-swing-a">
            <path d="M0 0 L0 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </g>
  );
}

function Dog({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 48)`}>
      <ellipse cx="1" cy="0.4" rx="8" ry="1" fill="currentColor" opacity="0.12" />
      <g className="mil-bob">
        <g transform="translate(-3.6 -6.6)">
          <g className="mil-swing-b" opacity="0.5">
            <path d="M0 0 L0 6.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </g>
        <g transform="translate(3.4 -6.6)">
          <g className="mil-swing-a" opacity="0.5">
            <path d="M0 0 L0 6.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </g>
        <g transform="translate(-6.4 -10)">
          <g className="mil-wag">
            <path d="M0 0 Q-2.6 -1 -3.4 -4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.8" />
          </g>
        </g>
        <ellipse cx="0" cy="-9.4" rx="6.6" ry="3.5" fill="currentColor" opacity="0.9" />
        <circle cx="7.4" cy="-12.6" r="2.8" fill="currentColor" />
        <ellipse cx="10.4" cy="-11.9" rx="2.1" ry="1.3" fill="currentColor" />
        <path d="M5.6 -14.2 L6.2 -17.2 L8.4 -14.8 Z" fill="currentColor" />
        <g transform="translate(-3.4 -6.6)">
          <g className="mil-swing-a">
            <path d="M0 0 L0 6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        </g>
        <g transform="translate(3.6 -6.6)">
          <g className="mil-swing-b">
            <path d="M0 0 L0 6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </g>
  );
}

export function MobileDiggingSoldiers() {
  // 서버·첫 렌더는 정오로 고정하고, 마운트 뒤에 실제 시각을 반영한다 (하이드레이션 불일치 방지)
  const [hour, setHour] = useState(12);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setHour(currentHour());
    setReady(true);
    const id = window.setInterval(() => setHour(currentHour()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const c = skyAt(hour);
  const body = bodyAt(hour);
  // 뒤 배경(언덕)이 밝으면 어두운 실루엣, 어두우면 밝은 실루엣. 반대색 테두리로 경계를 살린다
  const dark = lum(c.hill) >= 0.22;
  const ink = dark ? "#1f2433" : "#d3d9f0";
  const rim = dark ? "rgba(255,255,255,0.4)" : "rgba(8,12,30,0.55)";

  return (
    <div className="border-t border-[var(--lit-border)] p-3 md:p-4">
      <svg
        viewBox="0 0 200 56"
        className={`mx-auto block w-full max-w-md rounded-xl transition-opacity duration-500 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        style={{ color: ink }}
        role="img"
        aria-label="군복무 중인 청년들을 응원하며 길을 걷는 군인과 강아지"
      >
        <defs>
          <linearGradient id="mil-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={c.top} />
            <stop offset="1" stopColor={c.bot} />
          </linearGradient>
        </defs>
        <rect width="200" height="56" fill="url(#mil-sky)" />

        {STARS.map(([sx, sy], i) => (
          <circle
            key={i}
            cx={sx}
            cy={sy}
            r={i % 3 === 0 ? 0.7 : 0.5}
            fill="#fff"
            opacity={c.star * (i % 2 ? 0.55 : 0.9)}
          />
        ))}

        {body.isDay ? (
          <g>
            <circle cx={body.x} cy={body.y} r="8" fill="#fff4c2" opacity="0.28" />
            <circle cx={body.x} cy={body.y} r="4.2" fill="#fff4c2" />
          </g>
        ) : (
          <g>
            <circle cx={body.x} cy={body.y} r="7" fill="#e8ecff" opacity="0.12" />
            <circle cx={body.x} cy={body.y} r="3.6" fill="#e8ecff" />
            <circle cx={body.x + 1.4} cy={body.y - 0.6} r="3.1" fill={c.top} opacity="0.55" />
          </g>
        )}

        <g className="mil-scroll-far">
          <path d={FAR_PATH} fill={c.far} />
        </g>
        <g className="mil-scroll-hill">
          <path d={HILL_PATH} fill={c.hill} />
        </g>

        <rect y="48" width="200" height="8" fill={c.ground} />
        <g
          className="mil-scroll-road"
          stroke="currentColor"
          opacity="0.28"
          strokeWidth="0.8"
          strokeLinecap="round"
        >
          {Array.from({ length: 13 }, (_, i) => (
            <path key={i} d={`M${i * 20 + 3} 52.2h8`} />
          ))}
        </g>

        <g style={{ filter: `drop-shadow(0 0 0.7px ${rim})` }}>
          <Soldier x={62} />
          <Soldier x={84} />
          <Dog x={118} />
        </g>

        <g
          className="mil-scroll-tufts"
          stroke="currentColor"
          opacity="0.5"
          strokeWidth="0.9"
          strokeLinecap="round"
          fill="none"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <path
              key={i}
              d={`M${i * 50 + 12} 56 q0.4 -4 -1.2 -5.6 M${i * 50 + 14} 56 q0.2 -3.4 1.6 -4.6`}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
