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

export function getTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return formatLocalYMD(d);
}
