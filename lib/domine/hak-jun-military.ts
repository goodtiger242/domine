/** 유머용 복무 일정 상수 */

const KST = "Asia/Seoul";

export const HAK_JUN_NAME = "이학준";

/** 입대일 */
export const HAK_JUN_ENLIST = new Date("2026-03-09T12:00:00+09:00");

/** 전역일 */
export const HAK_JUN_DISCHARGE = new Date("2027-09-08T12:00:00+09:00");

export type MilitaryServiceMember = {
  name: string;
  label: string;
  photoSrc: string | null;
  enlistDate: Date;
  dischargeDate: Date;
};

export const HAK_JUN_MILITARY_MEMBER: MilitaryServiceMember = {
  name: HAK_JUN_NAME,
  label: HAK_JUN_NAME,
  photoSrc: "/image/이학준.jpg",
  enlistDate: HAK_JUN_ENLIST,
  dischargeDate: HAK_JUN_DISCHARGE,
};

export const TAE_WON_MILITARY_MEMBER: MilitaryServiceMember = {
  name: "유태원",
  label: "유태원 아이다노",
  photoSrc: null,
  enlistDate: new Date("2026-06-15T12:00:00+09:00"),
  dischargeDate: new Date("2027-12-14T12:00:00+09:00"),
};

export const MILITARY_SERVICE_MEMBERS: readonly MilitaryServiceMember[] = [
  HAK_JUN_MILITARY_MEMBER,
  TAE_WON_MILITARY_MEMBER,
];

const MS_DAY = 86_400_000;

export type HakJunMilitaryStats = {
  /** 0–100, 입대~전역 복무 구간 기준 진행률. 입대 전에는 미세 표시용(0.0000x%대) */
  progressPercent: number;
  /** 전역일까지 남은 일 수 */
  daysToDischarge: number;
  /** 이미 전역일 지남 */
  isDischarged: boolean;
  /** 아직 입대 전 */
  isPreEnlist: boolean;
};

export function getMilitaryServiceStats(
  member: MilitaryServiceMember,
  now: Date = new Date()
): HakJunMilitaryStats {
  const t0 = member.enlistDate.getTime();
  const t1 = member.dischargeDate.getTime();
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
    /** 입대 전: 입대에 가까워질수록 아주 미세하게 올라감(0% 고정 방지). until > total 이면 바닥값만 부여 */
    const until = t0 - now.getTime();
    const ratio = until / total;
    const raw = 1 - Math.min(1, ratio);
    progressPercent = Math.max(1e-12, raw * 0.000074);
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

export function getHakJunMilitaryStats(
  now: Date = new Date()
): HakJunMilitaryStats {
  return getMilitaryServiceStats(HAK_JUN_MILITARY_MEMBER, now);
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
 * 1% 미만: 소수 여섯째 자리까지, 1% 이상: 소수 셋째 자리까지(끝의 불필요한 0은 제거).
 */
export function formatProgressPercentDisplay(p: number): string {
  if (p >= 99.995) {
    return "100";
  }
  if (!(p > 0)) {
    return "0";
  }
  if (p >= 1) {
    return trimTrailingZeros(p.toFixed(3));
  }

  // 0 < p < 1
  return trimTrailingZeros(p.toFixed(6));
}
