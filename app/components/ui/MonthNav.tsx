"use client";

import Link from "next/link";
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
  const label = formatMonthLabelKo(year, month);

  const prev = new Date(year, month - 2, 1);
  const prevHref = monthHref(
    basePath,
    prev.getFullYear(),
    prev.getMonth() + 1
  );

  const next = new Date(year, month, 1);
  const nextHref = monthHref(
    basePath,
    next.getFullYear(),
    next.getMonth() + 1
  );

  const now = new Date();
  const thisHref = monthHref(
    basePath,
    now.getFullYear(),
    now.getMonth() + 1
  );

  const navBtnClass =
    "inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-center gap-2 sm:justify-start">
        <Link
          href={prevHref}
          scroll={false}
          prefetch={true}
          className={navBtnClass}
          aria-label="이전 달"
        >
          ‹
        </Link>
        <span className="min-w-[10rem] text-center text-base font-semibold text-indigo-950 dark:text-amber-100">
          {label}
        </span>
        <Link
          href={nextHref}
          scroll={false}
          prefetch={true}
          className={navBtnClass}
          aria-label="다음 달"
        >
          ›
        </Link>
      </div>
      <Link
        href={thisHref}
        scroll={false}
        prefetch={true}
        className="flex h-11 items-center justify-center rounded-full border border-indigo-950/25 bg-indigo-950/[0.06] px-5 text-sm font-semibold text-indigo-950 transition hover:bg-indigo-950/10 dark:border-amber-200/30 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50"
      >
        이번 달
      </Link>
    </div>
  );
}
