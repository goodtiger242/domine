import { LINES } from "./pet-lines";

export const TAP_REACTIONS = {
  hop: { line: "tap_hop", effect: "❤️", duration: 900 },
  tilt: { line: "tap_tilt", effect: "❓", duration: 1200 },
  spin: { line: "tap_spin", effect: "🎵", duration: 1000 },
  sniff: { line: "feed_picky1", effect: "", duration: 1100 },
  paw: { line: "train_paw", effect: "❤️", duration: 900 },
  shake: { line: "shake", effect: "", duration: 800 },
  yawn: { line: "idle_sleepy", effect: "", duration: 1400 },
  retreat: { line: "tap_retreat", effect: "❓", duration: 1200 },
  belly: { line: "pet_belly", effect: "❤️", duration: 1400 },
  hungry: { line: "idle_hungry", effect: "❓", duration: 1200 },
  tickle: { line: "tap_tickle", effect: "🎵", duration: 600 },
} as const;
export type TapReaction = keyof typeof TAP_REACTIONS;
export type TapPoint = { x: number; y: number };
export type TapNeeds = { fullness: number; mood: number; clean: number };
export const tapRegion = ({ x, y }: TapPoint) => y < 1 / 3 ? "head" : x < 1 / 3 ? "tail" : "body";
export const tapCount = (previous: { at: number; count: number }, now: number) => now - previous.at <= 2000 ? previous.count + 1 : 1;

export function chooseTap({ point, needs, count, recent, previousLine, seed }: {
  point: TapPoint; needs: TapNeeds; count: number; recent: readonly TapReaction[]; previousLine: string; seed: number;
}) {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const weights: Record<TapReaction, number> = { hop: 3, tilt: 3, spin: 2, sniff: 3, paw: 2, shake: 2, yawn: 1, retreat: 2, belly: .25, hungry: 0, tickle: 0 };
  const region = tapRegion(point);
  if (region === "head") { weights.tilt += 5; weights.sniff += 5; }
  if (region === "body") { weights.hop += 4; weights.shake += 4; }
  if (region === "tail") { weights.spin += 5; weights.hop += 4; }
  if (needs.mood >= 70) { weights.hop += 5; weights.spin += 5; }
  if (needs.mood < 40) { weights.tilt += 6; weights.yawn += 6; weights.hop = 1; weights.spin = 1; }
  if (needs.clean < 40) weights.shake += 10;
  if (needs.fullness < 40) weights.hungry = 12;
  if (needs.fullness >= 80) weights.yawn += 3;
  // 6번째 탭의 배 보이기가 직전 두 반응과 겹치지 않도록 미리 제외한다.
  if (count === 4 || count === 5) weights.belly = 0;
  const candidates = (Object.keys(weights) as TapReaction[]).filter((key) => !recent.slice(-2).includes(key) && weights[key] > 0);
  let choice: TapReaction = count === 3 ? "tickle" : count === 6 ? "belly" : candidates[0];
  if (count !== 3 && count !== 6) {
    let roll = random() * candidates.reduce((sum, key) => sum + weights[key], 0);
    for (const key of candidates) { roll -= weights[key]; if (roll < 0) { choice = key; break; } }
  }
  const reaction = TAP_REACTIONS[choice];
  const lines = LINES[reaction.line].filter((text) => text !== previousLine);
  return { kind: choice, text: lines[Math.floor(random() * lines.length)], effect: reaction.effect,
    duration: choice === "tilt" && needs.mood < 40 ? 1400 : reaction.duration,
    direction: random() < .5 ? -1 : 1, approach: point.x < .5 ? -1 : 1 };
}
