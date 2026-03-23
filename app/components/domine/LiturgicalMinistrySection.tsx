import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";

const display = Cormorant_Garamond({
  weight: ["600", "700"],
  subsets: ["latin"],
});

type Props = {
  weekSunday: string;
  schedule: LiturgicalSchedule | null;
};

function formatWeekLabel(iso: string) {
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

export function LiturgicalMinistrySection({ weekSunday, schedule }: Props) {
  const hasAnyRole =
    !!schedule &&
    [
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
    <section
      id="liturgical"
      className="scroll-mt-20 border-b border-stone-200/60 bg-white/70 px-5 py-16 sm:px-8 dark:border-stone-800 dark:bg-stone-900/30"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#1a2f4a]/70 dark:text-amber-200/70">
              이번 주 · {formatWeekLabel(weekSunday)}
            </p>
            <h2
              className={`${display.className} mt-2 text-3xl text-[#1a2f4a] dark:text-amber-50`}
            >
              전례 봉사 안내
            </h2>
          </div>
          <Link
            href="/liturgical/edit"
            className="inline-flex h-10 items-center justify-center rounded-full border border-[#1a2f4a]/30 bg-white px-5 text-sm font-medium text-[#1a2f4a] transition hover:bg-[#1a2f4a]/5 dark:border-amber-200/30 dark:bg-stone-900 dark:text-amber-100 dark:hover:bg-stone-800"
          >
            수정하기
          </Link>
        </div>

        {!schedule ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-[#faf8f5] p-8 text-center text-stone-600 dark:border-stone-600 dark:bg-stone-950/50 dark:text-stone-400">
            <p>아직 이번 주 전례 봉사 정보가 등록되지 않았습니다.</p>
            <Link
              href="/liturgical/edit"
              className="mt-4 inline-block text-sm font-medium text-[#1a2f4a] underline dark:text-amber-200"
            >
              전례 편집에서 입력하기
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {schedule?.title.trim() ? (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="whitespace-pre-wrap text-center text-sm font-medium text-stone-800 dark:text-stone-200">
                  {schedule.title}
                </p>
              </div>
            ) : null}

            {schedule?.announcement_detail.trim() ? (
              <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 dark:border-stone-700 dark:bg-stone-950/40">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                  {schedule.announcement_detail}
                </p>
              </div>
            ) : null}

            {hasAnyRole ? (
              <div className="space-y-6 rounded-2xl border border-stone-200/80 bg-[#faf8f5] p-6 dark:border-stone-700 dark:bg-stone-950/60">
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#1a2f4a] dark:text-amber-200/90">
                    전례 봉사
                  </h3>
                  <div className="space-y-2 text-sm">
                    <Row label="해설" value={schedule?.role_commentator ?? ""} />
                    <Row label="1독서" value={schedule?.role_reader_1 ?? ""} />
                    <Row label="2독서" value={schedule?.role_reader_2 ?? ""} />
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#1a2f4a] dark:text-amber-200/90">
                    복음 환호송
                  </h3>
                  {schedule?.role_gospel_acclamation.trim() ? (
                    <p className="text-sm leading-relaxed text-stone-800 dark:text-stone-200">
                      {schedule.role_gospel_acclamation}
                    </p>
                  ) : null}
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#1a2f4a] dark:text-amber-200/90">
                    복사단
                  </h3>
                  <div className="space-y-2 text-sm">
                    <Row label="대복" value={schedule?.thurifer_main ?? ""} />
                    <Row label="소복" value={schedule?.thurifer_sub ?? ""} />
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#1a2f4a] dark:text-amber-200/90">
                    지휘 · 반주
                  </h3>
                  <div className="space-y-2 text-sm">
                    <Row label="지휘" value={schedule?.conductor ?? ""} />
                    <Row label="반주" value={schedule?.organist ?? ""} />
                  </div>
                </div>
              </div>
            ) : null}

            {schedule?.updated_at ? (
              <p className="text-center text-xs text-stone-500 dark:text-stone-500">
                마지막 저장:{" "}
                {new Date(schedule.updated_at).toLocaleString("ko-KR")}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
