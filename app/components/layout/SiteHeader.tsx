import Link from "next/link";
import { SiteHeaderNav } from "@/app/components/layout/SiteHeaderNav";
import type { SiteNavLink } from "@/lib/nav/site-nav";

type Props = {
  navLinks: SiteNavLink[];
};

/** 서브페이지 헤더 — COS 톤(블러) · 모바일은 시트 메뉴 */
export function SiteHeader({ navLinks }: Props) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between gap-3 px-4 md:h-16 md:px-10 lg:px-12">
        <Link
          href="/"
          className="shrink-0 text-[15px] font-medium tracking-[-0.04em] text-[var(--lit-ink)] transition-opacity hover:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 md:text-base"
        >
          도미네
        </Link>
        <SiteHeaderNav navLinks={navLinks} />
      </div>
    </header>
  );
}
