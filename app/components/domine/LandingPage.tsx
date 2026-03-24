import Image from "next/image";
import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { DeployStamp } from "@/app/components/layout/DeployStamp";
import { SiteBrandLink } from "@/app/components/layout/SiteBrandLink";
import { FamilyPhotoCarousel } from "@/app/components/domine/FamilyPhotoCarousel";
import { HakJunMilitaryBanner } from "@/app/components/domine/HakJunMilitaryBanner";
import { LiturgicalMinisterPrayersSection } from "@/app/components/domine/LiturgicalMinisterPrayersSection";
import { LiturgicalMonthSection } from "@/app/components/domine/LiturgicalMonthSection";
import { familyGalleryImages } from "@/lib/domine/family-gallery";
import { SiteHeaderNav } from "@/app/components/layout/SiteHeaderNav";
import { SITE_NAV_HOME } from "@/lib/nav/site-nav";

type Props = {
  liturgicalYear: number;
  liturgicalMonth: number;
  homeSpotlight: {
    eventKeys: string[];
    schedulesByDate: Record<string, LiturgicalSchedule>;
    initialIndex: number;
  };
};

export function LandingPage({
  liturgicalYear,
  liturgicalMonth,
  homeSpotlight,
}: Props) {
  return (
    <div className="flex min-h-full flex-col bg-[var(--lit-bg)] text-[var(--lit-ink)] antialiased">
      <header className="sticky top-0 z-50 border-b border-[var(--lit-border)]/80 bg-[var(--lit-bg-elevated)]/92 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur-md dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]">
        <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between gap-4 px-4 md:h-16 md:px-10 lg:px-12">
          <SiteBrandLink />
          <SiteHeaderNav navLinks={SITE_NAV_HOME} />
        </div>
      </header>

      <main className="flex-1">
        <section
          className="cos-grid-bg relative flex min-h-0 flex-col justify-center overflow-hidden border-b border-[var(--lit-border)]/70 lg:min-h-[min(88dvh,920px)]"
          aria-labelledby="hero-title"
        >
          <h1 id="hero-title" className="sr-only">
            도미네
          </h1>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--lit-bg-hero)] via-[var(--lit-bg-hero)]/40 to-[var(--lit-bg)] opacity-[0.92]"
            aria-hidden
          />
          <div className="relative mx-auto w-full max-w-[90rem] px-4 py-12 md:px-10 md:py-24 lg:px-12 lg:py-32">
            <div className="cos-stagger-2 mx-auto flex w-full max-w-[min(100%,42rem)] flex-col items-center gap-2">
              <div className="mb-2 flex w-full justify-center px-2 md:mb-4">
                <Image
                  src="/image/domine_logo.jpg"
                  alt="Domine"
                  width={480}
                  height={180}
                  priority
                  className="h-auto max-h-[4.75rem] w-auto max-w-[min(100%,18rem)] object-contain object-center drop-shadow-[0_2px_20px_rgba(0,0,0,0.06)] md:max-h-[5.5rem] lg:max-h-[6rem] dark:drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]"
                />
              </div>
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
          schedules={[]}
          variant="home"
          homeSpotlight={homeSpotlight}
        />

        <LiturgicalMinisterPrayersSection />
      </main>

      <footer className="border-t border-[var(--lit-border)]/80 bg-[var(--lit-bg-elevated)]">
        <div className="mx-auto max-w-[90rem] px-5 py-16 md:px-10 md:py-24 lg:px-12">
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
