import type { PetMap, SceneCue } from "./pet-maps";
import { actorBounds, clampActor, clampBall, SAFE_ZONES, START_POINTS } from "./pet-geometry";
export type ScenePose = {
  x: number; y: number; dir: 1 | -1; dur: number; motion: string | null;
  ball: { x: number; y: number; dur: number } | null;
  hand: { x: number; y: number; dur: number; rot: number; stroke: boolean; e: string } | null;
  item: { e: string; x: number; y: number; dur: number; size: number } | null;
  bowl: number | null; fx: ("hearts" | "sparkle" | "drops" | "bubbles" | "spray")[];
  scroll: boolean; carry: "mouth" | "back" | "tail" | "head" | null;
};
export type SceneKeyframe = { at: number; pose: ScenePose; say?: string };
export type ScenePlan = { durationMs: number; keyframes: readonly SceneKeyframe[]; finalPose: ScenePose };
export function restingPose(map: PetMap): ScenePose {
  return { ...START_POINTS[map], dir: 1, dur: 0, motion: null, ball: null, hand: null, item: null, bowl: null, fx: [], scroll: false, carry: null };
}
export const SCENE_DURATION = { feed: 2400, treat: 2200, pet: 1800, play: 3500, walk: 4000, brush: 2600, bath: 3200, train: 3000, sleep: 1500, tap: 1100, priest: 1800, shop: 2000, map: 180 };
export function buildScenePlan(cue: SceneCue, context: { map: PetMap; width: number; ratio: number; origin?: { x: number; y: number } }, random: () => number): ScenePlan {
  const { map, width: w, ratio } = context, zone = SAFE_ZONES[map], h = w * ratio;
  const bound = actorBounds(w);
  const point = (x: number, y: number) => clampActor({ x, y }, bound, zone);
  const start = cue.action === "tap" && context.origin ? point(context.origin.x, context.origin.y) : point(zone.left + random() * (zone.right - zone.left), 82);
  let pose: ScenePose = { ...restingPose(map), ...start, dir: random() < .5 ? -1 : 1 };
  const frames: SceneKeyframe[] = [];
  const add = (at: number, patch: Partial<ScenePose>, say?: string) => {
    pose = { ...pose, ...patch };
    if (cue.action !== "sleep") pose = { ...pose, ...point(pose.x, pose.y) };
    if (pose.ball) pose.ball = { ...pose.ball, ...clampBall(pose.ball) };
    if (pose.item) pose.item = { ...pose.item, x: Math.min(150, Math.max(10, pose.item.x)), y: Math.min(82, Math.max(22, pose.item.y)) };
    frames.push({ at, pose: { ...pose }, say });
  };
  const prop = (e: string) => ({ e, x: start.x + pose.dir * w * .35, y: start.y - h * .65, dur: 250, size: 10 });
  const action = cue.action;
  if (action === "play") {
    const target = point(start.x < 80 ? zone.right : zone.left, 82);
    add(0, { ball: { x: start.x, y: start.y - h, dur: 0 }, motion: "pet-hop" }, "throw");
    add(150, { ball: { x: (start.x + target.x) / 2, y: Math.max(18, start.y - h - 25), dur: 400 } });
    add(550, { ball: { ...target, y: 79, dur: 400 } });
    add(950, { ...target, dir: target.x >= start.x ? 1 : -1, dur: 700, motion: "pet-trot" }, "run");
    add(1700, { ball: null, carry: "mouth", motion: "pet-hop" }, "carry_mouth");
    add(2200, { ...start, dir: start.x >= target.x ? 1 : -1, dur: 700, motion: "pet-trot" });
    add(3000, { carry: null, ball: { x: start.x + pose.dir * w * .5, y: 79, dur: 200 }, motion: null }, "drop_mouth");
  } else if (action === "walk") {
    add(0, { motion: "pet-trot", dur: 1600, ...point(zone.left, 80) }, "walk_start");
    add(1700, { ...point(zone.right, 82), dir: 1, dur: 1600 }, "walk_butterfly");
    add(3400, { motion: null }, "walk_end");
  } else if (action === "sleep") {
    add(0, { x: 132, y: 82, dir: 1, dur: 900, motion: "pet-trot" });
    add(950, { motion: "pet-sleep" });
  } else if (action === "feed" || action === "treat") {
    add(0, { bowl: action === "feed" ? clampBall({x:start.x + pose.dir * w * .6,y:80}).x : null, item: prop(action === "feed" ? "🍖" : "🦴") }, `${action}_start`);
    add(400, { motion: "pet-eatnod" });
    add(1700, { item: null, bowl: null, motion: null }, action === "feed" ? "feed_done" : "treat_eat");
  } else if (action === "pet" || action === "tap") {
    add(0, { motion: action === "tap" ? "pet-hop" : random() < .5 ? "pet-nuzzle" : "pet-wiggle", fx: ["hearts"], hand: action === "pet" ? { x: start.x, y: start.y - h, dur: 0, rot: 0, stroke: true, e: "🤚" } : null }, action === "pet" ? "pet_head" : "tap_hop");
  } else if (action === "brush") {
    add(0, { item: prop("🪮"), motion: "pet-wiggle" }, "brush_start");
    add(700, { item: { ...prop("🪮"), x: start.x - w * .3, dur: 500 } });
    add(1400, { item: prop("🪮") });
    add(2100, { item: null, fx: ["sparkle"] }, "brush_end");
  } else if (action === "bath") {
    add(0, { item: prop("🚿"), fx: ["drops", "bubbles"] }, "bath_shower");
    add(1700, { item: null, fx: ["spray"], motion: "pet-shake" }, "bath_shake");
    add(2600, { item: prop("towel"), fx: [] }, "bath_done");
  } else if (action === "train") {
    add(0, { motion: random() < .5 ? "pet-sit" : "pet-hop" }, "train_sit");
    add(1800, { item: prop("🦴"), fx: ["sparkle"] }, "train_reward");
  } else if (action === "shop") {
    add(0, { ...point([22, 60, 99, 138][cue.shop] ?? 80, 82), motion: "pet-trot", dur: 800 });
    add(850, { motion: null }, ["shop_pub", "shop_burger", "shop_restaurant", "shop_store"][cue.shop]);
  } else add(0, {});
  const finalPose = { ...restingPose(map), x: pose.x, y: pose.y, dir: pose.dir, ...(action === "sleep" ? { motion: "pet-sleep" } : {}) };
  return { durationMs: SCENE_DURATION[action], keyframes: frames, finalPose };
}
export function sampleScenePlan(plan: ScenePlan, elapsedMs: number): ScenePose {
  if (elapsedMs >= plan.durationMs) return plan.finalPose;
  let pose = plan.keyframes[0]?.pose ?? plan.finalPose;
  for (const frame of plan.keyframes) { if (frame.at > elapsedMs) break; pose = frame.pose; }
  return pose;
}
