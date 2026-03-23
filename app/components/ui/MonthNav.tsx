"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMonthLabelKo } from "@/lib/date/month";

type BasePath = "/liturgical" | "/calendar";

type Props = {
  year: number;
  month: number;
  basePath: BasePath;
};

function monthHref(basePath: BasePath, y: number, m: number) {
  return `${basePath}?year=${y}&month=${m}`;
}

export function MonthNav({ year, month, basePath }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const label = formatMonthLabelKo(year, month);

  const go = useCallback(
    (y: number, m: number) => {
      startTransition(() => {
        router.push(monthHref(basePath, y, m), { scroll: false });
      });
    },
    [router, basePath]
  );

  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);
  const now = new Date();

  const navBtnClass =
    "inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-center gap-2 sm:justify-start">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            go(prev.getFullYear(), prev.getMonth() + 1)
          }
          className={navBtnClass}
          aria-label="이전 달"
        >
          ‹
        </button>
        <span className="min-w-[10rem] text-center text-base font-semibold text-indigo-950 dark:text-amber-100">
          {label}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            go(next.getFullYear(), next.getMonth() + 1)
          }
          className={navBtnClass}
          aria-label="다음 달"
        >
          ›
        </button>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => go(now.getFullYear(), now.getMonth() + 1)}
        className="flex h-11 items-center justify-center rounded-full border border-indigo-950/25 bg-indigo-950/[0.06] px-5 text-sm font-semibold text-indigo-950 transition hover:bg-indigo-950/10 disabled:opacity-50 dark:border-amber-200/30 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50"
      >
        이번 달
      </button>
    </div>
  );
}
