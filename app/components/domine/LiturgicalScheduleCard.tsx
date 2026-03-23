import Link from "next/link";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { FIXED_CONDUCTOR_NAME } from "@/lib/constants/liturgical";

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
      <span className="shrink-0 text-sm font-semibold text-indigo-900/85 dark:text-amber-200/85">
        {label}
      </span>
      <span className="text-slate-800 dark:text-slate-100">{value}</span>
    </p>
  );
}

type Props = {
  schedule: LiturgicalSchedule;
  /** 메인 등 조회 전용 화면에서는 수정 링크 숨김 */
  showEditLink?: boolean;
};

export function LiturgicalScheduleCard({
  schedule,
  showEditLink = true,
}: Props) {
  const hasLiturgicalRoles = [
    schedule.role_commentator,
    schedule.role_reader_1,
    schedule.role_reader_2,
    schedule.role_gospel_acclamation,
    schedule.thurifer_main,
    schedule.thurifer_sub,
    schedule.organist,
  ].some((s) => s.trim());

  return (
    <article className="rounded-3xl border border-slate-200/90 bg-white p-7 shadow-[0_8px_30px_rgb(15,23,42,0.06)] dark:border-slate-700/80 dark:bg-slate-950/80 dark:shadow-none">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-indigo-950/80 dark:text-amber-200/90">
            {formatDateLabel(schedule.liturgy_date)}
          </p>
          {schedule.title.trim() ? (
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {schedule.title}
            </h3>
          ) : null}
        </div>
        {showEditLink ? (
          <Link
            href={`/liturgical/edit?date=${schedule.liturgy_date}`}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-indigo-900/20 bg-white px-5 text-sm font-medium text-indigo-950 transition hover:bg-indigo-50 dark:border-amber-200/25 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-slate-800"
          >
            수정
          </Link>
        ) : null}
      </div>

      {schedule.announcement_detail.trim() ? (
        <div className="mb-6 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-5 dark:border-slate-600 dark:bg-slate-900/60">
          <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-800 dark:text-slate-200">
            {schedule.announcement_detail}
          </p>
        </div>
      ) : null}

      {hasLiturgicalRoles ? (
        <div className="space-y-6 rounded-2xl border border-slate-200/70 bg-gradient-to-b from-amber-50/40 to-slate-50/30 p-5 dark:border-slate-700 dark:from-slate-900/40 dark:to-slate-950/50">
          <div>
            <h4 className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-indigo-950 dark:text-amber-200/95">
              전례 봉사
            </h4>
            <div className="space-y-2.5 text-[15px] leading-snug">
              <Row label="해설" value={schedule.role_commentator} />
              <Row label="1독서" value={schedule.role_reader_1} />
              <Row label="2독서" value={schedule.role_reader_2} />
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-indigo-950 dark:text-amber-200/95">
              복음 환호송
            </h4>
            {schedule.role_gospel_acclamation.trim() ? (
              <p className="text-[15px] text-slate-800 dark:text-slate-200">
                {schedule.role_gospel_acclamation}
              </p>
            ) : null}
          </div>

          <div>
            <h4 className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-indigo-950 dark:text-amber-200/95">
              복사단
            </h4>
            <div className="space-y-2.5 text-[15px] leading-snug">
              <Row label="대복" value={schedule.thurifer_main} />
              <Row label="소복" value={schedule.thurifer_sub} />
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-indigo-950 dark:text-amber-200/95">
              지휘 · 반주
            </h4>
            <div className="space-y-2.5 text-[15px] leading-snug">
              <Row label="지휘" value={FIXED_CONDUCTOR_NAME} />
              <Row label="반주" value={schedule.organist} />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-b from-amber-50/40 to-slate-50/30 p-5 dark:border-slate-700 dark:from-slate-900/40 dark:to-slate-950/50">
          <h4 className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-indigo-950 dark:text-amber-200/95">
            지휘 · 반주
          </h4>
          <div className="space-y-2.5 text-[15px] leading-snug">
            <Row label="지휘" value={FIXED_CONDUCTOR_NAME} />
            <Row label="반주" value={schedule.organist} />
          </div>
        </div>
      )}

      {schedule.updated_at ? (
        <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-500">
          마지막 저장:{" "}
          {new Date(schedule.updated_at).toLocaleString("ko-KR")}
        </p>
      ) : null}
    </article>
  );
}
