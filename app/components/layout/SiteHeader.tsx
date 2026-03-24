import Link from "next/link";
import { litDisplay } from "@/lib/fonts/display";
import type { SiteNavLink } from "@/lib/nav/site-nav";

type Props = {
  navLinks: SiteNavLink[];
};

/** 서브페이지 — 에디토리얼 미니멀 헤더(플랫, 보더만) */
export function SiteHeader({ navLinks }: Props) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--lit-border)] bg-[var(--lit-bg-elevated)]">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6 md:h-[4.5rem] md:px-8">
        <Link
          href="/"
          className={`${litDisplay.className} text-lg tracking-tight text-[var(--lit-ink)] transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2 md:text-xl`}
        >
          도미네
        </Link>
        <nav
          className="flex flex-wrap items-center justify-end gap-1 text-sm font-medium md:text-[15px]"
          aria-label="주요 메뉴"
        >
          {navLinks.map((item) => (
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
  );
}
