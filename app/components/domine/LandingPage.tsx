import Link from "next/link";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { HakJunMilitaryBanner } from "@/app/components/domine/HakJunMilitaryBanner";
import { LiturgicalMinisterPrayersSection } from "@/app/components/domine/LiturgicalMinisterPrayersSection";
import { LiturgicalMonthSection } from "@/app/components/domine/LiturgicalMonthSection";
import { litDisplay } from "@/lib/fonts/display";

const nav = [
  { href: "/liturgical", label: "전례 안내" },
  { href: "/liturgical/edit", label: "전례 편집" },
  { href: "/calendar", label: "캘린더" },
  { href: "/youth", label: "청년회 멤버" },
];

type Props = {
  liturgicalYear: number;
  liturgicalMonth: number;
  liturgicalSchedules: LiturgicalSchedule[];
  /** 메인: 오늘 기준 가장 가까운 미사 카드 강조용 ISO 날짜 */
  highlightLiturgyDate?: string | null;
};

export function LandingPage({
  liturgicalYear,
  liturgicalMonth,
  liturgicalSchedules,
  highlightLiturgyDate = null,
}: Props) {
  return (
    <div className="flex min-h-full flex-col bg-[var(--lit-bg)] text-[var(--lit-ink)]">
      <header className="sticky top-0 z-50 border-b border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]/95 shadow-[inset_0_-1px_0_rgba(255,255,255,0.45)] backdrop-blur-md dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]">
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-5 sm:px-10">
          <Link
            href="/"
            className={`${litDisplay.className} shrink-0 text-2xl tracking-tight text-[var(--lit-ink)] transition-colors hover:text-[var(--lit-gold)] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lit-bg-elevated)]`}
          >
            도미네
          </Link>
          <nav
            className="flex flex-wrap items-center justify-end gap-0.5 text-[15px] font-medium sm:gap-1"
            aria-label="주요 메뉴"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-[var(--lit-ink-muted)] transition-colors hover:bg-[var(--lit-bg)] hover:text-[var(--lit-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lit-bg-elevated)] dark:hover:bg-[var(--lit-bg)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section
          className="relative overflow-hidden border-b border-[var(--lit-border)] bg-[var(--lit-bg-hero)] px-5 py-20 sm:px-10 sm:py-24"
          aria-labelledby="hero-title"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-25"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(125, 107, 74, 0.12), transparent 55%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--lit-gold-muted)]/40 to-transparent"
            aria-hidden
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-[var(--lit-gold)]">
              용호성당
            </p>
            <h1
              id="hero-title"
              className={`${litDisplay.className} text-5xl leading-[1.08] text-[var(--lit-ink)] sm:text-6xl md:text-7xl`}
            >
              도미네
            </h1>
            <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-[var(--lit-ink-muted)]">
              천주교 신앙 안에서 함께 걷는 청년 공동체
            </p>
          </div>
        </section>

        <HakJunMilitaryBanner />

        <LiturgicalMonthSection
          year={liturgicalYear}
          month={liturgicalMonth}
          schedules={liturgicalSchedules}
          variant="home"
          highlightLiturgyDate={highlightLiturgyDate}
        />

        <LiturgicalMinisterPrayersSection />
      </main>

      <footer className="border-t border-[var(--lit-border-strong)] bg-[var(--lit-ink-footer)] px-5 py-14 text-center text-sm text-[#e8e4dc]/95">
        <p className={`${litDisplay.className} text-xl text-[var(--lit-gold-light)]`}>
          도미네
        </p>
        <p className="mt-2 text-[15px] text-[#c4b8a8]/90">용호성당 청년회</p>
        <p className="mt-10 text-xs tracking-wide text-[#8a8075]/85">
          © {new Date().getFullYear()} 도미네
        </p>
      </footer>
    </div>
  );
}
