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

  return (
    <div className="flex w-full items-stretch gap-2 sm:gap-3">
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={len <= 1}
        className="flex h-11 w-11 shrink-0 self-center items-center justify-center rounded-full border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] text-xl font-light leading-none text-[var(--lit-ink)] shadow-[0_1px_0_rgba(0,0,0,0.04)] transition hover:border-[var(--lit-ink)] hover:bg-[var(--lit-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
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
        />
        {len > 1 ? (
          <p className="mt-4 text-center text-[11px] font-medium tabular-nums tracking-[0.12em] text-[var(--lit-ink-muted)]">
            {index + 1} / {len}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => go(1)}
        disabled={len <= 1}
        className="flex h-11 w-11 shrink-0 self-center items-center justify-center rounded-full border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] text-xl font-light leading-none text-[var(--lit-ink)] shadow-[0_1px_0_rgba(0,0,0,0.04)] transition hover:border-[var(--lit-ink)] hover:bg-[var(--lit-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
        aria-label="다음 미사 일정"
      >
        ›
      </button>
    </div>
  );
}
