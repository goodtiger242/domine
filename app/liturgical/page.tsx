import Link from "next/link";
import { listLiturgicalInMonth } from "@/app/actions/liturgical";
import { LiturgicalMonthSection } from "@/app/components/domine/LiturgicalMonthSection";
import { parseYearMonthParams } from "@/lib/date/month";
import { outfitDisplay } from "@/lib/fonts/display";

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
    <div className="flex min-h-full flex-col bg-[#f4f6fb] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200/80 bg-[#f4f6fb]/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex h-[3.75rem] max-w-6xl items-center justify-between px-5 sm:px-10">
          <Link
            href="/"
            className={`${outfitDisplay.className} text-lg text-indigo-950 dark:text-amber-100`}
          >
            ← 도미네
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-[15px] font-medium sm:gap-4">
            <Link
              href="/liturgical/edit"
              className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-white/80 hover:text-indigo-950 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              전례 편집
            </Link>
            <Link
              href="/calendar"
              className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-white/80 hover:text-indigo-950 dark:text-slate-400 dark:hover:bg-slate-800"
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
