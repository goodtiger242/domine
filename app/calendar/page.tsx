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
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-10 sm:py-12">
        <div className="mb-10 border-b border-[var(--lit-border)] pb-8">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--lit-gold-muted)]">
            일정
          </p>
          <h1
            className={`${litDisplay.className} mt-2 text-4xl tracking-tight text-[var(--lit-ink)] sm:text-[2.75rem]`}
          >
            도미네 캘린더
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--lit-ink-muted)]">
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
      <footer className="border-t border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-5 py-8 text-center text-sm text-[var(--lit-ink-muted)]">
        <Link
          href="/"
          className="font-medium text-[var(--lit-gold)] underline decoration-[var(--lit-gold)]/35 underline-offset-4 transition hover:text-[var(--lit-ink)]"
        >
          메인으로
        </Link>
      </footer>
    </div>
  );
}
