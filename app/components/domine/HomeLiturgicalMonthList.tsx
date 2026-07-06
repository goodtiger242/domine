"use client";

import { useCallback, useState, useTransition } from "react";
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

function currentCalendarMonth(): { y: number; m: number } {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function shiftMonth(year: number, month: number, delta: -1 | 1) {
  const d = new Date(year, month - 1 + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

export function HomeLiturgicalMonthList({
  initialYear,
  initialMonth,
  initialSchedules,
  nextUpcomingLiturgyDate,
}: Props) {
  const [viewYear, setViewYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [pending, startTransition] = useTransition();

  const loadMonth = useCallback((y: number, m: number) => {
    setViewYear(y);
    setMonth(m);
    startTransition(async () => {
      const rows = await listLiturgicalInMonth(y, m);
      setSchedules(rows);
    });
  }, []);

  const moveMonth = useCallback(
    (delta: -1 | 1) => {
      const next = shiftMonth(viewYear, month, delta);
      setViewYear(next.y);
      setMonth(next.m);
      startTransition(async () => {
        const rows = await listLiturgicalInMonth(next.y, next.m);
        setSchedules(rows);
      });
    },
    [month, viewYear]
  );

  const goThisMonth = useCallback(() => {
    const { y, m } = currentCalendarMonth();
    loadMonth(y, m);
  }, [loadMonth]);

  const { y: cy, m: cm } = currentCalendarMonth();
  const isViewingThisCalendarMonth = month === cm && viewYear === cy;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <h2 className="font-light text-3xl tracking-[-0.03em] text-[var(--lit-ink)] max-lg:text-[clamp(1.45rem,5.5vw,1.85rem)] max-lg:leading-snug md:text-4xl">
          <span className="break-keep">전례 안내</span>
        </h2>

        <div
          className="flex min-h-11 items-center self-start overflow-hidden rounded-lg border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] sm:self-auto"
          role="group"
          aria-label="월 이동"
        >
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            disabled={pending}
            aria-label="이전 달"
            className="flex h-11 w-11 items-center justify-center text-xl leading-none text-[var(--lit-ink-muted)] transition hover:bg-[var(--lit-bg)] hover:text-[var(--lit-ink)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--lit-ring)]"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goThisMonth}
            disabled={pending || isViewingThisCalendarMonth}
            className="h-11 min-w-[8.5rem] border-x border-[var(--lit-border)] px-3 text-sm font-medium tabular-nums text-[var(--lit-ink)] transition hover:bg-[var(--lit-bg)] disabled:cursor-default disabled:hover:bg-transparent md:min-w-[9.5rem]"
          >
            {viewYear}년 {month}월
          </button>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            disabled={pending}
            aria-label="다음 달"
            className="flex h-11 w-11 items-center justify-center text-xl leading-none text-[var(--lit-ink-muted)] transition hover:bg-[var(--lit-bg)] hover:text-[var(--lit-ink)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--lit-ring)]"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-8 md:mt-10">
        {schedules.length === 0 ? (
          <div className="border border-dashed border-[var(--lit-border-strong)] bg-[var(--lit-bg-elevated)] px-8 py-16 text-center">
            <p className="text-[15px] leading-relaxed text-[var(--lit-ink-muted)]">
              {viewYear}년 {month}월에 등록된 전례 봉사 정보가 없습니다.
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
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
