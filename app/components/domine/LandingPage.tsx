import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { LiturgicalMonthSection } from "@/app/components/domine/LiturgicalMonthSection";

const display = Cormorant_Garamond({
  weight: ["600", "700"],
  subsets: ["latin"],
});

const nav = [
  { href: "/liturgical", label: "전례 안내" },
  { href: "/liturgical/edit", label: "전례 편집" },
  { href: "/calendar", label: "캘린더" },
];

type Props = {
  liturgicalYear: number;
  liturgicalMonth: number;
  liturgicalSchedules: LiturgicalSchedule[];
};

export function LandingPage({
  liturgicalYear,
  liturgicalMonth,
  liturgicalSchedules,
}: Props) {
  return (
    <div className="flex min-h-full flex-col bg-[#f4f6fb] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-[#f4f6fb]/92 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/92">
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-5 sm:px-10">
          <Link
            href="/"
            className={`${display.className} shrink-0 text-2xl tracking-tight text-indigo-950 dark:text-amber-50`}
          >
            도미네
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-1 text-[15px] font-medium sm:gap-5">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-white/80 hover:text-indigo-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section
          className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-br from-[#eef2ff] via-[#f8fafc] to-[#fff7ed] px-5 py-24 sm:px-10 sm:py-32 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950"
          aria-labelledby="hero-title"
        >
          <div className="pointer-events-none absolute -right-28 top-8 h-80 w-80 rounded-full bg-amber-300/30 blur-3xl dark:bg-amber-600/10" />
          <div className="pointer-events-none absolute -left-24 bottom-4 h-64 w-64 rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-900/20" />
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="mb-5 text-[0.7rem] font-semibold uppercase tracking-[0.4em] text-indigo-950/90 dark:text-amber-200/80">
              용호성당 · 청년 사도직
            </p>
            <h1
              id="hero-title"
              className={`${display.className} mb-7 text-5xl leading-[1.05] text-indigo-950 sm:text-6xl md:text-7xl dark:text-amber-50`}
            >
              도미네
              <span className="mt-3 block font-sans text-2xl font-semibold tracking-tight text-slate-700 sm:text-3xl dark:text-slate-300">
                Domine
              </span>
            </h1>
            <p className="mx-auto max-w-lg text-lg leading-relaxed text-slate-700 dark:text-slate-400">
              주님을 중심으로 모이는 청년들의 공동체입니다.
              <br className="hidden sm:inline" /> 신앙을 나누고, 일상을 함께 걷습니다.
            </p>
          </div>
        </section>

        <LiturgicalMonthSection
          year={liturgicalYear}
          month={liturgicalMonth}
          schedules={liturgicalSchedules}
          variant="home"
        />
      </main>

      <footer className="border-t border-slate-800/80 bg-indigo-950 px-5 py-12 text-center text-sm text-amber-50/95 dark:border-slate-800">
        <p className={`${display.className} text-xl text-amber-50`}>도미네</p>
        <p className="mt-2 text-[15px] text-amber-100/85">용호성당 청년회</p>
        <p className="mt-8 text-xs text-amber-200/55">
          © {new Date().getFullYear()} Domine. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
