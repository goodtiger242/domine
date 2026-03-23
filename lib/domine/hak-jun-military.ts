/** 유머용 상수 — 실제 전역일과 다를 수 있음 */

const KST = "Asia/Seoul";

export const HAK_JUN_NAME = "이학준";

/** 입대일 (2025년 3월 9일) */
export const HAK_JUN_ENLIST = new Date("2025-03-09T12:00:00+09:00");

/**
 * 전역일 가정: 육군 현역 약 18개월 복무 (유머·표시용)
 * 실제와 다르면 이 날짜만 수정하면 됨.
 */
export const HAK_JUN_DISCHARGE = new Date("2026-09-09T12:00:00+09:00");

const MS_DAY = 86_400_000;

export type HakJunMilitaryStats = {
  /** 0–100, 복무 진행률 */
  progressPercent: number;
  /** 전역일까지 남은 일 수 */
  daysToDischarge: number;
  /** 이미 전역일 지남 */
  isDischarged: boolean;
};

export function getHakJunMilitaryStats(now: Date = new Date()): HakJunMilitaryStats {
  const t0 = HAK_JUN_ENLIST.getTime();
  const t1 = HAK_JUN_DISCHARGE.getTime();
  const total = t1 - t0;

  if (total <= 0) {
    return {
      progressPercent: 100,
      daysToDischarge: 0,
      isDischarged: true,
    };
  }

  const isPreEnlist = now.getTime() < t0;
  const isDischarged = now.getTime() >= t1;

  let progressPercent: number;
  if (isPreEnlist) {
    progressPercent = 0;
  } else if (isDischarged) {
    progressPercent = 100;
  } else {
    progressPercent = Math.min(
      100,
      Math.max(0, ((now.getTime() - t0) / total) * 100)
    );
  }

  const daysToDischarge = Math.ceil((t1 - now.getTime()) / MS_DAY);

  return {
    progressPercent,
    daysToDischarge,
    isDischarged,
  };
}

export function formatKoreanDate(d: Date) {
  return d.toLocaleDateString("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
