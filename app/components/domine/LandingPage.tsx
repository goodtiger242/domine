import Image from "next/image";
import Link from "next/link";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { DeployStamp } from "@/app/components/layout/DeployStamp";
import { HakJunMilitaryBanner } from "@/app/components/domine/HakJunMilitaryBanner";
import { LiturgicalMinisterPrayersSection } from "@/app/components/domine/LiturgicalMinisterPrayersSection";
import { LiturgicalMonthSection } from "@/app/components/domine/LiturgicalMonthSection";

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

/** 메인 네비 — COS식 캡션 + 호버 라인 */
function NavLinks() {
  return (
    <nav
      className="flex max-w-[70%] flex-wrap items-center justify-end gap-x-0 gap-y-1 sm:max-w-none sm:gap-1"
      aria-label="주요 메뉴"
    >
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group relative px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--lit-ink-muted)] transition-colors hover:text-[var(--lit-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 sm:px-3 sm:py-2 sm:text-[11px] sm:tracking-[0.18em]"
        >
          {item.label}
          <span className="absolute bottom-0.5 left-2 right-2 h-px origin-left scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:scale-x-100 sm:bottom-1 sm:left-3 sm:right-3" />
        </Link>
      ))}
    </nav>
  );
}

export function LandingPage({
  liturgicalYear,
  liturgicalMonth,
  liturgicalSchedules,
  highlightLiturgyDate = null,
}: Props) {
  return (
    <div className="flex min-h-full flex-col bg-[var(--lit-bg)] text-[var(--lit-ink)]">
      <header className="sticky top-0 z-50 border-b border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between gap-4 px-5 md:h-16 md:px-10 lg:px-12">
          <Link
            href="/"
            className="text-[15px] font-medium tracking-[-0.04em] text-[var(--lit-ink)] transition-opacity hover:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 md:text-base"
          >
            도미네
          </Link>
          <NavLinks />
        </div>
      </header>

      <main className="flex-1">
        <section
          className="cos-grid-bg relative flex min-h-[88vh] flex-col justify-center overflow-hidden border-b border-[var(--lit-border)]"
          aria-labelledby="hero-title"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--lit-bg-hero)] via-transparent to-[var(--lit-bg)] opacity-90"
            aria-hidden
          />
          <div className="relative mx-auto w-full max-w-[90rem] px-5 py-16 md:px-10 md:py-20 lg:px-12 lg:py-28">
            <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16 xl:gap-20">
              <div className="order-2 text-center lg:order-1 lg:text-left">
                <p className="cos-stagger-1 text-[10px] font-medium uppercase tracking-[0.45em] text-[var(--lit-ink-subtle)] md:text-[11px]">
                  용호성당 · 청년회
                </p>
                <h1
                  id="hero-title"
                  className="cos-stagger-2 mt-6 font-light text-[clamp(3.25rem,11vw,7rem)] leading-[0.92] tracking-[-0.055em] text-[var(--lit-ink)] lg:mt-8 xl:text-[clamp(3.5rem,9vw,7.5rem)]"
                >
                  도미네
                </h1>
                <p className="cos-stagger-3 mx-auto mt-8 max-w-md text-[15px] font-normal leading-[1.75] text-[var(--lit-ink-muted)] md:mt-10 md:text-base lg:mx-0">
                  천주교 신앙 안에서 함께 걷는 공동체.
                  <br className="hidden sm:block" />
                  전례·일정·멤버 정보를 한곳에서.
                </p>
                <div className="cos-stagger-4 mt-12 flex flex-col items-center gap-4 sm:mt-14 lg:items-start">
                  <Link
                    href="#liturgical"
                    className="group inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-[var(--lit-ink)] transition hover:opacity-70"
                  >
                    <span className="h-px w-8 bg-[var(--lit-ink)] transition-all group-hover:w-12" />
                    전례 안내
                    <span className="h-px w-8 bg-[var(--lit-ink)] transition-all group-hover:w-12" />
                  </Link>
                </div>
              </div>

              <figure className="order-1 lg:order-2">
                <div className="cos-stagger-2 relative aspect-[4/3] w-full overflow-hidden border border-[var(--lit-border)] bg-[var(--lit-bg)] shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:aspect-[5/4] lg:aspect-[4/5] xl:aspect-[3/4]">
                  <Image
                    src="/image/domine_familiy.jpg"
                    alt="도미네 단체 사진 — 도미네 패밀리"
                    fill
                    className="object-cover object-[center_28%]"
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    priority
                  />
                </div>
                <figcaption className="cos-stagger-3 mt-4 text-center text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--lit-ink-subtle)] lg:text-right">
                  도미네 패밀리
                </figcaption>
              </figure>
            </div>
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

      <footer className="border-t border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]">
        <div className="mx-auto max-w-[90rem] px-5 py-20 md:px-10 lg:px-12">
          <div className="flex flex-col items-center justify-between gap-10 text-center md:flex-row md:text-left">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-[var(--lit-ink-subtle)]">
                Domine
              </p>
              <p className="mt-3 text-lg font-medium tracking-[-0.02em] text-[var(--lit-ink)]">
                도미네
              </p>
              <p className="mt-2 text-sm text-[var(--lit-ink-muted)]">
                용호성당 청년회
              </p>
            </div>
            <p className="text-xs tracking-wide text-[var(--lit-ink-subtle)]">
              © {new Date().getFullYear()}
            </p>
          </div>
          <DeployStamp />
        </div>
      </footer>
    </div>
  );
}
