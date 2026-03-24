import Link from "next/link";
import type { SiteNavLink } from "@/lib/nav/site-nav";

type Props = {
  navLinks: SiteNavLink[];
};

/** 서브페이지 헤더 — COS 톤(블러·캡션 네비) */
export function SiteHeader({ navLinks }: Props) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between gap-3 px-5 md:h-16 md:px-10 lg:px-12">
        <Link
          href="/"
          className="shrink-0 text-[15px] font-medium tracking-[-0.04em] text-[var(--lit-ink)] transition-opacity hover:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 md:text-base"
        >
          도미네
        </Link>
        <nav
          className="flex max-w-[72%] flex-wrap items-center justify-end gap-x-0 gap-y-1 sm:max-w-none sm:gap-1"
          aria-label="주요 메뉴"
        >
          {navLinks.map((item) => (
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
      </div>
    </header>
  );
}
