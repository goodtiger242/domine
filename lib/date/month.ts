/** month: 1–12 */
export function getMonthRangeISO(
  year: number,
  month: number
): { start: string; end: string } {
  const endD = new Date(year, month, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${year}-${pad(month)}-01`;
  const end = `${year}-${pad(month)}-${pad(endD.getDate())}`;
  return { start, end };
}

export function getCurrentYearMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function parseYearMonthParams(
  yearStr: string | undefined,
  monthStr: string | undefined
): { year: number; month: number } {
  const cur = getCurrentYearMonth();
  const y = yearStr ? parseInt(yearStr, 10) : cur.year;
  const m = monthStr ? parseInt(monthStr, 10) : cur.month;
  if (Number.isNaN(y) || y < 2000 || y > 2100) {
    return cur;
  }
  if (Number.isNaN(m) || m < 1 || m > 12) {
    return cur;
  }
  return { year: y, month: m };
}

export function formatMonthLabelKo(year: number, month: number): string {
  return `${year}년 ${month}월`;
}
