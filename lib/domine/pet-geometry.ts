import { PET_MAPS, type PetMap } from "./pet-maps";
import type { Direction } from "./pet-world";
export type Point = { x: number; y: number };
// Depth scaling makes adult widths about 30% (Domi) and 24% (Mine) of the scene.
export const SCENE_SCALE = 2;
// The envelope includes the largest dog, clothes and the 1.35x foreground scale.
export function travelEdge(direction: Direction, entering = false) {
  const edge = entering ? ({ n: "s", s: "n", e: "w", w: "e" } as const)[direction] : direction;
  return {
    x: edge === "e" ? 220 : edge === "w" ? -60 : 80,
    y: edge === "n" ? -30 : edge === "s" ? 190 : 82,
    scale: edge === "n" ? .55 : edge === "s" ? 1.35 : 1,
    opacity: edge === "n" ? 0 : 1,
    dir: direction === "w" ? -1 : 1,
  };
}
export type SafeZone = { left: number; right: number; top: number; bottom: number };
export const SAFE_ZONES = {
  ...Object.fromEntries(PET_MAPS.map(({ id }) => [id, { left: 30, right: 138, top: 77, bottom: 86 } ])),
  church: { left: 32, right: 138, top: 77, bottom: 86 },
  field: { left: 8, right: 138, top: 76, bottom: 86 },
  street: { left: 30, right: 138, top: 77, bottom: 86 },
  park: { left: 8, right: 138, top: 77, bottom: 86 },
  home: { left: 8, right: 118, top: 78, bottom: 86 },
} as Record<PetMap, SafeZone>;
export const START_POINTS = { ...Object.fromEntries(PET_MAPS.map(({ id }) => [id, { x: 80, y: 82 }])), home: { x: 70, y: 82 } } as Record<PetMap, Point>;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
// Photo poses, tail, outfit and carried toy share a conservative union envelope.
export function actorBounds(width: number) { return { left: -width * .8 - 4, right: width * .8 + 4, top: -width * 1.15 - 5, bottom: 4 }; }
export function clampActor(p: Point, bounds: SafeZone, zone: SafeZone): Point {
  return { x: clamp(p.x, zone.left - bounds.left, zone.right - bounds.right), y: clamp(p.y, zone.top, zone.bottom - bounds.bottom) };
}
export function clampBall(p: Point, radius = 3.2): Point {
  return { x: clamp(p.x, radius + 3, 160 - radius - 3), y: clamp(p.y, 18, 84 - radius) };
}
export function buildBallPath(from: Point, to: Point, radius = 3.2) {
  const start = clampBall(from, radius), end = clampBall(to, radius);
  return { start, control: clampBall({ x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - 28 }, radius), end };
}
export function sampleBall(path: ReturnType<typeof buildBallPath>, t: number): Point {
  const u = clamp(t, 0, 1), v = 1 - u;
  return { x: v*v*path.start.x + 2*v*u*path.control.x + u*u*path.end.x, y: v*v*path.start.y + 2*v*u*path.control.y + u*u*path.end.y };
}
