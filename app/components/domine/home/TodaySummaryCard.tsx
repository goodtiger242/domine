import Link from "next/link";
import type { TodaySummaryPayload } from "@/lib/home/today-summary";

type Props = {
  summary: TodaySummaryPayload;
};

export function TodaySummaryCard({ summary }: Props) {
  const {
    dateLabel,
    massTitle,
    highlights,
    noticeSnippet,
  } = summary;

  return (
    <div className="rounded-2xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-5 shadow-[var(--lit-paper-shadow-soft)] ring-1 ring-black/[0.02] sm:p-6 dark:ring-white/[0.04]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--lit-ink-muted)]">
        Today · 오늘의 안내
      </p>
      <p className="mt-2 text-[15px] font-medium leading-snug text-[var(--lit-ink-muted)]">
        {dateLabel}
      </p>
      <h2 className="mt-3 text-[clamp(1.15rem,4.2vw,1.35rem)] font-semibold leading-snug tracking-[-0.03em] text-[var(--lit-ink)]">
        {massTitle}
      </h2>

      {highlights.length > 0 ? (
        <ul className="mt-4 space-y-3 border-t border-[var(--lit-border)]/90 pt-4">
          {highlights.map((line, i) => {
            const m = line.match(/^(\d{1,2}:\d{2})\s*[·\s]\s*(.+)$/);
            if (m) {
              return (
                <li
                  key={i}
                  className="flex gap-3 text-[15px] leading-snug text-[var(--lit-ink)]"
                >
                  <span className="w-[3.25rem] shrink-0 tabular-nums text-[15px] font-semibold">
                    {m[1]}
                  </span>
                  <span className="min-w-0 flex-1 break-keep">{m[2]}</span>
                </li>
              );
            }
            return (
              <li
                key={i}
                className="text-[15px] leading-snug text-[var(--lit-ink)]"
              >
                {line}
              </li>
            );
          })}
        </ul>
      ) : null}

      {noticeSnippet ? (
        <div className="mt-4 rounded-xl border border-[var(--lit-border)] border-l-[3px] border-l-[var(--lit-ink)]/25 bg-[var(--lit-bg)] px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--lit-ink-muted)]">
            공지
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--lit-ink)]">
            {noticeSnippet}
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/liturgical"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--lit-ink)] bg-[var(--lit-ink)] px-5 text-[13px] font-medium text-[var(--lit-bg-elevated)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
        >
          전체 일정 보기
        </Link>
        <Link
          href="/liturgical/edit"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--lit-border)] bg-transparent px-5 text-[13px] font-medium text-[var(--lit-ink-muted)] transition-colors hover:border-[var(--lit-border-strong)] hover:text-[var(--lit-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
        >
          편집
        </Link>
      </div>
    </div>
  );
}
