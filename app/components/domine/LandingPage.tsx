import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { LiturgicalMinistrySection } from "@/app/components/domine/LiturgicalMinistrySection";
import { SampleDbTest } from "@/app/components/SampleDbTest";

const display = Cormorant_Garamond({
  weight: ["600", "700"],
  subsets: ["latin"],
});

const nav = [
  { href: "/#liturgical", label: "전례 안내" },
  { href: "/liturgical/edit", label: "전례 편집" },
];

type Props = {
  liturgyDate: string;
  liturgicalSchedule: LiturgicalSchedule | null;
};

export function LandingPage({ liturgyDate, liturgicalSchedule }: Props) {
  return (
    <div className="flex min-h-full flex-col bg-[#faf8f5] text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-[#faf8f5]/90 backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link
            href="/"
            className={`${display.className} shrink-0 text-xl tracking-tight text-[#1a2f4a] dark:text-amber-100/90`}
          >
            도미네
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-1 text-sm sm:gap-4">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-2 py-1.5 text-stone-600 transition hover:bg-stone-200/60 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section
          className="relative overflow-hidden border-b border-stone-200/60 bg-gradient-to-b from-[#f0ebe3] to-[#faf8f5] px-5 py-20 sm:px-8 sm:py-28 dark:border-stone-800 dark:from-stone-900 dark:to-stone-950"
          aria-labelledby="hero-title"
        >
          <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-amber-200/25 blur-3xl dark:bg-amber-900/15" />
          <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-[#1a2f4a]/10 blur-3xl dark:bg-amber-800/10" />
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.35em] text-[#1a2f4a]/80 dark:text-amber-200/70">
              용호성당 · 청년 사도직
            </p>
            <h1
              id="hero-title"
              className={`${display.className} mb-6 text-4xl leading-tight text-[#1a2f4a] sm:text-5xl md:text-6xl dark:text-amber-50`}
            >
              도미네
              <span className="mt-2 block text-2xl font-semibold text-stone-700 sm:text-3xl dark:text-stone-300">
                Domine
              </span>
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-stone-600 dark:text-stone-400">
              주님을 중심으로 모이는 청년들의 공동체입니다.
              <br className="hidden sm:inline" /> 신앙을 나누고, 일상을 함께 걷습니다.
            </p>
          </div>
        </section>

        <LiturgicalMinistrySection
          liturgyDate={liturgyDate}
          schedule={liturgicalSchedule}
        />

        <section className="border-t border-stone-200/60 bg-stone-100/50 px-5 py-10 dark:border-stone-800 dark:bg-stone-900/30">
          <details className="mx-auto max-w-lg rounded-xl border border-dashed border-stone-300 bg-white/60 p-4 text-left dark:border-stone-600 dark:bg-stone-950/40">
            <summary className="cursor-pointer text-sm font-medium text-stone-500 dark:text-stone-500">
              개발용 · DB 연결 테스트
            </summary>
            <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-700">
              <SampleDbTest />
            </div>
          </details>
        </section>
      </main>

      <footer className="border-t border-stone-200/80 bg-[#1a2f4a] px-5 py-10 text-center text-sm text-amber-50/90 dark:border-stone-800">
        <p className={`${display.className} text-lg text-amber-50`}>도미네</p>
        <p className="mt-2 text-amber-100/70">용호성당 청년회</p>
        <p className="mt-6 text-xs text-amber-200/50">
          © {new Date().getFullYear()} Domine. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
