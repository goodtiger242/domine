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
      className="scroll-mt-20 border-b border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-5 py-16 sm:px-8"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--lit-gold-muted)]">
                전례 안내
              </p>
              <h2
                className={`${litDisplay.className} mt-2 text-3xl tracking-tight text-[var(--lit-ink)] sm:text-4xl`}
              >
                {label} 전례 봉사
              </h2>
            </div>
            {variant === "page" ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/liturgical/edit"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--lit-border-strong)] bg-[var(--lit-bg)] px-6 text-sm font-semibold text-[var(--lit-ink)] shadow-[var(--lit-paper-shadow)] transition hover:border-[var(--lit-gold)] hover:text-[var(--lit-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
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
          <div className="rounded-2xl border border-dashed border-[var(--lit-border-strong)] bg-[var(--lit-bg)] p-12 text-center text-[var(--lit-ink-muted)]">
            <p className="text-base leading-relaxed">{label}에 등록된 전례 봉사 정보가 없습니다.</p>
            <Link
              href="/liturgical/edit"
              className="mt-5 inline-block text-sm font-semibold text-[var(--lit-gold)] underline decoration-[var(--lit-gold)]/40 underline-offset-4 transition hover:text-[var(--lit-ink)] hover:decoration-[var(--lit-ink)]/40"
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
