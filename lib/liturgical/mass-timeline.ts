import { formatLocalYMD, parseLocalYMD } from "@/lib/date/local";

export function addDaysISO(iso: string, days: number): string {
  const d = parseLocalYMD(iso);
  d.setDate(d.getDate() + days);
  return formatLocalYMD(d);
}

export function dayOfWeekISO(iso: string): number {
  return parseLocalYMD(iso).getDay();
}

/** 오늘 포함, 해당 ISO 날짜가 일요일이면 그날, 아니면 그 주의 다음 일요일 */
export function firstSundayOnOrAfter(iso: string): string {
  const d = parseLocalYMD(iso);
  const dow = d.getDay();
  const add = dow === 0 ? 0 : 7 - dow;
  d.setDate(d.getDate() + add);
  return formatLocalYMD(d);
}

/** fromISO ~ toISO(포함) 구간의 모든 일요일 (미사 기본 슬롯) */
export function enumerateSundaysFrom(
  fromISO: string,
  toISOInclusive: string
): string[] {
  const out: string[] = [];
  let cur = firstSundayOnOrAfter(fromISO);
  while (cur <= toISOInclusive) {
    out.push(cur);
    cur = addDaysISO(cur, 7);
  }
  return out;
}

/**
 * 일요일 슬롯 + DB에 내용이 있는 월~토 특별 미사일을 합쳐 시계열 키(YYYY-MM-DD) 오름차순.
 */
export function buildMassEventKeys(
  todayISO: string,
  dbDatesWithContent: string[],
  horizonEndISO: string
): string[] {
  const sundays = enumerateSundaysFrom(todayISO, horizonEndISO);
  const specialWeekdays = dbDatesWithContent.filter((d) => {
    if (d < todayISO || d > horizonEndISO) {
      return false;
    }
    const dow = dayOfWeekISO(d);
    return dow >= 1 && dow <= 6;
  });
  const set = new Set<string>([...sundays, ...specialWeekdays]);
  const keys = Array.from(set).sort();
  if (keys.length === 0) {
    return [firstSundayOnOrAfter(todayISO)];
  }
  return keys;
}

/**
 * 기본으로 보여줄 날짜: 오늘 이후 DB에 내용이 있는 가장 빠른 미사일,
 * 없으면 다가오는 일요일.
 */
export function pickDefaultMassDate(
  todayISO: string,
  dbDatesWithContent: string[]
): string {
  const upcoming = dbDatesWithContent.filter((d) => d >= todayISO).sort();
  if (upcoming.length > 0) {
    return upcoming[0];
  }
  return firstSundayOnOrAfter(todayISO);
}
