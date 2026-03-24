import Link from "next/link";
import { listLiturgicalInMonth } from "@/app/actions/liturgical";
import { DeployStamp } from "@/app/components/layout/DeployStamp";
import { SiteHeader } from "@/app/components/layout/SiteHeader";
import { LiturgicalMonthSection } from "@/app/components/domine/LiturgicalMonthSection";
import { parseYearMonthParams } from "@/lib/date/month";
import { litDisplay } from "@/lib/fonts/display";
import { SITE_NAV_LITURGICAL } from "@/lib/nav/site-nav";

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
    <div className="flex min-h-full flex-col bg-[var(--lit-bg)] text-[var(--lit-ink)]">
      <SiteHeader navLinks={SITE_NAV_LITURGICAL} />
      <main className="flex-1">
        <div className="border-b border-[var(--lit-border)] bg-[var(--lit-bg-hero)] px-6 py-16 md:px-8">
          <div className="mx-auto max-w-5xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--lit-ink-subtle)]">
            도미네
          </p>
          <h1
            className={`${litDisplay.className} mt-4 text-3xl font-semibold tracking-tight text-[var(--lit-ink)] md:text-4xl`}
          >
            전례 안내
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--lit-ink-muted)]">
            월별 전례 봉사 배정을 확인합니다. 편집은 상단 메뉴에서 이동할 수 있습니다.
          </p>
          </div>
        </div>
        <LiturgicalMonthSection
          year={year}
          month={month}
          schedules={schedules}
          variant="page"
        />
      </main>
      <footer className="border-t border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-5 py-8 text-center text-sm text-[var(--lit-ink-muted)]">
        <Link
          href="/"
          className="font-medium text-[var(--lit-ink-muted)] underline decoration-[var(--lit-border-strong)] underline-offset-4 transition hover:text-[var(--lit-ink)]"
        >
          메인으로
        </Link>
        <DeployStamp />
      </footer>
    </div>
  );
}
