"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { listLiturgicalInMonth } from "@/app/actions/liturgical";
import { LiturgicalScheduleCard } from "@/app/components/domine/LiturgicalScheduleCard";
import Link from "next/link";

type Props = {
  initialYear: number;
  initialMonth: number;
  initialSchedules: LiturgicalSchedule[];
  nextUpcomingLiturgyDate: string | null;
};

function buildMonthOptions(): { value: string; y: number; m: number; label: string }[] {
  const out: { value: string; y: number; m: number; label: string }[] = [];
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  from.setMonth(0, 1);
  const to = new Date();
  to.setFullYear(to.getFullYear() + 2);
  to.setMonth(11, 1);
  const cur = new Date(from);
  while (cur <= to) {
    const y = cur.getFullYear();
    const m = cur.getMonth() + 1;
    out.push({
      value: `${y}-${String(m).padStart(2, "0")}`,
      y,
      m,
      label: `${y}년 ${m}월`,
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

function currentCalendarMonth(): { y: number; m: number } {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

export function HomeLiturgicalMonthList({
  initialYear,
  initialMonth,
  initialSchedules,
  nextUpcomingLiturgyDate,
}: Props) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [pending, startTransition] = useTransition();
  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const loadMonth = useCallback((y: number, m: number) => {
    setYear(y);
    setMonth(m);
    startTransition(async () => {
      const rows = await listLiturgicalInMonth(y, m);
      setSchedules(rows);
    });
  }, []);

  const onSelectChange = useCallback(
    (value: string) => {
      const [ys, ms] = value.split("-");
      const y = parseInt(ys!, 10);
      const mo = parseInt(ms!, 10);
      if (Number.isNaN(y) || Number.isNaN(mo)) return;
      loadMonth(y, mo);
    },
    [loadMonth]
  );

  const goThisMonth = useCallback(() => {
    const { y, m } = currentCalendarMonth();
    loadMonth(y, m);
  }, [loadMonth]);

  const selectValue = `${year}-${String(month).padStart(2, "0")}`;
  const { y: cy, m: cm } = currentCalendarMonth();
  const isViewingThisCalendarMonth = year === cy && month === cm;

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <h2 className="font-light text-4xl tracking-[-0.03em] text-[var(--lit-ink)] max-lg:text-[clamp(1.65rem,6.5vw,2.1rem)] max-lg:leading-snug md:text-5xl">
          <span className="break-keep">{month}월 전례 봉사</span>
        </h2>

        <div className="flex flex-wrap items-end gap-3 sm:justify-end">
          {!isViewingThisCalendarMonth ? (
            <button
              type="button"
              onClick={goThisMonth}
              disabled={pending}
              className="inline-flex min-h-11 shrink-0 items-center justify-center border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-4 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--lit-ink-muted)] transition hover:border-[var(--lit-ink)] hover:text-[var(--lit-ink)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
            >
              이번 달
            </button>
          ) : null}

          <div className="flex min-w-0 flex-col gap-1.5">
            <label
              htmlFor="home-liturgical-month"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--lit-ink-subtle)]"
            >
              보기할 달
            </label>
            <select
              id="home-liturgical-month"
              value={selectValue}
              onChange={(e) => onSelectChange(e.target.value)}
              disabled={pending}
              className="min-h-11 min-w-[12.5rem] max-w-full cursor-pointer appearance-none rounded-sm border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-3 py-2.5 pr-9 text-sm text-[var(--lit-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 disabled:opacity-50 dark:shadow-[0_1px_2px_rgba(0,0,0,0.25]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235c5c5c' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.65rem center",
                backgroundSize: "1rem",
              }}
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-10 md:mt-12">
        {schedules.length === 0 ? (
          <div className="border border-dashed border-[var(--lit-border-strong)] bg-[var(--lit-bg-elevated)] px-8 py-16 text-center">
            <p className="text-[15px] leading-relaxed text-[var(--lit-ink-muted)]">
              {year}년 {month}월에 등록된 전례 봉사 정보가 없습니다.
            </p>
            <Link
              href="/liturgical/edit"
              className="mt-8 inline-block text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--lit-ink)] underline decoration-[var(--lit-border-strong)] underline-offset-[6px] transition hover:opacity-70"
            >
              입력하기
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-10 md:gap-14">
            {schedules.map((s, i) => (
              <li key={`${s.liturgy_date}-${s.updated_at ?? i}`}>
                <LiturgicalScheduleCard
                  schedule={s}
                  showEditLink={false}
                  emphasize={
                    nextUpcomingLiturgyDate !== null &&
                    s.liturgy_date === nextUpcomingLiturgyDate
                  }
                  emphasizeLabel="다가오는 미사"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
