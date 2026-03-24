import Link from "next/link";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { DeployStamp } from "@/app/components/layout/DeployStamp";
import { FamilyPhotoCarousel } from "@/app/components/domine/FamilyPhotoCarousel";
import { HakJunMilitaryBanner } from "@/app/components/domine/HakJunMilitaryBanner";
import { LiturgicalMinisterPrayersSection } from "@/app/components/domine/LiturgicalMinisterPrayersSection";
import { LiturgicalMonthSection } from "@/app/components/domine/LiturgicalMonthSection";
import { familyGalleryImages } from "@/lib/domine/family-gallery";

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
          className="group relative break-keep px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lit-ink-muted)] transition-colors hover:text-[var(--lit-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 sm:px-3 sm:py-2 sm:text-[11px] sm:tracking-[0.18em]"
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
          className="cos-grid-bg relative flex min-h-[88dvh] flex-col justify-center overflow-hidden border-b border-[var(--lit-border)]"
          aria-labelledby="hero-title"
        >
          <h1 id="hero-title" className="sr-only">
            도미네
          </h1>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--lit-bg-hero)] via-transparent to-[var(--lit-bg)] opacity-90"
            aria-hidden
          />
          <div className="relative mx-auto w-full max-w-[90rem] px-5 py-16 md:px-10 md:py-20 lg:px-12 lg:py-28">
            <div className="cos-stagger-2 mx-auto w-full max-w-[min(100%,42rem)]">
              <FamilyPhotoCarousel
                images={familyGalleryImages}
                imageClassName="object-contain object-center lg:object-cover lg:object-[center_28%]"
                sizes="(max-width: 1024px) 100vw, 42rem"
              />
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
            <div className="max-lg:text-balance">
              <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-[var(--lit-ink-subtle)] max-lg:tracking-[0.28em]">
                Domine
              </p>
              <p className="mt-3 text-lg font-medium tracking-[-0.02em] text-[var(--lit-ink)]">
                도미네
              </p>
              <p className="mt-2 break-keep text-sm text-[var(--lit-ink-muted)]">
                용호성당 청년회
              </p>
            </div>
            <p className="text-xs tracking-wide text-[var(--lit-ink-subtle)] max-lg:text-balance">
              © {new Date().getFullYear()}
            </p>
          </div>
          <DeployStamp />
        </div>
      </footer>
    </div>
  );
}
