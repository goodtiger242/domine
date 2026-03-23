import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import { listLiturgicalInMonth } from "@/app/actions/liturgical";
import { LiturgicalMonthSection } from "@/app/components/domine/LiturgicalMonthSection";
import { parseYearMonthParams } from "@/lib/date/month";

const display = Cormorant_Garamond({
  weight: ["600", "700"],
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

export const metadata = {
  title: "전례 안내 | 도미네",
  description: "월별 전례 봉사 안내를 확인합니다.",
};

export default async function LiturgicalGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const { year, month } = parseYearMonthParams(sp.year, sp.month);
  const schedules = await listLiturgicalInMonth(year, month);

  return (
    <div className="flex min-h-full flex-col bg-[#faf8f5] text-stone-900 dark:bg-stone-950 dark:text-stone-100">
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
              href="/liturgical/edit"
              className="rounded-full px-3 py-1.5 text-stone-600 transition hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              전례 편집
            </Link>
            <Link
              href="/calendar"
              className="rounded-full px-3 py-1.5 text-stone-600 transition hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              캘린더
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <LiturgicalMonthSection
          year={year}
          month={month}
          schedules={schedules}
          variant="page"
        />
      </main>
    </div>
  );
}
