"use client";

import { memo, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { bubblePosition } from "@/lib/domine/pet-bubble";
import type { PetAction, PetFace, PetStage } from "@/lib/domine/pet";
import { bodyAt, FAR_PATH, HILL_PATH, skyAt, STARS } from "@/lib/domine/sky";
import { ART, BALL, BOWL, preloadArt } from "@/lib/domine/pet-art";
import { line } from "@/lib/domine/pet-lines";
import { BACKGROUNDS, backgroundAt, POSES } from "@/lib/domine/pet-photos";
import { DOG_W, PetDog, RATIO } from "./PetDog";

/**
 * 도미가 노는 장면. 행동마다 여러 가지 연출(대본)이 있고 그중 하나를 무작위로 고른다.
 * 대본은 [시작 ms, 바뀔 값] 목록이며, 위치는 CSS transition 으로 부드럽게 움직인다.
 * 결과(수치)는 서버가 정하고, 여기서는 보이는 연출만 다룬다.
 */
type Dir = 1 | -1;
type Ball = { x: number; y: number; dur: number };
type Hand = { x: number; y: number; dur: number; rot: number; stroke: boolean; e: string };
type Item = { e: string; x: number; y: number; dur: number; size: number };
type Carry = "mouth" | "back" | "tail" | "head";
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
  carry: Carry | null;
};
type Patch = Partial<S> & { say?: string };
type Plan = { steps: [number, Patch][]; end: number };

const HOME: S = {
  x: 78, y: 82, dir: 1, dur: 600, motion: null,
  ball: null, hand: null, item: null, bowl: null, fx: [], scroll: false, carry: null,
};

/** 연출 전체의 속도 배율 (클수록 느리다) */
const SLOW = 1.6;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const depth = (y: number) => 0.84 + ((y - 76) / 13) * 0.2;

function makePlan(action: PetAction | "tap", w: number): Plan {
  const h = w * RATIO;

  if (action === "tap") {
    return {
      steps: pick<[number, Patch][]>([
        [[0, { motion: "pet-flip", say: line("tap_flip") }]],
        [[0, { motion: "pet-hop", say: line("tap_hop") }]],
        [[0, { say: line("tap_spin"), dir: -1, dur: 260 }], [280, { dir: 1, dur: 260 }], [560, { dir: -1, dur: 260 }], [840, { dir: 1, dur: 260 }]],
      ]),
      end: 1100,
    };
  }

  // 매번 도미가 무대의 무작위 자리로 가서(방향도 무작위) 시작한다
  const L = { x: rnd(30, 126), y: rnd(77, 88), d: pick<Dir>([1, -1]) };
  const k = depth(L.y);
  const T0 = 800;
  const P = (lx: number, ly: number) => ({ x: L.x + L.d * lx * k, y: L.y + ly * k });
  const lead: [number, Patch][] = [
    [0, { x: L.x, y: L.y, dir: L.d, dur: 700, motion: "pet-trot" }],
    [T0 - 60, { motion: null }],
  ];
  const mk = (steps: [number, Patch][], end: number): Plan => ({
    steps: [...lead, ...steps.map(([t, p]) => [t + T0, p] as [number, Patch])],
    end: end + T0,
  });
  const runMs = (dx: number) => Math.round(clamp(Math.abs(dx) * 18 + 300, 600, 1700));
  const sgn = (v: number): Dir => (v >= 0 ? 1 : -1);

  if (action === "play") {
    let tx = rnd(16, 144);
    for (let i = 0; i < 6 && Math.abs(tx - L.x) < 26; i++) tx = rnd(16, 144);
    const d = sgn(tx - L.x);
    const ty = rnd(76, 89);
    const apex = L.y - h - rnd(8, 34);
    const fly = Math.round(350 + Math.abs(tx - L.x) * 4);
    const roll = d * rnd(4, 12);
    const bounce = Math.random() < 0.5;
    const steps: [number, Patch][] = [
      [0, { dir: d, dur: 250, motion: "pet-hop", ball: { x: L.x + d * 8, y: L.y - h * 0.7, dur: 0 }, say: line("throw") }],
      [140, { ball: { x: (L.x + tx) / 2, y: apex, dur: fly / 2 } }],
      [140 + fly / 2, { ball: { x: tx, y: ty - 2, dur: fly / 2 } }],
    ];
    let t = 140 + fly + 80;
    if (bounce) {
      steps.push([t, { ball: { x: tx + roll, y: ty - 2, dur: 300 } }]);
      t += 320;
    }
    const bx = bounce ? tx + roll : tx;
    const gx = clamp(bx - d * w * 0.4 * depth(ty), 12, 148);

    const bring = (from: number, mode: Carry, atX: number, atY: number): [number, Patch][] => {
      const out: [number, Patch][] = [];
      let u = from;
      out.push([u, { ball: null, carry: mode, motion: "pet-hop", say: line(`carry_${mode}`) }]);
      u += 500;
      const rx = clamp(L.x + rnd(-16, 16), 14, 146);
      const ry = rnd(77, 88);
      const bd = sgn(rx - atX);
      const m = runMs(rx - atX);
      out.push([u, { x: rx, y: ry, dir: bd, dur: m, motion: "pet-trot" }]);
      u += m + 60;
      if (mode === "mouth") {
        out.push([u, { carry: null, ball: { x: rx + bd * w * 0.5, y: ry - 2, dur: 0 }, motion: "pet-hop", say: line("drop_mouth") }]);
        u += 900;
      } else if (mode === "back") {
        out.push([u, { motion: "pet-shake", say: line("shake") }]);
        out.push([u + 450, { carry: null, ball: { x: rx - bd * 5, y: ry - h * 0.9, dur: 0 } }]);
        out.push([u + 500, { ball: { x: rx - bd * 12, y: ry - 2, dur: 380 }, motion: "pet-hop", say: line("drop_back") }]);
        u += 1300;
      } else if (mode === "tail") {
        out.push([u, { motion: "pet-wiggle", say: line("drop_tail") }]);
        out.push([u + 550, { carry: null, ball: { x: rx - bd * w * 0.47, y: ry - h * 0.33, dur: 0 } }]);
        out.push([u + 570, { ball: { x: rx - bd * (w * 0.47 + rnd(14, 28)), y: ry - 2, dur: 520 }, motion: "pet-hop", say: line("drop_tail_end") }]);
        u += 1500;
      } else {
        out.push([u, { motion: "pet-nuzzle", say: line("drop_head") }]);
        out.push([u + 650, { carry: null, ball: { x: rx + bd * w * 0.3, y: ry - h * 0.98, dur: 0 } }]);
        out.push([u + 700, { ball: { x: rx + bd * w * 0.62, y: ry - 2, dur: 400 }, motion: "pet-hop", say: line("drop_mouth") }]);
        u += 1500;
      }
      out.push([u, { motion: null }]);
      return out;
    };
    const mode = pick<Carry>(["mouth", "mouth", "mouth", "back", "tail", "head"]);
    const r = Math.random();
    if (r < 0.7) {
      steps.push([t, { x: gx, y: ty, dir: d, dur: runMs(gx - L.x), motion: "pet-trot", say: line("run") }]);
      const arrive = t + runMs(gx - L.x) + 60;
      const got = bring(arrive, mode, gx, ty);
      steps.push(...got);
      return mk(steps, got[got.length - 1][0] + 400);
    }
    if (r < 0.8) {
      steps.push([t, { dir: (-d) as Dir, dur: 400, say: line("ignore") }]);
      steps.push([t + 700, { motion: "pet-lie" }]);
      steps.push([t + 2000, { ball: null, motion: null }]);
      return mk(steps, t + 2500);
    }
    if (r < 0.9) {
      const edge = d > 0 ? 154 : 6;
      steps.push([t, { x: gx, y: ty, dir: d, dur: runMs(gx - L.x), motion: "pet-trot" }]);
      const a = t + runMs(gx - L.x) + 60;
      steps.push([a, { ball: null, say: line("steal") }]);
      steps.push([a + 50, { x: edge, dur: 800 }]);
      steps.push([a + 950, { dir: (-d) as Dir, x: clamp(L.x + rnd(-20, 20), 14, 146), y: rnd(77, 88), dur: 1100, say: line("steal_end") }]);
      return mk(steps, a + 2400);
    }
    const t2 = clamp(bx + d * rnd(18, 32), 16, 144);
    steps.push([t, { x: gx, y: ty, dir: d, dur: runMs(gx - L.x), motion: "pet-trot", say: line("run") }]);
    const a2 = t + runMs(gx - L.x);
    steps.push([a2 - 200, { ball: { x: t2, y: ty - 2, dur: 450 }, say: line("fumble") }]);
    const g2 = clamp(t2 - d * w * 0.4, 12, 148);
    steps.push([a2 + 50, { x: g2, dur: 600 }]);
    const got = bring(a2 + 700, mode, g2, ty);
    steps.push(...got);
    return mk(steps, got[got.length - 1][0] + 400);
  }

  if (action === "pet") {
    const spots = {
      head: { lx: 0.36, ly: -0.95, m: "pet-nuzzle", say: "pet_head" },
      back: { lx: 0, ly: -0.66, m: "pet-wiggle", say: "pet_back" },
      rump: { lx: -0.38, ly: -0.6, m: "pet-wiggle", say: "pet_rump" },
      chin: { lx: 0.44, ly: -0.45, m: "pet-nuzzle", say: "pet_chin" },
      belly: { lx: 0, ly: -0.18, m: "pet-roll", say: "pet_belly" },
    };
    const order = (["head", "back", "rump", "chin", "belly"] as const).slice().sort(() => Math.random() - 0.5);
    const count = Math.random() < 0.45 ? 2 : 1;
    const emoji = pick(["🤚", "✋", "🖐️"]);
    const steps: [number, Patch][] = [];
    let t = 0;
    for (const key of order.slice(0, count)) {
      const sp = spots[key];
      const p = P(w * sp.lx, h * sp.ly);
      const hand = (x: number, y: number, dur: number, stroke: boolean): Hand => ({ x, y, dur, rot: 0, stroke, e: emoji });
      const lead2 = key === "belly" ? 900 : 120;
      if (key === "belly") steps.push([t, { motion: sp.m }]);
      steps.push([t + lead2 - 100, { hand: hand(p.x + 8, p.y - 26, 0, false) }]);
      steps.push([t + lead2, { hand: hand(p.x, p.y - 4, 380, false) }]);
      steps.push([t + lead2 + 400, { hand: hand(p.x, p.y - 4, 0, true), motion: sp.m, fx: ["hearts"], say: line(sp.say) }]);
      steps.push([t + lead2 + 1500, { hand: hand(p.x + 8, p.y - 26, 400, false), fx: [] }]);
      t += lead2 + 1800;
    }
    steps.push([t, { hand: null, motion: null }]);
    return mk(steps, t + 250);
  }

  if (action === "feed") {
    const food = pick(["🍖", "🍗", "🥩", "🥓", "🍚", "🥕", "🐟"]);
    const variant = pick(["near", "near", "far", "picky", "spill"] as const);
    const bx = variant === "far" ? clamp(L.x + L.d * rnd(34, 58), 14, 146) : clamp(L.x + L.d * w * 0.62 * k, 14, 146);
    const gx = variant === "far" ? clamp(bx - L.d * w * 0.4 * k, 12, 148) : L.x;
    const run = variant === "far" ? runMs(gx - L.x) : 0;
    const fall: [number, Patch][] =
      variant === "spill"
        ? [
            [0, { item: { e: food, x: bx, y: L.y - 40, dur: 0, size: 10 }, say: line("feed_spill") }],
            [120, { item: { e: food, x: bx, y: L.y - 2, dur: 420, size: 10 } }],
          ]
        : [
            [0, { bowl: bx, item: { e: food, x: bx, y: L.y - 34, dur: 0, size: 10 }, say: line("feed_start") }],
            [150, { item: { e: food, x: bx, y: L.y - 9, dur: 380, size: 10 } }],
          ];
    const go: [number, Patch][] = run ? [[650, { x: gx, dir: L.d, dur: run, motion: "pet-trot" }]] : [];
    const e0 = 650 + run + (run ? 60 : 0);
    if (variant === "picky") {
      return mk([...fall,
        [e0, { dir: (-L.d) as Dir, dur: 300, motion: "pet-shake", say: line("feed_picky1") }],
        [e0 + 800, { dir: L.d, dur: 300, motion: "pet-eatnod", say: line("feed_picky2") }],
        [e0 + 2400, { item: null, bowl: null, motion: null, say: line("feed_done") }]], e0 + 2800);
    }
    return mk([...fall, ...go,
      [e0, { motion: "pet-eatnod" }],
      [e0 + 1700, { item: null, bowl: null, motion: null, say: line("feed_done") }]], e0 + 2200);
  }

  if (action === "treat") {
    const e = pick(["🦴", "🍪", "🥓", "🍩", "🧀"]);
    const variant = pick(["catch", "sit", "tease", "fetch"] as const);
    const ix = P(w * 0.3, 0).x;
    if (variant === "catch") {
      return mk([
        [0, { item: { e, x: ix, y: L.y - h - 22, dur: 0, size: 10 }, say: line("treat_start") }],
        [100, { item: { e, x: ix, y: L.y - h * 0.75, dur: 450, size: 10 }, motion: "pet-hop" }],
        [650, { item: null, say: line("treat_catch") }],
        [1300, { motion: null }]], 1700);
    }
    if (variant === "sit") {
      return mk([
        [0, { item: { e, x: ix, y: L.y - h - 22, dur: 0, size: 10 }, say: line("treat_start") }],
        [100, { item: { e, x: ix, y: L.y - 3, dur: 520, size: 10 } }],
        [700, { motion: "pet-sit", say: line("treat_sit") }],
        [1500, { item: null, motion: "pet-eatnod", say: line("treat_eat") }],
        [2500, { motion: null }]], 2800);
    }
    if (variant === "tease") {
      const hy = L.y - h - 14;
      return mk([
        [0, { item: { e, x: ix, y: hy, dur: 0, size: 10 }, say: line("treat_tease") }],
        [200, { item: { e, x: ix, y: hy - 6, dur: 300, size: 10 }, motion: "pet-hop", say: line("treat_jump") }],
        [900, { item: { e, x: ix, y: hy + 2, dur: 300, size: 10 }, say: line("treat_miss") }],
        [1500, { item: { e, x: ix, y: L.y - h * 0.75, dur: 300, size: 10 }, say: line("treat_again") }],
        [1900, { item: null, say: line("treat_catch") }],
        [2500, { motion: null }]], 2800);
    }
    const tx = clamp(L.x + L.d * rnd(26, 56), 14, 146);
    const ty = rnd(77, 88);
    const gx = clamp(tx - L.d * w * 0.4, 12, 148);
    const m = runMs(gx - L.x);
    return mk([
      [0, { item: { e, x: L.x + L.d * 6, y: L.y - h * 0.7, dur: 0, size: 10 }, say: line("treat_throw") }],
      [100, { item: { e, x: (L.x + tx) / 2, y: L.y - h - 14, dur: 350, size: 10 } }],
      [450, { item: { e, x: tx, y: ty - 2, dur: 350, size: 10 } }],
      [850, { x: gx, y: ty, dur: m, motion: "pet-trot", say: line("treat_fetch") }],
      [850 + m + 60, { item: null, motion: "pet-eatnod", say: line("treat_eat") }],
      [850 + m + 1500, { motion: null }]], 850 + m + 1800);
  }

  if (action === "brush") {
    const ly = h * -0.68;
    const base = [-0.38, -0.12, 0.14, 0.36];
    const passes = 2 + Math.floor(Math.random() * 3);
    const flip = Math.random() < 0.5;
    const xs: number[] = [];
    for (let i = 0; i < passes; i++) {
      const seq = (i % 2 === 0) !== flip ? base : [...base].reverse();
      xs.push(...seq);
    }
    const steps: [number, Patch][] = [[0, { motion: "pet-wiggle", say: line("brush_start") }]];
    xs.forEach((lx, i) => {
      const p = P(w * lx, ly);
      steps.push([300 + i * 240, { item: { e: "🪮", x: p.x, y: p.y - 3, dur: i === 0 ? 0 : 220, size: 12 } }]);
    });
    const end = 300 + xs.length * 240;
    steps.push([end, { item: null, fx: ["sparkle"], motion: null, say: line("brush_end") }]);
    return mk(steps, end + 900);
  }

  if (action === "bath") {
    const variant = pick(["shower", "bucket", "soap"] as const);
    const top = L.y - h - 8;
    if (variant === "soap") {
      return mk([
        [0, { item: { e: "🧴", x: P(0, 0).x, y: top, dur: 0, size: 13 }, say: line("bath_soap") }],
        [500, { item: { e: "sponge", x: P(-w * 0.2, 0).x, y: L.y - h * 0.62, dur: 0, size: 9 }, fx: ["bubbles"], motion: "pet-wiggle", say: line("bath_foam") }],
        [900, { item: { e: "sponge", x: P(w * 0.2, 0).x, y: L.y - h * 0.62, dur: 380, size: 9 } }],
        [1300, { item: { e: "sponge", x: P(-w * 0.15, 0).x, y: L.y - h * 0.6, dur: 380, size: 9 } }],
        [1700, { item: { e: "🚿", x: P(0, 0).x, y: top - 2, dur: 0, size: 15 }, fx: ["drops", "bubbles"], motion: null, say: line("bath_rinse") }],
        [2800, { item: null, fx: ["spray"], motion: "pet-shake", say: line("bath_shake") }],
        [3700, { fx: [], motion: "pet-wiggle", item: { e: "towel", x: P(0, 0).x, y: L.y - h * 0.72, dur: 0, size: 12 }, say: line("bath_done") }],
        [4500, { item: null, motion: null }]], 4800);
    }
    const bucket = variant === "bucket";
    return mk([
      [0, { item: { e: bucket ? "🪣" : "🚿", x: P(0, 0).x - L.d * 6, y: top - 2, dur: 0, size: 15 }, say: line(bucket ? "bath_bucket" : "bath_shower") }],
      [500, { fx: ["drops"] }],
      [1500, { fx: ["drops", "bubbles"], say: line("bath_foam") }],
      [2400, { item: null, fx: ["spray"], motion: "pet-shake", say: line("bath_shake") }],
      [3300, { fx: [], motion: "pet-wiggle", item: { e: "towel", x: P(0, 0).x, y: L.y - h * 0.72, dur: 0, size: 12 }, say: line("bath_done") }],
      [4100, { item: null, motion: null }]], 4400);
  }

  if (action === "train") {
    const k2 = pick(["sit", "paw", "spin", "roll", "jump", "bow", "dead"] as const);
    const top = L.y - h - 8;
    const bone = (t: number): [number, Patch] => [t, { hand: null, item: { e: "🦴", x: P(w * 0.4, 0).x, y: L.y - h * 0.6, dur: 0, size: 9 }, say: line("train_reward") }];
    if (k2 === "sit") {
      return mk([
        [0, { hand: { x: P(w * 0.3, 0).x, y: top, dur: 0, rot: 0, stroke: false, e: "☝️" }, say: line("train_sit") }],
        [400, { motion: "pet-sit" }], bone(1500), [2100, { item: null, motion: null }]], 2600);
    }
    if (k2 === "paw") {
      const p = P(w * 0.66, h * -0.3);
      return mk([
        [0, { hand: { x: p.x + L.d * 14, y: p.y, dur: 0, rot: 0, stroke: false, e: "✋" }, say: line("train_paw") }],
        [300, { hand: { x: p.x, y: p.y, dur: 300, rot: 0, stroke: false, e: "✋" }, motion: "pet-hop" }],
        [900, { hand: { x: p.x, y: p.y, dur: 0, rot: 0, stroke: true, e: "✋" }, motion: "pet-wiggle" }],
        bone(1900), [2500, { item: null, motion: null }]], 3000);
    }
    if (k2 === "spin") {
      return mk([
        [0, { say: line("train_spin") }],
        [150, { dir: (-L.d) as Dir, dur: 280 }], [550, { dir: L.d, dur: 280 }],
        [950, { dir: (-L.d) as Dir, dur: 280 }], [1350, { dir: L.d, dur: 280 }],
        bone(1750), [2350, { item: null }]], 2800);
    }
    if (k2 === "roll") {
      return mk([[0, { say: line("train_roll") }], [300, { motion: "pet-flip" }], [1300, { motion: null }], bone(1500), [2100, { item: null }]], 2600);
    }
    if (k2 === "jump") {
      return mk([[0, { say: line("train_jump") }], [250, { motion: "pet-hop" }], [1500, { motion: null }], bone(1700), [2300, { item: null }]], 2700);
    }
    if (k2 === "bow") {
      return mk([[0, { say: line("train_bow") }], [250, { motion: "pet-eatnod" }], [1700, { motion: null }], bone(1900), [2500, { item: null }]], 2900);
    }
    return mk([[0, { say: line("train_dead") }], [300, { motion: "pet-roll" }], [2800, { motion: null, say: line("train_alive") }], bone(3100), [3700, { item: null }]], 4100);
  }

  // walk: 가끔 나비나 새를 만난다
  const bug = pick(["🦋", "🐦", null, null]);
  const steps: [number, Patch][] = [
    [0, { scroll: true, motion: "pet-trot", say: line("walk_start") }],
    [1400, { say: line("walk_mid1") }],
    [2700, { say: line("walk_mid2") }],
  ];
  if (bug) {
    const by = rnd(44, 66);
    steps.push([700, { item: { e: bug, x: -8, y: by, dur: 0, size: 9 } }]);
    steps.push([760, { item: { e: bug, x: 168, y: by - 8, dur: 3000, size: 9 } }]);
    steps.push([1200, { motion: "pet-hop", say: line(bug === "🦋" ? "walk_butterfly" : "walk_bird") }]);
    steps.push([1900, { motion: "pet-trot" }]);
    steps.push([3800, { item: null }]);
  }
  return mk(steps, 4100);
}

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

function Ball() {
  return <image href={BALL} x={-3.2} y={-3.2} width={6.4} height={6.4} />;
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
  /** 연출이 끝났을 때 */
  onDone?: () => void;
  bubble?: string;
};

function SpeechBubble({ text, x, y, duration }: { text: string; x: number; y: number; duration: number }) {
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
      <p ref={bubble} className="pet-speech" role="status" aria-label="도미의 말" aria-atomic="true"
        style={{ visibility: "hidden" }}>
        <span key={text} className="pet-speech-text">{text}</span>
        <span aria-hidden="true" className="pet-speech-tail" />
      </p>
    </div>
  );
}

export const PetScene = memo(function PetScene({ stage, face, light, hour, collar, cue, onSay, onDone, bubble }: Props) {
  const shadowId = useId();
  const [s, setS] = useState<S>(HOME);
  const timers = useRef<number[]>([]);
  const latest = useRef({ stage, onSay, onDone });
  latest.current = { stage, onSay, onDone };
  const running = useRef(false);
  const period = backgroundAt(hour);
  const [photos, setPhotos] = useState<Record<string, boolean>>({});
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const images: HTMLImageElement[] = [];
    const load = (src: string, current = false) => {
      const img = new Image();
      images.push(img);
      img.decoding = "async";
      img.onload = () => {
        if (cancelled) return;
        setPhotos((prev) => ({ ...prev, [src]: true }));
        if (current) window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          if (!cancelled) setShown(src);
        }));
      };
      img.onerror = () => { if (current && !cancelled) setShown(null); };
      img.src = src;
    };
    load(BACKGROUNDS[period], true);
    const idle = () => {
      Object.values(BACKGROUNDS).filter((src) => src !== BACKGROUNDS[period]).forEach((src) => load(src));
      Object.values(POSES).forEach(({ src }) => load(src));
    };
    const supportsIdle = typeof window.requestIdleCallback === "function";
    const id = supportsIdle
      ? window.requestIdleCallback(idle, { timeout: 4000 })
      : window.setTimeout(idle, 2500);
    return () => {
      cancelled = true;
      images.forEach((img) => { img.onload = null; img.onerror = null; });
      if (supportsIdle) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, [period]);

  function run(plan: Plan) {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    running.current = true;
    plan.steps.forEach(([t, patch]) => {
      timers.current.push(
        window.setTimeout(() => {
          const { say, ...rest } = patch;
          if (say) latest.current.onSay(say);
          setS((prev) => ({ ...prev, ...rest }));
        }, t * SLOW)
      );
    });
    timers.current.push(
      window.setTimeout(() => {
        setS((prev) => ({ ...HOME, x: prev.x, y: prev.y, dir: prev.dir, dur: 400 }));
        running.current = false;
        latest.current.onDone?.();
      }, plan.end * SLOW)
    );
  }

  useEffect(() => {
    if (cue) run(makePlan(cue.action, DOG_W[latest.current.stage]));
    // cue.id 가 바뀔 때만 새 연출을 시작한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.id]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  useEffect(() => preloadArt(), []);

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
    <div className="pet-scene relative h-full w-full">
    <svg
      viewBox="0 6 160 90"
      className="block h-full w-full"
      role="img"
      aria-label={`${stage === "baby" ? "아기" : stage === "young" ? "어린" : "다 큰"} 강아지 도미`}
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
        {Object.values(BACKGROUNDS).filter((src) => photos[src]).map((src) => (
          <image key={src} href={src} x="-10" y="6" width="180" height="90"
            preserveAspectRatio="xMidYMid slice" className="pet-photo-fade"
            style={{ opacity: shown === src ? 1 : 0 }} />
        ))}
      </g>

      {s.bowl !== null ? (
        <g transform={`translate(${s.bowl} ${s.y + 1}) scale(${sc})`} className="fade-in" style={{ filter: `brightness(${light})` }}>
          <ellipse cy="1" rx="13" ry="2.5" fill={`url(#${shadowId})`} />
          <image href={BOWL} x={-12} y={-13} width={24} height={14} />
        </g>
      ) : null}

      {/* 도미 (가로 위치·방향·깊이는 transition 으로 부드럽게) */}
      <g style={move(s.x, s.y, s.dur, ` scale(${s.dir * sc}, ${sc})`)}>
        <ellipse cx="0" cy="1.8" rx={w * 0.5} ry="5" fill={`url(#${shadowId})`} />
        <ellipse cx="0" cy="1" rx={w * 0.3} ry="1.5" fill={`url(#${shadowId})`} />
        {s.carry ? (
          <g
            transform={`translate(${{ mouth: w * 0.47, back: 0, tail: -w * 0.47, head: w * 0.34 }[s.carry]} ${{ mouth: -h * 0.76, back: -h * 0.8, tail: -h * 0.33, head: -h * 1.0 }[s.carry]})`}
          >
            <Ball />
          </g>
        ) : null}
        <PetDog
          stage={stage}
          face={face}
          motion={s.motion}
          light={light}
          collar={collar}
          photos={photos}
          onTap={() => {
            // 한 연출이 끝나기 전에는 다른 연출을 시작하지 않는다
            if (!running.current) run(makePlan("tap", w));
          }}
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
      <g style={{ filter: `brightness(${light}) drop-shadow(0 0.5px 0.5px #17231d40)` }}>
      {s.ball ? (
        <g style={move(s.ball.x, s.ball.y, s.ball.dur)}>
          <Ball />
        </g>
      ) : null}
      {s.item ? (
        <g style={move(s.item.x, s.item.y, s.item.dur)}>
          <Prop e={s.item.e} size={s.item.size} />
        </g>
      ) : null}
      {s.hand ? (
        <g style={move(s.hand.x, s.hand.y, s.hand.dur)} pointerEvents="none">
          <g className={s.hand.stroke ? "pet-stroke" : undefined}>
            <Prop e={s.hand.e} size={15} />
          </g>
        </g>
      ) : null}
      </g>
    </svg>
    {bubble && <SpeechBubble text={bubble} x={s.x + s.dir * w * sc * 0.25} y={s.y - h * sc} duration={s.dur} />}
    </div>
  );
});
