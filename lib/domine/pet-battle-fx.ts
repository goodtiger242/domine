import type { Action } from "./battle/types";

export type BattleMoveFx = {
  motion: string;
  trail: string;
  elements: readonly string[];
  reaction: string;
  duration: number;
  suffix: string;
};

// Presentation only: no damage, status rolls or engine state changes here.
export const BATTLE_MOVE_FX: Readonly<Record<string, BattleMoveFx>> = {
  T01: { motion: "paw-push", trail: "paw-pop", elements: ["🐾"], reaction: "tap", duration: 550, suffix: "앞발로 툭!" },
  T03: { motion: "shoulder-bump", trail: "dust-cloud", elements: ["☁", "☁", "☁"], reaction: "recoil", duration: 750, suffix: "몸을 낮추고, 어깨로 쿵!" },
  T13: { motion: "side-step", trail: "side-tap", elements: ["·", "✦"], reaction: "tilt", duration: 650, suffix: "왼쪽, 오른쪽, 톡!" },
  T14: { motion: "tail-circle", trail: "half-orbit", elements: ["🐕", "🐕", "✧"], reaction: "turn", duration: 900, suffix: "꼬리 뒤로 쏙 돌아가요!" },
  T16: { motion: "toe-zigzag", trail: "zigzag-question", elements: ["streak", "streak", "❔"], reaction: "wobble", duration: 800, suffix: "이쪽일까, 저쪽일까?" },
  T18: { motion: "half-spin", trail: "spin-streak", elements: ["streak", "streak", "streak"], reaction: "recoil", duration: 850, suffix: "반 바퀴 돌아 자리를 쏙!" },
  T19: { motion: "side-slip", trail: "slip-ghost", elements: ["🐕", "🐕"], reaction: "none", duration: 700, suffix: "옆으로 슥, 잔상만 남아요!" },
  T21: { motion: "tail-balance", trail: "balance-spark", elements: ["〰", "✦", "✧"], reaction: "none", duration: 800, suffix: "꼬리를 세우고 균형을 잡아요!" },
  T25: { motion: "scent-follow", trail: "scent-wave", elements: ["wave", "wave", "wave"], reaction: "tap", duration: 850, suffix: "냄새선을 따라 쭉!" },
  T26: { motion: "paw-follow", trail: "four-paws", elements: ["🐾", "🐾", "🐾", "🐾"], reaction: "recoil", duration: 900, suffix: "하나, 둘, 셋, 넷!" },
  T28: { motion: "return-track", trail: "return-paws", elements: ["🐾", "🐾", "🐢"], reaction: "drag", duration: 950, suffix: "뒤에서 돌아오는 발자국!" },
  T31: { motion: "ear-scout", trail: "radar-rings", elements: ["👂", "ring", "ring"], reaction: "none", duration: 800, suffix: "귀 쫑긋, 주위를 살펴요!" },
  T34: { motion: "nose-focus", trail: "nose-light", elements: ["✧", "✦", "fx-buff"], reaction: "none", duration: 750, suffix: "코끝에 집중이 모여요!" },
  T37: { motion: "threshold-push", trail: "low-pressure", elements: ["streak", "☁"], reaction: "slide", duration: 1000, suffix: "낮은 자세로 꾸욱 밀어요!" },
  T43: { motion: "yard-guard", trail: "yard-shield", elements: ["fx-shield", "ring"], reaction: "none", duration: 850, suffix: "내 마당을 든든히 지켜요!" },
  T49: { motion: "eye-sway", trail: "eye-link", elements: ["streak", "✧", "💫"], reaction: "dizzy", duration: 800, suffix: "눈이 마주쳐 어질어질!" },
  T50: { motion: "happy-call", trail: "music-wave", elements: ["♪", "♫", "ring"], reaction: "bounce", duration: 800, suffix: "반가운 소리가 퍼져요!" },
  T51: { motion: "tail-wag", trail: "attention-tail", elements: ["〰", "〰", "❕"], reaction: "startle", duration: 700, suffix: "살랑살랑, 여기를 봐!" },
  T58: { motion: "kind-breath", trail: "breath-ring", elements: ["ring", "♡"], reaction: "none", duration: 1000, suffix: "부드럽게 함께 숨 쉬어요." },
  T60: { motion: "sit-rest", trail: "heart-heal", elements: ["♥", "♡", "fx-heal"], reaction: "none", duration: 1100, suffix: "곁에 앉아 힘을 되찾아요." },
  T61: { motion: "steady-steps", trail: "triple-tap", elements: ["✦", "✦", "✦"], reaction: "triple", duration: 900, suffix: "또박또박, 톡톡톡!" },
  T63: { motion: "heavy-stride", trail: "heavy-stamp", elements: ["🐾", "ring"], reaction: "squash", duration: 1000, suffix: "묵직한 한 걸음, 쿵!" },
  T65: { motion: "double-chase", trail: "chase-streak", elements: ["streak", "🐾"], reaction: "retreat", duration: 1050, suffix: "물러나도 한 번 더 따라가요!" },
  T67: { motion: "short-brace", trail: "brace-glow", elements: ["fx-shield", "✧"], reaction: "none", duration: 750, suffix: "웅크려 단단하게 버텨요!" },
  push: { motion: "light-nudge", trail: "little-pop", elements: ["·"], reaction: "tap", duration: 500, suffix: "가볍게 톡!" },
  rest: { motion: "energy-breath", trail: "energy-dots", elements: ["●", "●", "●", "●"], reaction: "none", duration: 1100, suffix: "천천히 숨 쉬며 기력을 채워요." },
};

export function battleFxId(action: Action): string | undefined {
  return action.kind === "move" ? action.moveId : action.kind === "push" || action.kind === "rest" ? action.kind : undefined;
}
