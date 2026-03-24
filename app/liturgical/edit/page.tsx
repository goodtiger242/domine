import Link from "next/link";
import { LiturgicalEditForm } from "./LiturgicalEditForm";
import {
  getScheduleForDate,
  listLiturgicalDateCounts,
} from "@/app/actions/liturgical";
import { SiteHeader } from "@/app/components/layout/SiteHeader";
import { getTodayISO } from "@/lib/date/local";
import { litDisplay } from "@/lib/fonts/display";
import { SITE_NAV_EDIT } from "@/lib/nav/site-nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "전례 봉사 편집 | 도미네",
  description: "미사 날짜별 전례 봉사 배정을 입력·수정합니다.",
};

export default async function LiturgicalEditPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const liturgyDate = sp.date ?? getTodayISO();
  const [schedule, savedDateCounts] = await Promise.all([
    getScheduleForDate(liturgyDate),
    listLiturgicalDateCounts(),
  ]);

  return (
    <div className="flex min-h-full flex-col bg-[var(--lit-bg)] text-[var(--lit-ink)]">
      <SiteHeader navLinks={SITE_NAV_EDIT} />
      <main className="flex-1 px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="border-b border-[var(--lit-border)] pb-10 md:pb-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--lit-ink-subtle)]">
              관리
            </p>
            <h1
              className={`${litDisplay.className} mt-4 text-3xl font-semibold tracking-tight text-[var(--lit-ink)] md:text-4xl`}
            >
              전례 봉사 편집
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--lit-ink-muted)]">
              미사 날짜를 고른 뒤 봉사자를 입력하고 저장합니다. 메인·전례 안내에 반영됩니다.
            </p>
            <Link
              href="/"
              className="mt-8 inline-flex text-sm font-semibold text-[var(--lit-ink-muted)] underline decoration-[var(--lit-border-strong)] underline-offset-4 transition hover:text-[var(--lit-ink)]"
            >
              ← 메인으로
            </Link>
          </div>
          <LiturgicalEditForm
            key={`${liturgyDate}-${schedule?.updated_at ?? "none"}`}
            liturgyDate={liturgyDate}
            initial={schedule}
            savedDateCounts={savedDateCounts}
          />
        </div>
      </main>
    </div>
  );
}
