import Link from "next/link";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { formatMonthLabelKo } from "@/lib/date/month";
import { LiturgicalScheduleCard } from "@/app/components/domine/LiturgicalScheduleCard";
import { MonthNav } from "@/app/components/ui/MonthNav";
import { outfitDisplay } from "@/lib/fonts/display";

type Props = {
  year: number;
  month: number;
  schedules: LiturgicalSchedule[];
  variant: "home" | "page";
  /** 메인 전용: 강조할 미사 날짜(ISO) */
  highlightLiturgyDate?: string | null;
};

export function LiturgicalMonthSection({
  year,
  month,
  schedules,
  variant,
  highlightLiturgyDate = null,
}: Props) {
  const label = formatMonthLabelKo(year, month);

  return (
    <section
      id={variant === "home" ? "liturgical" : undefined}
      className="scroll-mt-20 border-b border-slate-200/70 bg-gradient-to-b from-white to-slate-50/30 px-5 py-16 sm:px-8 dark:border-slate-800 dark:from-slate-950 dark:to-slate-950/80"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-indigo-950/75 dark:text-amber-200/80">
                전례 안내
              </p>
              <h2
                className={`${outfitDisplay.className} mt-2 text-3xl tracking-tight text-indigo-950 sm:text-4xl dark:text-amber-50`}
              >
                {label} 전례 봉사
              </h2>
            </div>
            {variant === "page" ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/liturgical/edit"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-indigo-950 px-6 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-900 dark:bg-amber-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  전례 편집
                </Link>
              </div>
            ) : null}
          </div>

          {variant === "page" ? (
            <MonthNav year={year} month={month} basePath="/liturgical" />
          ) : null}
        </div>

        {schedules.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-12 text-center text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
            <p className="text-base">{label}에 등록된 전례 봉사 정보가 없습니다.</p>
            <Link
              href="/liturgical/edit"
              className="mt-4 inline-block text-sm font-semibold text-indigo-950 underline underline-offset-4 dark:text-amber-200"
            >
              전례 편집에서 입력하기
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-10">
            {schedules.map((s) => (
              <li key={s.liturgy_date}>
                <LiturgicalScheduleCard
                  schedule={s}
                  showEditLink={variant !== "home"}
                  emphasize={
                    variant === "home" &&
                    highlightLiturgyDate !== null &&
                    s.liturgy_date === highlightLiturgyDate
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
