import Link from "next/link";
import { litDisplay } from "@/lib/fonts/display";
import type { SiteNavLink } from "@/lib/nav/site-nav";

type Props = {
  navLinks: SiteNavLink[];
};

/**
 * 서브페이지 공통 헤더 — 잉크·양피지 톤, 포커스 링 유지
 */
export function SiteHeader({ navLinks }: Props) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]/95 shadow-[inset_0_-1px_0_rgba(255,255,255,0.45)] backdrop-blur-md dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]">
      <div className="mx-auto flex h-[3.75rem] max-w-6xl items-center justify-between gap-4 px-5 sm:px-10">
        <Link
          href="/"
          className={`${litDisplay.className} text-lg tracking-tight text-[var(--lit-ink)] transition-colors hover:text-[var(--lit-gold)] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lit-bg-elevated)]`}
        >
          도미네
        </Link>
        <nav
          className="flex flex-wrap items-center justify-end gap-0.5 text-[15px] font-medium sm:gap-1"
          aria-label="주요 메뉴"
        >
          {navLinks.map((item) => (
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
  );
}
