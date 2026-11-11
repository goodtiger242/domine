import type { PetMap, SceneCue } from "./pet-maps";
import { actorBounds, clampActor, clampBall, SCENE_SCALE, SAFE_ZONES, START_POINTS } from "./pet-geometry";
import type { IdleAction } from "./pet-idle";
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
export function buildScenePlan(cue: SceneCue, context: { map: PetMap; width: number; ratio: number; propScale?: number; origin?: { x: number; y: number } }, random: () => number): ScenePlan {
  const { map, width: w, ratio } = context, zone = SAFE_ZONES[map], h = w * ratio;
  const scale = context.propScale ?? SCENE_SCALE;
  const bound = actorBounds(w);
  const point = (x: number, y: number) => clampActor({ x, y }, bound, zone);
  const start = cue.action === "tap" && context.origin ? point(context.origin.x, context.origin.y) : point(zone.left + random() * (zone.right - zone.left), 82);
  let pose: ScenePose = { ...restingPose(map), ...start, dir: random() < .5 ? -1 : 1 };
  const frames: SceneKeyframe[] = [];
  const add = (at: number, patch: Partial<ScenePose>, say?: string) => {
    pose = { ...pose, ...patch };
    pose = { ...pose, ...point(pose.x, pose.y) };
    if (pose.ball) pose.ball = { ...pose.ball, ...clampBall(pose.ball, 3.2 * scale) };
    if (pose.item) {
      const size = pose.item.size * scale * 1.7;
      pose.item = { ...pose.item, x: Math.min(157 - size / 2, Math.max(3 + size / 2, pose.item.x)), y: Math.min(90 - size / 4, Math.max(9 + size * .75, pose.item.y)) };
    }
    if (pose.hand) {
      const size = 15 * scale * 1.7;
      pose.hand = { ...pose.hand, x: Math.min(157 - size / 2, Math.max(3 + size / 2, pose.hand.x)), y: Math.min(90 - size / 4, Math.max(9 + size * .75, pose.hand.y)) };
    }
    if (pose.bowl !== null) pose.bowl = clampBall({ x: pose.bowl, y: pose.y }, 12 * scale * .7).x;
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
    add(0, { x: map === "home" ? 76 : start.x, y: 82, dir: 1, dur: 900, motion: "pet-trot" });
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

export function buildIdlePlan(action: IdleAction, context: { map: PetMap; width: number; propScale?: number }): ScenePlan {
  const { map, width: w } = context, scale = context.propScale ?? SCENE_SCALE;
  const origin = restingPose(map), zone = SAFE_ZONES[map];
  const target = clampActor({ x: origin.x + 18, y: origin.y }, actorBounds(w), zone);
  const bowl = clampBall({ x: target.x + w * .65, y: target.y }, 12 * scale * .7).x;
  let pose = origin;
  const keyframes: SceneKeyframe[] = [];
  const add = (at: number, patch: Partial<ScenePose>, say?: string) => {
    pose = { ...pose, ...patch };
    pose = { ...pose, ...clampActor(pose, actorBounds(w), zone) };
    if (pose.ball) pose.ball = { ...pose.ball, ...clampBall(pose.ball, 3.2 * scale) };
    keyframes.push({ at, pose, say });
  };
  if (action === "food" || action === "snack") {
    add(0, { ...target, bowl, dur: 650, motion: "pet-trot" });
    add(650, { motion: "pet-idle-tilt" }, action === "food" ? "idle_hungry" : "routine_snack");
  } else if (action === "fetch") {
    add(0, { ...target, ball: { x: target.x + w * .45, y: 79, dur: 0 }, motion: "pet-trot", dur: 650 });
    add(650, { ball: null, carry: "mouth", x: origin.x, dir: -1, dur: 750 }, "routine_fetch");
    add(1400, { motion: "pet-idle-wag" });
  } else if (action === "roll") {
    add(0, { motion: "pet-hop", ball: { x: origin.x + w * .5, y: 79, dur: 0 } });
    add(350, { ball: { x: target.x + w * .5, y: 79, dur: 1000 }, motion: "pet-idle-tilt" });
  } else {
    const motions = { scratch: "pet-idle-scratch", shake: "pet-shake", company: "pet-idle-company", hop: "pet-hop", wag: "pet-idle-wag", tilt: "pet-idle-tilt", stretch: "pet-idle-stretch", yawn: "pet-idle-yawn", nap: "pet-lie", sleepwalk: "pet-idle-sleepwalk", dream: "pet-lie" };
    const speech: Partial<Record<IdleAction, string>> = { scratch: "idle_dirty", shake: "idle_dirty", company: "routine_company", stretch: "routine_stretch", yawn: "idle_sleepy", nap: "routine_nap", sleepwalk: "routine_dream", dream: "routine_dream" };
    add(0, { motion: motions[action] }, speech[action]);
  }
  add(2100, { ...origin, dur: 500 });
  return { durationMs: 2700, keyframes, finalPose: origin };
}
