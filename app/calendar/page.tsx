import Link from "next/link";
import { listCalendarEventsInMonth } from "@/app/actions/calendar";
import { SiteHeader } from "@/app/components/layout/SiteHeader";
import { CalendarPageClient } from "./CalendarPageClient";
import { parseYearMonthParams } from "@/lib/date/month";
import { litDisplay } from "@/lib/fonts/display";
import { SITE_NAV_CALENDAR } from "@/lib/nav/site-nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "도미네 캘린더 | 도미네",
  description: "도미네 일정",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const { year, month } = parseYearMonthParams(sp.year, sp.month);
  const events = await listCalendarEventsInMonth(year, month);

  return (
    <div className="flex min-h-full flex-col bg-[var(--lit-bg)] text-[var(--lit-ink)]">
      <SiteHeader navLinks={SITE_NAV_CALENDAR} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16 md:px-8 md:py-20">
        <div className="mb-12 border-b border-[var(--lit-border)] pb-10 md:mb-16 md:pb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--lit-ink-subtle)]">
            일정
          </p>
          <h1
            className={`${litDisplay.className} mt-4 text-[clamp(2rem,5vw,2.75rem)] font-semibold tracking-tight text-[var(--lit-ink)]`}
          >
            도미네 캘린더
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--lit-ink-muted)]">
            월을 바꿔 일정을 보고, 날짜별로 일정을 추가·수정할 수 있습니다.
          </p>
        </div>
        <CalendarPageClient
          key={`${year}-${month}`}
          year={year}
          month={month}
          events={events}
        />
      </main>
      <footer className="border-t border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-6 py-10 text-center text-sm text-[var(--lit-ink-muted)]">
        <Link
          href="/"
          className="font-medium underline decoration-[var(--lit-border-strong)] underline-offset-4 transition hover:text-[var(--lit-ink)]"
        >
          메인으로
        </Link>
      </footer>
    </div>
  );
}
