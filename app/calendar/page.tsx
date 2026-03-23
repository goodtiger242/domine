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
  description: "청년회 공용 일정 캘린더입니다.",
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
    <div className="flex min-h-full flex-col bg-gradient-to-b from-[#faf8f5] to-[#f0ebe3] text-stone-900 dark:from-stone-950 dark:to-stone-900 dark:text-stone-100">
      <header className="border-b border-stone-200/80 bg-[#faf8f5]/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className={`${display.className} text-lg text-[#1a2f4a] dark:text-amber-100`}
          >
            ← 도미네
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm sm:gap-4">
            <Link
              href="/liturgical"
              className="rounded-full px-3 py-1.5 text-stone-600 transition hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              전례 안내
            </Link>
            <Link
              href="/liturgical/edit"
              className="rounded-full px-3 py-1.5 text-stone-600 transition hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              전례 편집
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8">
        <h1
          className={`${display.className} text-3xl text-[#1a2f4a] dark:text-amber-50`}
        >
          도미네 캘린더
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          공동으로 쓰는 일정입니다. 회장님 포함 누구나 추가·삭제할 수
          있어요. (로그인 없음)
        </p>
        <div className="mt-8">
          <CalendarPageClient year={year} month={month} events={events} />
        </div>
      </main>
    </div>
  );
}
