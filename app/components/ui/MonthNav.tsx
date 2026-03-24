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
    "inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-lg border border-[var(--lit-border-strong)] bg-[var(--lit-bg-elevated)] text-sm font-semibold text-[var(--lit-ink)] shadow-[var(--lit-paper-shadow)] transition hover:border-[var(--lit-gold)] hover:text-[var(--lit-gold)] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2";

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
        <span className="min-w-[10rem] text-center text-base font-semibold text-[var(--lit-ink)]">
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
        className="flex h-11 items-center justify-center rounded-lg border border-[var(--lit-border)] bg-[var(--lit-bg)] px-5 text-sm font-semibold text-[var(--lit-ink-muted)] transition hover:border-[var(--lit-gold)] hover:text-[var(--lit-gold)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
      >
        이번 달
      </button>
    </div>
  );
}
