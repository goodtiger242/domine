"use client";

import { useCallback, useState } from "react";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { LiturgicalScheduleCard } from "@/app/components/domine/LiturgicalScheduleCard";

type Props = {
  eventKeys: string[];
  schedulesByDate: Record<string, LiturgicalSchedule>;
  initialIndex: number;
};

function emptySchedule(liturgyDate: string): LiturgicalSchedule {
  return {
    liturgy_date: liturgyDate,
    title: "",
    announcement_detail: "",
    role_commentator: "",
    role_reader_1: "",
    role_reader_2: "",
    role_gospel_acclamation: "",
    thurifer_main: "",
    thurifer_sub: "",
    conductor: "",
    organist: "",
    updated_at: "",
  };
}

const navBtn =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] text-xl font-light leading-none text-[var(--lit-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[transform,background-color,border-color,box-shadow] duration-300 ease-out hover:border-[var(--lit-border-strong)] hover:bg-[var(--lit-bg)] hover:shadow-[var(--lit-paper-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none";

const cardSoft =
  "rounded-2xl border-[var(--lit-border)]/85 shadow-[var(--lit-paper-shadow-soft)] ring-1 ring-black/[0.02] motion-reduce:shadow-none motion-reduce:ring-0 dark:ring-white/[0.04]";

export function HomeLiturgicalSpotlight({
  eventKeys,
  schedulesByDate,
  initialIndex,
}: Props) {
  const len = eventKeys.length;
  const [index, setIndex] = useState(() =>
    len === 0 ? 0 : Math.min(Math.max(0, initialIndex), len - 1)
  );

  const go = useCallback(
    (dir: -1 | 1) => {
      if (len <= 1) return;
      setIndex((i) => (i + dir + len) % len);
    },
    [len]
  );

  if (len === 0) {
    return null;
  }

  const dateKey = eventKeys[index]!;
  const row = schedulesByDate[dateKey];
  const schedule = row ?? emptySchedule(dateKey);
  const syntheticEmpty = row === undefined;

  const progressPct = len <= 0 ? 0 : ((index + 1) / len) * 100;

  return (
    <div className="w-full">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-stretch sm:gap-4 md:gap-5">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={len <= 1}
          className={`${navBtn} hidden sm:flex`}
          aria-label="이전 미사 일정"
        >
          ‹
        </button>

        <div className="min-w-0 flex-1">
          <LiturgicalScheduleCard
            schedule={schedule}
            showEditLink={false}
            showEmptyRolePlaceholders
            syntheticEmpty={syntheticEmpty}
            articleClassName={cardSoft}
          />
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          disabled={len <= 1}
          className={`${navBtn} hidden sm:flex`}
          aria-label="다음 미사 일정"
        >
          ›
        </button>
      </div>

      {len > 1 ? (
        <div className="mt-6 flex flex-col items-center gap-4 sm:mt-5">
          <div className="flex w-full max-w-md items-center justify-center gap-3 sm:hidden">
            <button
              type="button"
              onClick={() => go(-1)}
              className={navBtn}
              aria-label="이전 미사 일정"
            >
              ‹
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 px-1">
              <p className="text-[11px] font-medium tabular-nums tracking-[0.14em] text-[var(--lit-ink-muted)]">
                {index + 1} / {len}
              </p>
              <div className="h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-[var(--lit-border)]/80">
                <div
                  className="h-full rounded-full bg-[var(--lit-ink)]/35 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none dark:bg-[var(--lit-ink)]/25"
                  style={{ width: `${String(progressPct)}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => go(1)}
              className={navBtn}
              aria-label="다음 미사 일정"
            >
              ›
            </button>
          </div>

          <p className="hidden text-center text-[11px] font-medium tabular-nums tracking-[0.14em] text-[var(--lit-ink-muted)] sm:block">
            {index + 1} / {len}
          </p>
          <div className="mx-auto hidden h-1 w-full max-w-[10rem] overflow-hidden rounded-full bg-[var(--lit-border)]/80 sm:block">
            <div
              className="h-full rounded-full bg-[var(--lit-ink)]/30 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none dark:bg-[var(--lit-ink)]/22"
              style={{ width: `${String(progressPct)}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
