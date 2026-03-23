/** 유머용 복무 일정 상수 */

const KST = "Asia/Seoul";

export const HAK_JUN_NAME = "이학준";

/** 입대일 */
export const HAK_JUN_ENLIST = new Date("2026-03-29T12:00:00+09:00");

/** 전역일 */
export const HAK_JUN_DISCHARGE = new Date("2027-09-08T12:00:00+09:00");

const MS_DAY = 86_400_000;

export type HakJunMilitaryStats = {
  /** 0–100, 입대~전역 복무 구간 기준 진행률 (입대 전이면 0) */
  progressPercent: number;
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
      daysToDischarge: 0,
      isDischarged: true,
      isPreEnlist: false,
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

/** 소수 끝의 0만 제거 (0.00034… 형태를 0으로 망가뜨리지 않음) */
function trimTrailingZeros(s: string): string {
  if (!s.includes(".")) {
    return s;
  }
  const trimmed = s.replace(/0+$/, "");
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
}

/**
 * 진행률 표시 (% 단위, 0–100).
 * 1% 미만은 소수 자릿수 제한을 두지 않고(최대 16자리) 끝 0만 제거해 최대한 그대로 보여 줌.
 */
export function formatProgressPercentDisplay(p: number): string {
  if (p >= 99.995) {
    return "100";
  }
  if (!(p > 0)) {
    return "0";
  }
  if (p >= 1) {
    return trimTrailingZeros(p.toFixed(2));
  }

  // 0 < p < 1
  if (p >= 0.999) {
    return trimTrailingZeros(p.toFixed(6));
  }

  return trimTrailingZeros(p.toFixed(16));
}
