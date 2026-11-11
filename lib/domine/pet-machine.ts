import { DEFAULT_CELL } from "./pet-world";
export type GameMachine = {
  visual: "idle" | "acting" | "loading-map" | "switching-map" | "sleeping" | "paused";
  command: "idle" | "pending" | "uncertain";
  epoch: number; sceneId: number; operationId: string | null;
  startedAt: number | null; deadlineAt: number | null;
  committedMap: string; pendingMap: string | null;
};
export const initialMachine: GameMachine = {
  visual: "idle", command: "idle", epoch: 0, sceneId: 0, operationId: null,
  startedAt: null, deadlineAt: null, committedMap: DEFAULT_CELL, pendingMap: null,
};
export type GameEvent =
  | { type: "act"; id: number; now: number; duration: number }
  | { type: "done"; id: number; sleep?: boolean }
  | { type: "request"; id: string }
  | { type: "settled" | "uncertain"; id: string }
  | { type: "map"; map: string; id: number }
  | { type: "map-ready"; id: number }
  | { type: "map-cancel"; id: number }
  | { type: "pause" | "resume" | "reset" };
export const visualLocked = (s: GameMachine) => !["idle", "sleeping"].includes(s.visual);
export function gameReducer(s: GameMachine, e: GameEvent): GameMachine {
  switch (e.type) {
    case "map-cancel": return e.id !== s.sceneId || !["loading-map", "switching-map"].includes(s.visual) ? s : { ...s, visual: "idle", pendingMap: null, deadlineAt: null };
    case "act": return visualLocked(s) ? s : { ...s, visual: "acting", sceneId: e.id, startedAt: e.now, deadlineAt: e.now + e.duration + 500 };
    case "done": return e.id !== s.sceneId || !["acting", "switching-map"].includes(s.visual) ? s : { ...s, visual: e.sleep ? "sleeping" : "idle", deadlineAt: null };
    case "request": return s.command !== "idle" && s.operationId !== e.id ? s : { ...s, command: "pending", operationId: e.id };
    case "settled": return s.operationId !== e.id ? s : { ...s, command: "idle", operationId: null };
    case "uncertain": return s.operationId !== e.id ? s : { ...s, command: "uncertain" };
    case "map": return visualLocked(s) ? s : { ...s, visual: "loading-map", pendingMap: e.map, sceneId: e.id };
    case "map-ready": return s.visual !== "loading-map" || s.sceneId !== e.id || !s.pendingMap ? s : { ...s, visual: "switching-map", committedMap: s.pendingMap, pendingMap: null };
    case "pause": return { ...s, visual: "paused", pendingMap: null, deadlineAt: null, epoch: s.epoch + 1, command: s.command === "pending" ? "uncertain" : s.command };
    case "resume": return { ...s, visual: "idle" };
    case "reset": return { ...initialMachine, committedMap: s.committedMap, epoch: s.epoch + 1, sceneId: s.sceneId + 1 };
  }
}
