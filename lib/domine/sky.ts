/** 현재 시각에 따른 하늘·산·땅 색 (행군 장면과 게임 화면이 같이 쓴다) */

export type Sky = {
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

export function skyAt(hour: number): Omit<Sky, "h"> {
  const i = SKY.findIndex(
    (k, idx) => idx < SKY.length - 1 && hour >= k.h && hour <= SKY[idx + 1].h
  );
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

export const lum = (c: string) =>
  (0.299 * hex(c, 0) + 0.587 * hex(c, 1) + 0.114 * hex(c, 2)) / 255;

export function currentHour() {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

/** 해(6~18시)와 달(그 외)이 호를 그리며 지나간다 */
export function bodyAt(hour: number) {
  const isDay = hour >= 6 && hour < 18;
  const p = isDay ? (hour - 6) / 12 : ((hour + 6) % 24) / 12;
  return {
    isDay,
    x: 22 + 156 * p,
    y: 30 - 22 * Math.sin(Math.PI * p),
  };
}

/** 주기가 200인 능선 (400까지 이어 그려 CSS 로 200 만큼 흘리면 끊김 없이 반복) */
export function ridge(base: number, amps: number[], phases: number[], bottom: number) {
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

export const FAR_PATH = ridge(33, [5, 2.6, 1.2], [0.4, 1.9, 0.7], 50);
export const HILL_PATH = ridge(41, [3, 1.5, 0.8], [2.2, 0.3, 1.1], 50);
export const STARS = [
  [14, 8], [34, 18], [52, 6], [74, 14], [96, 5], [118, 17], [140, 9],
  [160, 4], [182, 15], [24, 26], [108, 24], [168, 25],
];
