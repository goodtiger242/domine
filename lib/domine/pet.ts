/** UI에 행동을 추가할 때는 이 표에 한 줄만 추가한다. 서버 지원 여부는 cooldown으로 확인한다. */
export const PET_ACTION_TABLE = {
  feed: { category: "먹이", label: "밥주기", icon: "🍖", done: "밥을 줬어요", ms: 2400 },
  treat: { category: "먹이", label: "간식", icon: "🦴", done: "간식을 줬어요", ms: 2200 },
  pet: { category: "돌봄", label: "쓰다듬기", icon: "🤚", done: "쓰다듬어 줬어요", ms: 2400 },
  play: { category: "놀이", label: "공놀이", icon: "🎾", done: "공놀이를 했어요", ms: 3200 },
  walk: { category: "놀이", label: "산책", icon: "🦮", done: "산책을 시켰어요", ms: 4000 },
  brush: { category: "돌봄", label: "빗질", icon: "🪮", done: "빗질을 해 줬어요", ms: 2600 },
  bath: { category: "돌봄", label: "목욕", icon: "🛁", done: "목욕을 시켰어요", ms: 3200 },
  train: { category: "놀이", label: "훈련", icon: "🎓", done: "훈련을 시켰어요", ms: 3000 },
} as const;
export type PetAction = keyof typeof PET_ACTION_TABLE;
export const PET_ACTIONS = Object.keys(PET_ACTION_TABLE) as PetAction[];
export const PET_CATEGORIES = ["먹이", "돌봄", "놀이"] as const;
export type PetCategory = typeof PET_CATEGORIES[number];

export function availableActionGroups(avail: PetAction[]) {
  return PET_CATEGORIES.map((category) => ({
    category,
    actions: PET_ACTIONS.filter((action) => PET_ACTION_TABLE[action].category === category && avail.includes(action)),
  })).filter(({ actions }) => actions.length > 0);
}

export type PetState = {
  name: string;
  fullness: number;
  mood: number;
  clean: number;
  care_total: number;
  today_top: { nickname: string; count: number }[];
  recent: { nickname: string; action: PetAction; created_at: string }[];
  cooldown: Record<PetAction, number>;
};

export type PetStage = "baby" | "young" | "adult";

/** DB 함수(domine_pet_care)와 같은 기준: 돌봄 누적 30 미만 아기, 100 미만 어린, 그 이상 다 큰 */
export function stageOf(careTotal: number): PetStage {
  if (careTotal < 30) return "baby";
  if (careTotal < 100) return "young";
  return "adult";
}

export const STAGE_LABEL: Record<PetStage, string> = {
  baby: "아기 강아지",
  young: "어린 강아지",
  adult: "다 큰 강아지",
};

export const ACTION_LABEL = Object.fromEntries(PET_ACTIONS.map((a) => [a, PET_ACTION_TABLE[a].label])) as Record<PetAction, string>;
export const ACTION_DONE = Object.fromEntries(PET_ACTIONS.map((a) => [a, PET_ACTION_TABLE[a].done])) as Record<PetAction, string>;
export const ACTION_ICON = Object.fromEntries(PET_ACTIONS.map((a) => [a, PET_ACTION_TABLE[a].icon])) as Record<PetAction, string>;

/** 행동이 끝난 뒤 효과가 보이는 시간(ms) */
export const ACTION_PLAY_MS = Object.fromEntries(PET_ACTIONS.map((a) => [a, PET_ACTION_TABLE[a].ms])) as Record<PetAction, number>;

/** 남은 쉬는 시간 표시: 2시간 13분 / 14분 / 40초 */
export function formatWait(sec: number): string {
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return m ? `${h}시간 ${m}분` : `${h}시간`;
  }
  if (sec >= 60) return `${Math.ceil(sec / 60)}분`;
  return `${sec}초`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

export function sanitizeNickname(raw: string): string {
  return raw.replace(/[^가-힣a-zA-Z0-9]/g, "").slice(0, 8);
}

import { getSundayLiturgy } from "@/lib/liturgical/sunday-names";
import { line } from "@/lib/domine/pet-lines";

const LITURGY_COLOR: Record<string, { hex: string; name: string }> = {
  녹: { hex: "#2f8f57", name: "초록" },
  백: { hex: "#e9e2cf", name: "흰색" },
  자: { hex: "#6b4aa0", name: "보라" },
  홍: { hex: "#c0392b", name: "빨강" },
};

const pad = (n: number) => String(n).padStart(2, "0");
export const localISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 오늘 이후 첫 일요일(오늘 포함)의 전례일로 목줄 색을 정한다 */
export function collarToday(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  const l = getSundayLiturgy(localISO(d));
  const c = LITURGY_COLOR[l?.color ?? "녹"] ?? LITURGY_COLOR["녹"];
  return { hex: c.hex, colorName: c.name, liturgy: l?.name ?? "" };
}

export function saysText(face: string): string {
  return line(`idle_${face}`) || line("idle_happy");
}

/** 이 기기에서 연속으로 돌본 날 수 (localStorage) */
export function bumpStreak(): number {
  const key = "domine-pet-streak";
  const today = localISO(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  let n = 1;
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? "{}") as { last?: string; n?: number };
    if (s.last === today) n = s.n ?? 1;
    else if (s.last === localISO(y)) n = (s.n ?? 0) + 1;
    localStorage.setItem(key, JSON.stringify({ last: today, n }));
  } catch {
    /* 저장 못 해도 진행에는 영향 없음 */
  }
  return n;
}

/** 짧은 효과음 (사용자가 켰을 때만) */
export function blip(kind: PetAction) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = kind === "feed" || kind === "treat" || kind === "train" ? [523, 659] : kind === "pet" || kind === "brush" ? [659, 784] : kind === "bath" ? [784, 659, 523] : [440, 554, 659];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.12);
      o.stop(ctx.currentTime + i * 0.12 + 0.2);
    });
    window.setTimeout(() => ctx.close(), 800);
  } catch {
    /* 소리를 못 내도 무시 */
  }
}

export type PetFace = "happy" | "hungry" | "sad" | "dirty" | "sleepy";

export function faceOf(p: Pick<PetState, "fullness" | "mood" | "clean">, isNight: boolean): PetFace {
  if (p.fullness < 25) return "hungry";
  if (p.mood < 25) return "sad";
  if (p.clean < 25) return "dirty";
  return isNight ? "sleepy" : "happy";
}

export function statusText(face: PetFace): string {
  switch (face) {
    case "hungry":
      return "도미는 배가 고파요.";
    case "sad":
      return "도미는 심심하고 시무룩해요.";
    case "dirty":
      return "도미가 꼬질꼬질해요. 씻겨 주세요.";
    case "sleepy":
      return "도미는 졸려서 꾸벅꾸벅 졸고 있어요.";
    default:
      return "도미는 기분이 좋아요.";
  }
}
