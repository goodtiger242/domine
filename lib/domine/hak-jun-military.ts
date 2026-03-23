/** 유머용 복무 일정 상수 */

const KST = "Asia/Seoul";

export const HAK_JUN_NAME = "이학준";

/** 입대일 */
export const HAK_JUN_ENLIST = new Date("2026-03-29T12:00:00+09:00");

/** 전역일 */
export const HAK_JUN_DISCHARGE = new Date("2027-09-08T12:00:00+09:00");

const MS_DAY = 86_400_000;

export type HakJunMilitaryStats = {
  /** 0–100, 입대 후 복무 구간 기준 진행률 (입대 전이면 0) */
  progressPercent: number;
  /**
   * 0–100, 입대 1년 전 ~ 전역일까지를 0~100%로 둔 “전체 일정” 위치(입대 전에도 0 초과 가능)
   */
  timelinePercent: number;
  /** 전역일까지 남은 일 수 */
  daysToDischarge: number;
  /** 이미 전역일 지남 */
  isDischarged: boolean;
  /** 아직 입대 전 */
  isPreEnlist: boolean;
};

export function getHakJunMilitaryStats(now: Date = new Date()): HakJunMilitaryStats {
  const t0 = HAK_JUN_ENLIST.getTime();
  const t1 = HAK_JUN_DISCHARGE.getTime();
  const total = t1 - t0;

  if (total <= 0) {
    return {
      progressPercent: 100,
      timelinePercent: 100,
      daysToDischarge: 0,
      isDischarged: true,
      isPreEnlist: false,
    };
  }

  const isPreEnlist = now.getTime() < t0;
  const isDischarged = now.getTime() >= t1;

  /** 입대 1년 전 시점 ~ 전역까지 선형 진행(배너 표시용, 입대 전에도 0% 초과 가능) */
  const anchorMs = t0 - 365 * MS_DAY;
  const timelineSpan = t1 - anchorMs;
  const timelinePercent =
    timelineSpan <= 0
      ? 0
      : Math.min(
          100,
          Math.max(0, ((now.getTime() - anchorMs) / timelineSpan) * 100)
        );

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
    timelinePercent,
    daysToDischarge,
    isDischarged,
    isPreEnlist,
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

function trimTrailingZeros(s: string): string {
  if (!s.includes(".")) {
    return s;
  }
  return s
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}

/**
 * 진행률 표시 — 1% 미만은 고정 자릿수 대신, 첫 유효숫자가 나올 때까지 소수 자릿수 확장
 */
export function formatProgressPercentDisplay(p: number): string {
  if (p >= 99.995) {
    return "100";
  }
  if (p <= 0) {
    return "0";
  }
  if (p >= 1) {
    return trimTrailingZeros(p.toFixed(2));
  }

  // 0 < p < 1
  if (p >= 0.999) {
    return trimTrailingZeros(p.toFixed(8));
  }

  const log = Math.log10(p);
  if (!Number.isFinite(log)) {
    return trimTrailingZeros(p.toFixed(20)) || "0";
  }

  const decimals = Math.min(20, Math.max(8, Math.ceil(-log) + 2));
  return trimTrailingZeros(p.toFixed(decimals));
}

/** 배너에 쓸 %: 입대 전은 timeline, 입대 후~전역 전은 복무 진행률 */
export function getBannerProgressPercent(stats: HakJunMilitaryStats): number {
  if (stats.isDischarged) {
    return 100;
  }
  if (stats.isPreEnlist) {
    return stats.timelinePercent;
  }
  return stats.progressPercent;
}
