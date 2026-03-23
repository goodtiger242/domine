/** 로컬 기준 YYYY-MM-DD */
export function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 오늘을 포함해 가장 가까운 다음(또는 오늘) 주일 */
export function getTargetSundayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const add = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + add);
  return formatLocalYMD(d);
}

/** 임의 날짜 → 그 주의 주일(로컬) */
export function normalizeToSundayISO(dateStr: string): string {
  const x = parseLocalYMD(dateStr);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay();
  x.setDate(x.getDate() - dow);
  return formatLocalYMD(x);
}

/** 시작 주일부터 n주간 주일 목록 */
export function generateNextSundays(count: number): string[] {
  const first = parseLocalYMD(getTargetSundayISO());
  const out: string[] = [];
  const d = new Date(first);
  for (let i = 0; i < count; i++) {
    out.push(formatLocalYMD(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}
