"use client";

import { useState } from "react";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { LiturgicalScheduleCard } from "@/app/components/domine/LiturgicalScheduleCard";
import Link from "next/link";

type Props = {
  /** 등록된 미사 전체 (날짜 오름차순) */
  schedules: LiturgicalSchedule[];
  nextUpcomingLiturgyDate: string | null;
};

const arrowClass =
  "flex h-9 w-9 items-center justify-center text-lg leading-none text-[var(--lit-ink-muted)] transition hover:bg-[var(--lit-bg)] hover:text-[var(--lit-ink)] disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--lit-ring)] sm:h-11 sm:w-11 sm:text-xl";

export function HomeLiturgicalMonthList({
  schedules,
  nextUpcomingLiturgyDate,
}: Props) {
  const [index, setIndex] = useState(() => {
    const i = schedules.findIndex(
      (s) => s.liturgy_date === nextUpcomingLiturgyDate
    );
    return i >= 0 ? i : Math.max(schedules.length - 1, 0);
  });
  const current = schedules[index];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 text-2xl font-medium tracking-[-0.03em] text-[var(--lit-ink)] max-lg:leading-snug sm:text-3xl md:text-4xl">
          <span className="break-keep">전례 안내</span>
        </h2>

        {current ? (
          <div
            className="flex min-h-9 shrink-0 items-center overflow-hidden rounded-full border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] shadow-[0_1px_0_rgba(0,0,0,0.03)] sm:min-h-11"
            role="group"
            aria-label="미사 이동"
          >
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              disabled={index === 0}
              aria-label="이전 미사"
              className={arrowClass}
            >
              ‹
            </button>
            <span className="flex h-9 min-w-[6.4rem] items-center justify-center border-x border-[var(--lit-border)] px-2 text-xs font-semibold tabular-nums text-[var(--lit-ink)] sm:h-11 sm:min-w-[8.5rem] sm:px-3 sm:text-sm">
              {index + 1} / {schedules.length}
            </span>
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              disabled={index === schedules.length - 1}
              aria-label="다음 미사"
              className={arrowClass}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-5 md:mt-7">
        {current ? (
          <LiturgicalScheduleCard
            key={current.liturgy_date}
            schedule={current}
            showEditLink={false}
            emphasize={current.liturgy_date === nextUpcomingLiturgyDate}
          />
        ) : (
          <div className="border border-dashed border-[var(--lit-border-strong)] bg-[var(--lit-bg-elevated)] px-8 py-16 text-center">
            <p className="text-[15px] leading-relaxed text-[var(--lit-ink-muted)]">
              등록된 전례 봉사 정보가 없습니다.
            </p>
            <Link
              href="/liturgical/edit"
              className="mt-8 inline-block text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--lit-ink)] underline decoration-[var(--lit-border-strong)] underline-offset-[6px] transition hover:opacity-70"
            >
              입력하기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
