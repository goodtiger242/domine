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

const MONTHS_1_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

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

  const loadMonth = useCallback(
    (m: number) => {
      setMonth(m);
      startTransition(async () => {
        const rows = await listLiturgicalInMonth(viewYear, m);
        setSchedules(rows);
      });
    },
    [viewYear]
  );

  const goThisMonth = useCallback(() => {
    const { y, m } = currentCalendarMonth();
    setViewYear(y);
    setMonth(m);
    startTransition(async () => {
      const rows = await listLiturgicalInMonth(y, m);
      setSchedules(rows);
    });
  }, []);

  const { y: cy, m: cm } = currentCalendarMonth();
  const isViewingThisCalendarMonth = month === cm && viewYear === cy;

  const monthBtnBase =
    "flex min-h-11 min-w-0 items-center justify-center rounded-lg border px-1.5 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 disabled:opacity-50 motion-reduce:transition-none";

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <h2 className="font-light text-4xl tracking-[-0.03em] text-[var(--lit-ink)] max-lg:text-[clamp(1.65rem,6.5vw,2.1rem)] max-lg:leading-snug md:text-5xl">
          <span className="break-keep">
            {viewYear}년 {month}월 전례 봉사
          </span>
        </h2>

        {!isViewingThisCalendarMonth ? (
          <button
            type="button"
            onClick={goThisMonth}
            disabled={pending}
            className="inline-flex min-h-11 shrink-0 items-center justify-center self-start border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-4 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--lit-ink-muted)] transition hover:border-[var(--lit-ink)] hover:text-[var(--lit-ink)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 sm:self-auto"
          >
            이번 달
          </button>
        ) : null}
      </div>

      <div
        className="mt-5 rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]/80 p-3 sm:mt-6 sm:p-4"
        role="group"
        aria-label={`${viewYear}년 월 선택`}
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 lg:grid-cols-6">
          {MONTHS_1_12.map((m) => {
            const selected = month === m;
            return (
              <button
                key={m}
                type="button"
                disabled={pending}
                onClick={() => loadMonth(m)}
                aria-pressed={selected}
                aria-label={`${viewYear}년 ${m}월`}
                className={`${monthBtnBase} ${
                  selected
                    ? "border-[var(--lit-ink)] bg-[var(--lit-ink)] text-[var(--lit-bg-elevated)] shadow-sm"
                    : "border-[var(--lit-border)] bg-[var(--lit-bg)] text-[var(--lit-ink)] hover:border-[var(--lit-border-strong)] hover:bg-[var(--lit-bg-elevated)]"
                }`}
              >
                {m}월
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-10 md:mt-12">
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
