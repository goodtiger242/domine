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
      <header className="sticky top-0 z-50 border-b border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6 md:h-[4.5rem] md:px-8">
          <Link
            href="/"
            className={`${litDisplay.className} shrink-0 text-xl tracking-tight text-[var(--lit-ink)] transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 md:text-2xl`}
          >
            도미네
          </Link>
          <nav
            className="flex flex-wrap items-center justify-end gap-1 text-sm font-medium md:text-[15px]"
            aria-label="주요 메뉴"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-[var(--lit-ink-muted)] transition-colors hover:text-[var(--lit-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section
          className="border-b border-[var(--lit-border)] bg-[var(--lit-bg-hero)] px-6 py-24 md:px-8 md:py-32"
          aria-labelledby="hero-title"
        >
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--lit-ink-subtle)]">
              용호성당
            </p>
            <h1
              id="hero-title"
              className={`${litDisplay.className} text-[clamp(2.75rem,8vw,4.5rem)] font-semibold leading-[1.05] tracking-tight text-[var(--lit-ink)]`}
            >
              도미네
            </h1>
            <p className="mx-auto mt-8 max-w-md text-base leading-relaxed text-[var(--lit-ink-muted)] md:text-[17px]">
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

      <footer className="border-t border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-6 py-16 text-center md:px-8">
        <p className={`${litDisplay.className} text-lg text-[var(--lit-ink)] md:text-xl`}>
          도미네
        </p>
        <p className="mt-2 text-[15px] text-[var(--lit-ink-muted)]">용호성당 청년회</p>
        <p className="mt-12 text-xs tracking-wide text-[var(--lit-ink-subtle)]">
          © {new Date().getFullYear()} 도미네
        </p>
      </footer>
    </div>
  );
}
