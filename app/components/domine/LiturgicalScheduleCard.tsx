import Link from "next/link";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";

function formatDateLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value.trim()) {
    return null;
  }
  return (
    <p className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="shrink-0 text-sm font-medium text-[#1a2f4a]/80 dark:text-amber-200/80">
        {label}
      </span>
      <span className="text-stone-800 dark:text-stone-200">{value}</span>
    </p>
  );
}

type Props = {
  schedule: LiturgicalSchedule;
};

export function LiturgicalScheduleCard({ schedule }: Props) {
  const hasAnyRole = [
    schedule.role_commentator,
    schedule.role_reader_1,
    schedule.role_reader_2,
    schedule.role_gospel_acclamation,
    schedule.thurifer_main,
    schedule.thurifer_sub,
    schedule.conductor,
    schedule.organist,
  ].some((s) => s.trim());

  return (
    <article className="rounded-2xl border border-stone-200/90 bg-white/90 p-6 shadow-sm dark:border-stone-700 dark:bg-stone-950/70">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#1a2f4a]/75 dark:text-amber-200/80">
            {formatDateLabel(schedule.liturgy_date)}
          </p>
          {schedule.title.trim() ? (
            <h3 className="mt-2 text-lg font-semibold text-stone-900 dark:text-stone-100">
              {schedule.title}
            </h3>
          ) : null}
        </div>
        <Link
          href={`/liturgical/edit?date=${schedule.liturgy_date}`}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-[#1a2f4a]/25 bg-white px-4 text-xs font-medium text-[#1a2f4a] transition hover:bg-[#1a2f4a]/5 dark:border-amber-200/25 dark:bg-stone-900 dark:text-amber-100 dark:hover:bg-stone-800"
        >
          수정
        </Link>
      </div>

      {schedule.announcement_detail.trim() ? (
        <div className="mb-5 rounded-xl border border-stone-200 bg-stone-50/90 p-4 dark:border-stone-700 dark:bg-stone-900/50">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700 dark:text-stone-300">
            {schedule.announcement_detail}
          </p>
        </div>
      ) : null}

      {hasAnyRole ? (
        <div className="space-y-5 rounded-xl border border-stone-200/70 bg-[#faf8f5] p-4 dark:border-stone-700 dark:bg-stone-950/50">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1a2f4a] dark:text-amber-200/90">
              전례 봉사
            </h4>
            <div className="space-y-2 text-sm">
              <Row label="해설" value={schedule.role_commentator} />
              <Row label="1독서" value={schedule.role_reader_1} />
              <Row label="2독서" value={schedule.role_reader_2} />
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1a2f4a] dark:text-amber-200/90">
              복음 환호송
            </h4>
            {schedule.role_gospel_acclamation.trim() ? (
              <p className="text-sm text-stone-800 dark:text-stone-200">
                {schedule.role_gospel_acclamation}
              </p>
            ) : null}
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1a2f4a] dark:text-amber-200/90">
              복사단
            </h4>
            <div className="space-y-2 text-sm">
              <Row label="대복" value={schedule.thurifer_main} />
              <Row label="소복" value={schedule.thurifer_sub} />
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1a2f4a] dark:text-amber-200/90">
              지휘 · 반주
            </h4>
            <div className="space-y-2 text-sm">
              <Row label="지휘" value={schedule.conductor} />
              <Row label="반주" value={schedule.organist} />
            </div>
          </div>
        </div>
      ) : null}

      {schedule.updated_at ? (
        <p className="mt-4 text-center text-[11px] text-stone-500 dark:text-stone-500">
          마지막 저장:{" "}
          {new Date(schedule.updated_at).toLocaleString("ko-KR")}
        </p>
      ) : null}
    </article>
  );
}
