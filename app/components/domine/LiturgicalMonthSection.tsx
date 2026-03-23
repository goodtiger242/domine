import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { formatMonthLabelKo } from "@/lib/date/month";
import { LiturgicalScheduleCard } from "@/app/components/domine/LiturgicalScheduleCard";
import { MonthNav } from "@/app/components/ui/MonthNav";

const display = Cormorant_Garamond({
  weight: ["600", "700"],
  subsets: ["latin"],
});

type Props = {
  year: number;
  month: number;
  schedules: LiturgicalSchedule[];
  variant: "home" | "page";
};

export function LiturgicalMonthSection({
  year,
  month,
  schedules,
  variant,
}: Props) {
  const label = formatMonthLabelKo(year, month);

  return (
    <section
      id={variant === "home" ? "liturgical" : undefined}
      className="scroll-mt-20 border-b border-stone-200/60 bg-white/70 px-5 py-14 sm:px-8 dark:border-stone-800 dark:bg-stone-900/30"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#1a2f4a]/70 dark:text-amber-200/70">
                {variant === "home" ? "이번 달" : "전례 안내"}
              </p>
              <h2
                className={`${display.className} mt-1 text-3xl text-[#1a2f4a] dark:text-amber-50`}
              >
                {label} 전례 봉사
              </h2>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                내용이 저장된 미사만 표시됩니다. 날짜 순입니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/liturgical/edit"
                className="inline-flex h-10 items-center justify-center rounded-full bg-[#1a2f4a] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-[#142340] dark:bg-amber-100 dark:text-stone-900 dark:hover:bg-white"
              >
                전례 편집
              </Link>
              {variant === "home" ? (
                <Link
                  href="/liturgical"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-[#1a2f4a]/30 bg-white px-5 text-sm font-medium text-[#1a2f4a] transition hover:bg-[#1a2f4a]/5 dark:border-amber-200/30 dark:bg-stone-900 dark:text-amber-100 dark:hover:bg-stone-800"
                >
                  다른 달 보기
                </Link>
              ) : null}
            </div>
          </div>

          {variant === "page" ? (
            <MonthNav year={year} month={month} basePath="/liturgical" />
          ) : null}
        </div>

        {schedules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-[#faf8f5] p-10 text-center text-stone-600 dark:border-stone-600 dark:bg-stone-950/50 dark:text-stone-400">
            <p>{label}에 등록된 전례 봉사 정보가 없습니다.</p>
            <Link
              href="/liturgical/edit"
              className="mt-4 inline-block text-sm font-medium text-[#1a2f4a] underline dark:text-amber-200"
            >
              전례 편집에서 입력하기
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-8">
            {schedules.map((s) => (
              <li key={s.liturgy_date}>
                <LiturgicalScheduleCard schedule={s} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
