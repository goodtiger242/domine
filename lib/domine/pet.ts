export type PetAction = "feed" | "pet" | "walk";

export type PetState = {
  name: string;
  fullness: number;
  mood: number;
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

export const ACTION_LABEL: Record<PetAction, string> = {
  feed: "밥주기",
  pet: "쓰다듬기",
  walk: "산책",
};

export const ACTION_DONE: Record<PetAction, string> = {
  feed: "밥을 줬어요",
  pet: "쓰다듬어 줬어요",
  walk: "산책을 시켰어요",
};

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

export type PetFace = "happy" | "hungry" | "sad" | "sleepy";

export function faceOf(p: Pick<PetState, "fullness" | "mood">, isNight: boolean): PetFace {
  if (p.fullness < 25) return "hungry";
  if (p.mood < 25) return "sad";
  return isNight ? "sleepy" : "happy";
}

export function statusText(face: PetFace): string {
  switch (face) {
    case "hungry":
      return "도미는 배가 고파요.";
    case "sad":
      return "도미는 심심하고 시무룩해요.";
    case "sleepy":
      return "도미는 졸려서 꾸벅꾸벅 졸고 있어요.";
    default:
      return "도미는 기분이 좋아요.";
  }
}
