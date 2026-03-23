"use client";

import { useRouter } from "next/navigation";
import { formatMonthLabelKo } from "@/lib/date/month";

type BasePath = "/liturgical" | "/calendar";

type Props = {
  year: number;
  month: number;
  basePath: BasePath;
};

export function MonthNav({ year, month, basePath }: Props) {
  const router = useRouter();
  const label = formatMonthLabelKo(year, month);

  function go(y: number, m: number) {
    router.push(`${basePath}?year=${y}&month=${m}`);
  }

  function prevMonth() {
    const d = new Date(year, month - 2, 1);
    go(d.getFullYear(), d.getMonth() + 1);
  }

  function nextMonth() {
    const d = new Date(year, month, 1);
    go(d.getFullYear(), d.getMonth() + 1);
  }

  function thisMonth() {
    const d = new Date();
    go(d.getFullYear(), d.getMonth() + 1);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-center gap-2 sm:justify-start">
        <button
          type="button"
          onClick={prevMonth}
          className="inline-flex h-10 min-w-[2.75rem] items-center justify-center rounded-full border border-stone-300 bg-white text-sm font-medium text-stone-800 shadow-sm transition hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800"
          aria-label="이전 달"
        >
          ‹
        </button>
        <span className="min-w-[10rem] text-center text-base font-semibold text-[#1a2f4a] dark:text-amber-100">
          {label}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="inline-flex h-10 min-w-[2.75rem] items-center justify-center rounded-full border border-stone-300 bg-white text-sm font-medium text-stone-800 shadow-sm transition hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>
      <button
        type="button"
        onClick={thisMonth}
        className="h-10 rounded-full border border-[#1a2f4a]/30 bg-[#1a2f4a]/5 px-4 text-sm font-medium text-[#1a2f4a] transition hover:bg-[#1a2f4a]/10 dark:border-amber-200/30 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50"
      >
        이번 달
      </button>
    </div>
  );
}
