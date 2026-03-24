"use client";

import type { ReactNode } from "react";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { FIXED_CONDUCTOR_NAME } from "@/lib/constants/liturgical";
import { formatYouthMemberDisplay } from "@/lib/constants/youth-members";
import { parseAnnouncementDetail } from "@/lib/liturgical/announcement-parse";

type Props = {
  schedule: LiturgicalSchedule;
  syntheticEmpty: boolean;
};

function RoleRow({ label, value }: { label: string; value: string }) {
  const v = value.trim();
  const display = v ? formatYouthMemberDisplay(v) : "";
  return (
    <div className="flex gap-3 py-2.5 text-[15px] leading-snug">
      <span className="w-[4.5rem] shrink-0 rounded-md bg-[var(--lit-bg)] px-2 py-0.5 text-center text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--lit-ink)]">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words font-medium text-[var(--lit-ink)]">
        {display || "\u00a0"}
      </span>
    </div>
  );
}

function Accordion({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-b border-[var(--lit-border)] last:border-b-0"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 py-3 pr-1 text-[15px] font-semibold text-[var(--lit-ink)] marker:content-none [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span
          className="text-lg font-light text-[var(--lit-ink-muted)] transition-transform group-open:rotate-180"
          aria-hidden
        >
          ⌄
        </span>
      </summary>
      <div className="border-t border-[var(--lit-border)]/80 bg-[var(--lit-bg)]/60 px-1 pb-3 pt-1">
        {children}
      </div>
    </details>
  );
}

export function LiturgicalHomeModules({ schedule, syntheticEmpty }: Props) {
  const { timeline, notice } = parseAnnouncementDetail(
    schedule.announcement_detail
  );
  const conductorValue = syntheticEmpty ? "" : FIXED_CONDUCTOR_NAME;

  return (
    <div className="space-y-4">
      {notice.length > 0 ? (
        <div className="rounded-2xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--lit-ink-muted)]">
            공지
          </p>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--lit-ink)]">
            {notice}
          </p>
        </div>
      ) : null}

      {timeline.length > 0 ? (
        <div className="rounded-2xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--lit-ink-muted)]">
            일정
          </p>
          <ul className="mt-3 space-y-0 divide-y divide-[var(--lit-border)]/90">
            {timeline.map((row, i) => (
              <li
                key={i}
                className="flex gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="w-[3.25rem] shrink-0 tabular-nums text-[15px] font-semibold text-[var(--lit-ink)]">
                  {row.time}
                </span>
                <span className="min-w-0 flex-1 text-[15px] leading-snug text-[var(--lit-ink)]">
                  {row.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]">
        <p className="border-b border-[var(--lit-border)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--lit-ink-muted)]">
          봉사자
        </p>
        <Accordion title="전례 봉사 · 복음" defaultOpen>
          <RoleRow label="해설" value={schedule.role_commentator} />
          <RoleRow label="1독" value={schedule.role_reader_1} />
          <RoleRow label="2독" value={schedule.role_reader_2} />
          <RoleRow label="환호" value={schedule.role_gospel_acclamation} />
        </Accordion>
        <Accordion title="복사단">
          <RoleRow label="대복" value={schedule.thurifer_main} />
          <RoleRow label="소복" value={schedule.thurifer_sub} />
        </Accordion>
        <Accordion title="지휘 · 반주">
          <RoleRow label="지휘" value={conductorValue} />
          <RoleRow label="반주" value={schedule.organist} />
        </Accordion>
      </div>
    </div>
  );
}
