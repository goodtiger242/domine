import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import { listCalendarEventsInMonth } from "@/app/actions/calendar";
import { CalendarPageClient } from "./CalendarPageClient";
import { parseYearMonthParams } from "@/lib/date/month";

const display = Cormorant_Garamond({
  weight: ["600", "700"],
  subsets: ["latin"],
});

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
    <div className="flex min-h-full flex-col bg-gradient-to-b from-[#eef2ff] via-[#f8fafc] to-[#fff7ed] text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200/80 bg-[#f4f6fb]/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex h-[3.75rem] max-w-6xl items-center justify-between px-5 sm:px-10">
          <Link
            href="/"
            className={`${display.className} text-lg text-indigo-950 dark:text-amber-100`}
          >
            ← 도미네
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-[15px] font-medium sm:gap-4">
            <Link
              href="/liturgical"
              className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-white/80 hover:text-indigo-950 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              전례 안내
            </Link>
            <Link
              href="/liturgical/edit"
              className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-white/80 hover:text-indigo-950 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              전례 편집
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-10">
        <h1
          className={`${display.className} text-4xl tracking-tight text-indigo-950 dark:text-amber-50`}
        >
          도미네 캘린더
        </h1>
        <div className="mt-10">
          <CalendarPageClient year={year} month={month} events={events} />
        </div>
      </main>
    </div>
  );
}
