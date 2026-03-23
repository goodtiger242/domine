/** 오늘(포함) 이후 첫 `liturgy_date`; 없으면 그 달에서 가장 늦은 날짜(이번 달 일정이 모두 지난 경우). */
export function pickNearestLiturgyDateKey(
  schedules: { liturgy_date: string }[],
  todayISO: string
): string | null {
  if (schedules.length === 0) {
    return null;
  }
  const sorted = [...schedules].sort((a, b) =>
    a.liturgy_date.localeCompare(b.liturgy_date)
  );
  const upcoming = sorted.find((s) => s.liturgy_date >= todayISO);
  if (upcoming) {
    return upcoming.liturgy_date;
  }
  return sorted[sorted.length - 1].liturgy_date;
}
