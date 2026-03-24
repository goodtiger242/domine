import Link from "next/link";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { formatMonthLabelKo } from "@/lib/date/month";
import { LiturgicalScheduleCard } from "@/app/components/domine/LiturgicalScheduleCard";
import { MonthNav } from "@/app/components/ui/MonthNav";
import { litDisplay } from "@/lib/fonts/display";

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
      className="scroll-mt-20 border-b border-[var(--lit-border)] bg-[var(--lit-bg)] px-6 py-20 md:px-8 md:py-24"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 flex flex-col gap-6 md:mb-16">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--lit-ink-subtle)]">
                전례 안내
              </p>
              <h2
                className={`${litDisplay.className} mt-3 text-3xl font-semibold tracking-tight text-[var(--lit-ink)] md:text-[2.25rem]`}
              >
                {label} 전례 봉사
              </h2>
            </div>
            {variant === "page" ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/liturgical/edit"
                  className="inline-flex h-11 items-center justify-center border border-[var(--lit-border-strong)] bg-[var(--lit-bg-elevated)] px-6 text-sm font-semibold text-[var(--lit-ink)] transition hover:bg-[var(--lit-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
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
          <div className="border border-dashed border-[var(--lit-border-strong)] bg-[var(--lit-bg-elevated)] p-12 text-center text-[var(--lit-ink-muted)]">
            <p className="text-base leading-relaxed">{label}에 등록된 전례 봉사 정보가 없습니다.</p>
            <Link
              href="/liturgical/edit"
              className="mt-5 inline-block text-sm font-semibold text-[var(--lit-ink)] underline decoration-[var(--lit-border-strong)] underline-offset-4 transition hover:opacity-70"
            >
              전례 편집에서 입력하기
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-12 md:gap-16">
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
