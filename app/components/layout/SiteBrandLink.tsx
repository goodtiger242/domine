import Link from "next/link";

/** 메인으로 이동 — 모바일은 강조된 워드마크, 데스크톱은 얇은 에디토리얼 타이포 */
export function SiteBrandLink() {
  return (
    <Link
      href="/"
      className="group shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
    >
      <span className="flex flex-col gap-0.5 md:gap-0">
        <span className="text-[9px] font-medium uppercase tracking-[0.32em] text-[var(--lit-ink-subtle)] md:hidden">
          Domine
        </span>
        <span
          className="inline-flex items-center rounded-2xl border border-[var(--lit-border)] bg-gradient-to-b from-[var(--lit-bg-elevated)] to-[var(--lit-bg)] px-[0.85rem] py-2 text-[1.0625rem] font-semibold leading-none tracking-[-0.06em] text-[var(--lit-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-[border-color,box-shadow,transform] duration-200 hover:border-[var(--lit-border-strong)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.07)] active:scale-[0.98] md:rounded-none md:border-0 md:bg-none md:px-0 md:py-0 md:text-base md:font-medium md:tracking-[-0.04em] md:shadow-none md:hover:opacity-60 md:hover:shadow-none md:active:scale-100"
        >
          도미네
        </span>
      </span>
    </Link>
  );
}
