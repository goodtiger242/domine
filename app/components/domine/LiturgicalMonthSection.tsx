import Link from "next/link";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { formatMonthLabelKo } from "@/lib/date/month";
import { LiturgicalScheduleCard } from "@/app/components/domine/LiturgicalScheduleCard";
import { HomeLiturgicalSpotlight } from "@/app/components/domine/HomeLiturgicalSpotlight";
import { MonthNav } from "@/app/components/ui/MonthNav";

type Props = {
  year: number;
  month: number;
  schedules: LiturgicalSchedule[];
  variant: "home" | "page";
  /** 메인: 한 박스 + 좌우 네비 (전체 월 리스트 대신) */
  homeSpotlight?: {
    eventKeys: string[];
    schedulesByDate: Record<string, LiturgicalSchedule>;
    initialIndex: number;
  } | null;
  /** 랜딩 등에서 순서·스크롤 마진 조정 */
  sectionClassName?: string;
};

export function LiturgicalMonthSection({
  year,
  month,
  schedules,
  variant,
  homeSpotlight = null,
  sectionClassName = "",
}: Props) {
  const label = formatMonthLabelKo(year, month);

  return (
    <section
      id={variant === "home" ? "liturgical" : undefined}
      className={`scroll-mt-28 border-b border-[var(--lit-border)]/80 bg-[var(--lit-bg)] px-5 py-24 md:px-10 md:py-32 lg:scroll-mt-24 lg:px-12${
        sectionClassName ? ` ${sectionClassName}` : ""
      }`}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 flex flex-col gap-8 md:mb-16 md:gap-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-[var(--lit-ink-subtle)] max-lg:tracking-[0.28em]">
                Liturgy
              </p>
              <h2 className="mt-4 font-light text-4xl tracking-[-0.03em] text-[var(--lit-ink)] max-lg:text-[clamp(1.65rem,6.5vw,2.1rem)] max-lg:leading-snug md:text-5xl">
                {variant === "home" && homeSpotlight ? (
                  <span className="break-keep">전례 봉사</span>
                ) : (
                  <>
                    <span className="break-keep">{label}</span>
                    <span className="mt-1.5 block max-lg:mt-2 lg:mt-0 lg:inline">
                      <span className="font-normal text-[var(--lit-ink-muted)]">
                        <span className="max-lg:hidden"> · </span>
                        전례 봉사
                      </span>
                    </span>
                  </>
                )}
              </h2>
            </div>
            {variant === "page" ? (
              <Link
                href="/liturgical/edit"
                className="inline-flex h-12 shrink-0 items-center justify-center border border-[var(--lit-ink)] bg-[var(--lit-ink)] px-8 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--lit-bg-elevated)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
              >
                편집
              </Link>
            ) : null}
          </div>

          {variant === "page" ? (
            <MonthNav year={year} month={month} basePath="/liturgical" />
          ) : null}
        </div>

        {variant === "home" && homeSpotlight ? (
          <HomeLiturgicalSpotlight
            eventKeys={homeSpotlight.eventKeys}
            schedulesByDate={homeSpotlight.schedulesByDate}
            initialIndex={homeSpotlight.initialIndex}
          />
        ) : schedules.length === 0 ? (
          <div className="border border-dashed border-[var(--lit-border-strong)] bg-[var(--lit-bg-elevated)] px-8 py-16 text-center">
            <p className="text-[15px] leading-relaxed text-[var(--lit-ink-muted)]">
              {label}에 등록된 전례 봉사 정보가 없습니다.
            </p>
            <Link
              href="/liturgical/edit"
              className="mt-8 inline-block text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--lit-ink)] underline decoration-[var(--lit-border-strong)] underline-offset-[6px] transition hover:opacity-70"
            >
              입력하기
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-10 md:gap-14">
            {schedules.map((s) => (
              <li key={s.liturgy_date}>
                <LiturgicalScheduleCard
                  schedule={s}
                  showEditLink={variant !== "home"}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
