import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { DeployStamp } from "@/app/components/layout/DeployStamp";
import { SiteBrandLink } from "@/app/components/layout/SiteBrandLink";
import { HakJunMilitaryBanner } from "@/app/components/domine/HakJunMilitaryBanner";
import { ScrollToTop } from "@/app/components/domine/home/ScrollToTop";
import { LiturgicalMinisterPrayersSection } from "@/app/components/domine/LiturgicalMinisterPrayersSection";
import { LiturgicalMonthSection } from "@/app/components/domine/LiturgicalMonthSection";
import { SiteHeaderNav } from "@/app/components/layout/SiteHeaderNav";
import { SITE_NAV_HOME } from "@/lib/nav/site-nav";

type Props = {
  liturgicalYear: number;
  liturgicalMonth: number;
  homeLiturgical: {
    initialSchedules: LiturgicalSchedule[];
    nextUpcomingLiturgyDate: string | null;
  };
};

export function LandingPage({
  liturgicalYear,
  liturgicalMonth,
  homeLiturgical,
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
        <h1 className="sr-only">도미네 · 용호성당 청년회</h1>

        <div className="flex flex-col">
          <section
            id="home-military"
            className="order-1 border-b border-[var(--lit-border)]/70 bg-[var(--lit-bg)] lg:order-1"
          >
            <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-11 lg:px-2">
              <div className="overflow-hidden rounded-2xl border border-[var(--lit-border)]/90 bg-[var(--lit-bg-elevated)] shadow-[var(--lit-paper-shadow-soft)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
                <div className="p-4 md:p-6">
                  <HakJunMilitaryBanner embedded />
                </div>
              </div>
            </div>
          </section>

          <LiturgicalMonthSection
            year={liturgicalYear}
            month={liturgicalMonth}
            schedules={[]}
            variant="home"
            homeLiturgical={homeLiturgical}
            sectionClassName="order-2 lg:order-2"
          />

          <div className="order-3 lg:order-3">
            <LiturgicalMinisterPrayersSection />
          </div>
        </div>
      </main>

      <ScrollToTop />

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
